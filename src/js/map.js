import {
  applyFiltersToControls,
  bindFilterControls,
  escapeHtml,
  formatDate,
  formatLocation,
  getFilterParams,
  initNav,
  statusBadgeHtml,
  formatTimeLeft,
  roomUrl,
  entityFilterUrl,
  readFiltersFromControls,
  roomMatchesFilters,
  setFilterParams,
  hasActiveFilters,
  renderEntityChip
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

function buildPopup(room) {
  const gameName = escapeHtml(room.game);
  const companyName = escapeHtml(room.company?.name || 'Unknown Company');
  const statusHtml = statusBadgeHtml(room.status);
  const dateStr = formatDate(room.date);
  const locationStr = escapeHtml(formatLocation(room.location));
  const detailUrl = roomUrl(room);
  const locationHtml = room.location
    ? `<a href="${entityFilterUrl('location', room.location)}" data-tinylytics-event="map.location-filter" data-tinylytics-event-value="${locationStr}">${locationStr}</a>`
    : locationStr;

  const awardsHtml = (room.awards || []).map((award) => renderEntityChip('award', award)).join('');
  const tripsHtml = (room.trips || []).map((trip) => renderEntityChip('trip', trip)).join('');
  const listsHtml = (room.lists || []).map((list) => renderEntityChip('list', list)).join('');
  const themesHtml = (room.themes || []).map((theme) => renderEntityChip('theme', theme)).join('');

  const photoHtml = room.photo
    ? `<div class="popup-photo"><img src="/images/rooms/${escapeHtml(room.photo)}" alt="${gameName} at ${companyName}"></div>`
    : '';

  const officialHtml = room.officialUrl
    ? `<a href="${escapeHtml(room.officialUrl)}" target="_blank" rel="noopener" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.official-site" data-tinylytics-event-value="${gameName}">Official site \u2192</a>`
    : '';

  const blogHtml = room.blogUrl
    ? `<a href="${escapeHtml(room.blogUrl)}" target="_blank" rel="noopener" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.blog-post" data-tinylytics-event-value="${gameName}">Read post \u2192</a>`
    : '';

  const mortyHtml = room.mortyId
    ? `<a href="https://morty.app/attraction/${room.mortyId}" target="_blank" rel="noopener" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.morty" data-tinylytics-event-value="${gameName}">Morty \u2192</a>`
    : '';

  const companyFilter = room.company
    ? `<a href="${entityFilterUrl('company', room.company)}" data-tinylytics-event="map.company-filter" data-tinylytics-event-value="${companyName}">${companyName}</a>`
    : companyName;

  return `
    <div class="popup-room">
      ${photoHtml}
      <div class="popup-content">
        <h3><a href="${detailUrl}" style="color: inherit; text-decoration: none;" data-tinylytics-event="map.view-room" data-tinylytics-event-value="${gameName}">#${room.id} ${gameName}</a></h3>
        <div class="popup-meta">
          ${companyFilter}<br>
          ${dateStr}${locationHtml ? ' &middot; ' + locationHtml : ''}
          ${room.timeLeft != null ? ' &middot; ' + escapeHtml(formatTimeLeft(room.timeLeft)) : ''}
        </div>
        ${statusHtml}
        ${awardsHtml ? `<div class="popup-entities">${awardsHtml}</div>` : ''}
        ${tripsHtml ? `<div class="popup-entities">${tripsHtml}</div>` : ''}
        ${listsHtml ? `<div class="popup-entities">${listsHtml}</div>` : ''}
        ${themesHtml ? `<div class="popup-entities">${themesHtml}</div>` : ''}
        <div class="popup-links">
          <a href="${detailUrl}" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.view-room" data-tinylytics-event-value="${gameName}">View details &rarr;</a>
          ${officialHtml} ${blogHtml} ${mortyHtml}
        </div>
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
  clearBtn.style.display = hasFilters ? '' : 'none';

  const rooms = filterRooms(filters);
  const mappable = rooms.filter((room) => room.location?.lat != null && room.location?.lng != null);

  markerClusterGroup.clearLayers();
  mappable.forEach((room) => {
    const marker = L.marker([room.location.lat, room.location.lng], {
      icon: createMarkerIcon(room)
    });
    marker.bindPopup(buildPopup(room), { maxWidth: 320 });
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
