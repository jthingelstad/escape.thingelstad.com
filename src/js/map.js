import {
  applyFiltersToControls,
  bindFilterControls,
  escapeHtml,
  formatDate,
  getFilterParams,
  initNav,
  roomUrl,
  readFiltersFromControls,
  roomMatchesFilters,
  setFilterParams,
  hasActiveFilters
} from './data.js';

const allRooms = JSON.parse(document.getElementById('room-index-data').textContent);
let map;
let markerClusterGroup;

function filterRooms(filters) {
  return allRooms.filter((room) => roomMatchesFilters(room, filters));
}

function init() {
  initNav();
  initMap();
  applyUrlFilters();
  bindEvents();
}

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([39.8283, -98.5795], 4);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });
  map.addLayer(markerClusterGroup);
}

function getMarkerColor(room) {
  switch (room.status) {
    case 'Escaped':
      return '#48d989';
    case 'Try again':
      return '#f06060';
    case 'Completed':
      return '#9a97a8';
    case 'Scheduled':
      return '#5a8bff';
    default:
      return '#9a97a8';
  }
}

function createMarkerIcon(room) {
  const color = getMarkerColor(room);
  const isPlanned = room.status === 'Scheduled';

  const svg = `
    <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
        fill="${color}" fill-opacity="${isPlanned ? 0.6 : 1}"
        stroke="${isPlanned ? color : 'none'}" stroke-width="${isPlanned ? 2 : 0}"
        stroke-dasharray="${isPlanned ? '4,3' : 'none'}"/>
      <circle cx="14" cy="14" r="6" fill="${isPlanned ? 'transparent' : '#0f0f1a'}"/>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40]
  });
}

function popupFallbackImage(room) {
  return room.status === 'Scheduled' ? '/images/room-scheduled.png' : '/images/room-no-photo.png';
}

function popupLocationParts(location) {
  if (!location) return { primary: '', secondary: '' };

  if (location.city) {
    return {
      primary: location.city,
      secondary: location.region || location.country || ''
    };
  }

  const primary = location.label || location.country || location.region || 'Unknown Location';
  return {
    primary,
    secondary: location.country && location.country !== primary ? location.country : ''
  };
}

function buildPopup(room) {
  const gameName = escapeHtml(room.game);
  const companyName = escapeHtml(room.company?.name || 'Unknown Company');
  const detailUrl = roomUrl(room);
  const fallbackImage = popupFallbackImage(room);
  const dateStr = room.date ? escapeHtml(formatDate(room.date)) : '';
  const { primary: locationPrimary, secondary: locationSecondary } = popupLocationParts(room.location);

  return `
    <div class="popup-room">
      <div class="room-card${room.photo ? ' room-card-has-photo' : ' room-card-no-photo'}" data-room-id="${room.id}">
        <a href="${detailUrl}" class="room-card-link" data-tinylytics-event="map.view-room" data-tinylytics-event-value="${gameName}">
          ${room.photo
            ? `<div class="room-card-thumb"><img src="/images/rooms/${escapeHtml(room.photo)}" alt=""></div>`
            : `<div class="room-card-fallback" aria-hidden="true"><img src="${fallbackImage}" alt=""></div>`}
          <div class="room-card-top-left">
            <div class="room-card-badge">
              <span class="room-card-badge-label">Room</span>
              <span class="room-card-badge-number">${room.id}</span>
            </div>
          </div>
          ${dateStr
            ? `<div class="room-card-top-right"><div class="room-card-date">${dateStr}</div></div>`
            : ''}
          <div class="room-card-bottom">
            <h3 class="room-card-room">${gameName}</h3>
            <div class="room-card-company">${companyName}</div>
            <div class="room-card-bottom-right">
              ${locationPrimary ? `<div class="room-card-location-primary">${escapeHtml(locationPrimary)}</div>` : ''}
              ${locationSecondary ? `<div class="room-card-location-secondary">${escapeHtml(locationSecondary)}</div>` : ''}
            </div>
          </div>
        </a>
      </div>
    </div>
  `;
}

function getCurrentFilters() {
  return readFiltersFromControls();
}

function updateMarkers() {
  const filters = getCurrentFilters();
  setFilterParams(filters);

  const clearBtn = document.getElementById('clear-filters');
  const hasFilters = hasActiveFilters(filters);
  clearBtn.hidden = !hasFilters;

  const rooms = filterRooms(filters);
  const mappable = rooms.filter((room) => room.location?.lat != null && room.location?.lng != null);

  markerClusterGroup.clearLayers();
  mappable.forEach((room) => {
    const marker = L.marker([room.location.lat, room.location.lng], {
      icon: createMarkerIcon(room)
    });
    marker.bindPopup(buildPopup(room), {
      className: 'map-room-popup',
      maxWidth: 360
    });
    markerClusterGroup.addLayer(marker);
  });

  if (mappable.length > 0) {
    const bounds = markerClusterGroup.getBounds();
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

function applyUrlFilters() {
  applyFiltersToControls(getFilterParams());
  updateMarkers();
}

function bindEvents() {
  const toggleBtn = document.getElementById('filter-toggle');
  const panel = document.getElementById('filter-panel');
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    toggleBtn.classList.toggle('open');
    setTimeout(() => map.invalidateSize(), 350);
  });

  bindFilterControls(updateMarkers);
}

init();
