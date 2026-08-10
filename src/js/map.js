import {
  FILTER_FIELDS,
  STATUS_CONFIG,
  applyFiltersToControls,
  bindFilterControls,
  buildFilterParams,
  escapeHtml,
  formatDate,
  getFilterParams,
  getSelectedRoomParam,
  hasActiveFilters,
  initNav,
  readFiltersFromControls,
  roomMatchesFilters,
  roomUrl,
  setFilterParams
} from './data.js';

const allRooms = JSON.parse(document.getElementById('room-index-data').textContent);
const panel = document.getElementById('filter-panel');
const toggleBtn = document.getElementById('filter-toggle');
const backdrop = document.getElementById('filter-backdrop');
let map;
let markerClusterGroup;
let markersByRoomId = new Map();
let syncingMarkers = false;

function isMobileFilterSheet() {
  return window.matchMedia('(max-width: 720px)').matches;
}

function setPanelExpanded(expanded) {
  panel.classList.toggle('collapsed', !expanded);
  toggleBtn.classList.toggle('open', expanded);
  toggleBtn.setAttribute('aria-expanded', String(expanded));
  backdrop.hidden = !expanded;
  document.body.classList.toggle('filters-open', expanded && isMobileFilterSheet());
  if (expanded && isMobileFilterSheet()) document.getElementById('filter-close').focus();
  setTimeout(() => map.invalidateSize(), 300);
}

function syncPanelEnvironment() {
  const expanded = !panel.classList.contains('collapsed');
  const mobile = isMobileFilterSheet();
  backdrop.hidden = !expanded || !mobile;
  document.body.classList.toggle('filters-open', expanded && mobile);
}

function filterRooms(filters) {
  return allRooms.filter((room) => roomMatchesFilters(room, filters));
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
  return STATUS_CONFIG[room.status]?.color || '#6B7280';
}

function createMarkerIcon(room) {
  const color = getMarkerColor(room);
  const isPlanned = room.status === 'Scheduled';
  const svg = `
    <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
        fill="${color}" fill-opacity="${isPlanned ? 0.6 : 1}"
        stroke="${isPlanned ? color : 'none'}" stroke-width="${isPlanned ? 2 : 0}"
        stroke-dasharray="${isPlanned ? '4,3' : 'none'}"/>
      <circle cx="14" cy="14" r="6" fill="${isPlanned ? 'transparent' : '#0E1116'}"/>
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

function buildPopup(room, filters) {
  const gameName = escapeHtml(room.game);
  const companyName = escapeHtml(room.company?.name || 'Unknown Company');
  const returnParams = buildFilterParams(filters, { room: room.id }).toString();
  const returnPath = `/map/${returnParams ? `?${returnParams}` : ''}`;
  const detailUrl = `${roomUrl(room)}?from=${encodeURIComponent(returnPath)}`;
  const fallbackImage = popupFallbackImage(room);
  const dateStr = room.date ? escapeHtml(formatDate(room.date)) : '';
  const { primary: locationPrimary, secondary: locationSecondary } = popupLocationParts(room.location);
  const statusClass = STATUS_CONFIG[room.status]?.cssClass || '';
  const statusLabel = STATUS_CONFIG[room.status]?.label || room.status;

  return `
    <div class="popup-room">
      <div class="room-card${room.photo ? ' room-card-has-photo' : ' room-card-no-photo'}" data-room-id="${room.id}">
        <a href="${detailUrl}" class="room-card-link" data-tinylytics-event="map.view-room" data-tinylytics-event-value="${gameName}">
          ${room.photo
            ? `<div class="room-card-thumb"><img src="/images/rooms/${escapeHtml(room.photo)}" alt="${gameName}" loading="lazy" decoding="async"></div>`
            : `<div class="room-card-fallback" aria-hidden="true"><img src="${fallbackImage}" alt="" loading="lazy" decoding="async"></div>`}
          <div class="room-card-top-left">
            <div class="room-card-badge">
              <span class="room-card-badge-label">Room</span>
              <span class="room-card-badge-number">${room.id}</span>
            </div>
            <span class="room-card-status ${statusClass}">${escapeHtml(statusLabel.replace(/^[✓✗]\s*/, ''))}</span>
          </div>
          ${dateStr ? `<div class="room-card-top-right"><div class="room-card-date">${dateStr}</div></div>` : ''}
          <div class="room-card-bottom">
            <h3 class="room-card-room">${gameName}</h3>
            <div class="room-card-company">${companyName}</div>
            ${room.awards && room.awards.length ? `<div class="room-card-awards">🏆 ${room.awards.length}</div>` : ''}
            <div class="room-card-bottom-right">
              ${locationPrimary ? `<div class="room-card-location-primary">${escapeHtml(locationPrimary)}</div>` : ''}
              ${locationSecondary ? `<div class="room-card-location-secondary">${escapeHtml(locationSecondary)}</div>` : ''}
            </div>
          </div>
        </a>
      </div>
    </div>`;
}

function getCurrentFilters() {
  return readFiltersFromControls();
}

function updateMapSummary(filters, rooms, mappable) {
  const missing = rooms.length - mappable.length;
  document.getElementById('map-results').textContent = `${mappable.length} mapped room${mappable.length === 1 ? '' : 's'}${missing ? ` · ${missing} without coordinates` : ''}`;
  document.getElementById('filter-apply').textContent = `Show ${mappable.length} location${mappable.length === 1 ? '' : 's'}`;

  const activeCount = FILTER_FIELDS.filter((field) => {
    const emptyValue = field.emptyValue || '';
    return filters[field.key] && filters[field.key] !== emptyValue;
  }).length;
  const filterCount = document.getElementById('filter-count');
  filterCount.textContent = String(activeCount);
  filterCount.hidden = activeCount === 0;
  document.getElementById('clear-filters').hidden = activeCount === 0;

  const params = buildFilterParams(filters).toString();
  document.getElementById('map-view-link').href = `/rooms/${params ? `?${params}` : ''}`;
}

function openSelectedMarker(roomId) {
  const marker = markersByRoomId.get(roomId);
  if (!marker) {
    syncingMarkers = false;
    return;
  }
  markerClusterGroup.zoomToShowLayer(marker, () => {
    marker.openPopup();
    syncingMarkers = false;
  });
}

function updateMarkers({ historyMode = 'replace', writeUrl = true, selectedRoom = null } = {}) {
  const filters = getCurrentFilters();
  if (writeUrl) setFilterParams(filters, { historyMode });

  const rooms = filterRooms(filters);
  const mappable = rooms.filter((room) => room.location?.lat != null && room.location?.lng != null);
  updateMapSummary(filters, rooms, mappable);

  syncingMarkers = true;
  markerClusterGroup.clearLayers();
  markersByRoomId = new Map();

  mappable.forEach((room) => {
    const marker = L.marker([room.location.lat, room.location.lng], {
      icon: createMarkerIcon(room),
      title: `#${room.id} ${room.game}`,
      alt: `#${room.id} ${room.game}`
    });
    marker.bindPopup(buildPopup(room, filters), {
      className: 'map-room-popup',
      maxWidth: 360
    });
    marker.on('popupopen', () => {
      document.body.classList.add('map-popup-open');
      if (syncingMarkers) return;
      setFilterParams(getCurrentFilters(), { room: room.id, historyMode: 'push' });
    });
    marker.on('popupclose', () => {
      document.body.classList.remove('map-popup-open');
      if (syncingMarkers || getSelectedRoomParam() !== room.id) return;
      setFilterParams(getCurrentFilters(), { historyMode: 'replace' });
    });
    markersByRoomId.set(room.id, marker);
    markerClusterGroup.addLayer(marker);
  });

  if (mappable.length > 0) {
    map.fitBounds(markerClusterGroup.getBounds(), { padding: [40, 40] });
  }

  if (selectedRoom && markersByRoomId.has(selectedRoom)) {
    openSelectedMarker(selectedRoom);
  } else {
    syncingMarkers = false;
  }
}

function applyUrlState() {
  const filters = getFilterParams();
  applyFiltersToControls(filters);
  const selectedRoom = getSelectedRoomParam();
  setPanelExpanded(hasActiveFilters(filters) && !selectedRoom && !isMobileFilterSheet());
  updateMarkers({ writeUrl: false, selectedRoom });
}

function bindEvents() {
  toggleBtn.addEventListener('click', () => setPanelExpanded(panel.classList.contains('collapsed')));
  document.getElementById('filter-close').addEventListener('click', () => setPanelExpanded(false));
  document.getElementById('filter-apply').addEventListener('click', () => setPanelExpanded(false));
  backdrop.addEventListener('click', () => setPanelExpanded(false));
  bindFilterControls(() => updateMarkers({ historyMode: 'push' }));
  window.addEventListener('popstate', applyUrlState);
  window.addEventListener('resize', syncPanelEnvironment);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.classList.contains('collapsed')) setPanelExpanded(false);
  });
}

function init() {
  initNav();
  initMap();
  applyUrlState();
  bindEvents();
}

init();
