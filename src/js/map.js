import {
  escapeHtml, formatDate, formatLocation, renderTag,
  getFilterParams, setFilterParams, initNav, statusBadgeHtml,
  formatTimeLeft, roomUrl
} from './data.js';

const allRooms = JSON.parse(document.getElementById('map-rooms-data').textContent);
let map;
let markerClusterGroup;

function filterRooms(filters) {
  return allRooms.filter(room => {
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const searchable = [
        room.game,
        room.company,
        room.location?.city,
        room.location?.region,
        room.notes
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    if (filters.tag) {
      const filterTags = filters.tag.split(',').map(t => t.trim());
      if (!filterTags.every(ft => (room.tags || []).includes(ft))) return false;
    }

    if (filters.year) {
      if (!room.date || room.date.substring(0, 4) !== filters.year) return false;
    }

    if (filters.status && filters.status !== 'all') {
      if (room.status !== filters.status) return false;
    }

    if (filters.country) {
      if (!room.location || room.location.country !== filters.country) return false;
    }

    if (filters.player) {
      if (!(room.players || []).includes(filters.player)) return false;
    }

    return true;
  });
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
  if ((room.tags || []).includes('best')) return '#e8924f';
  switch (room.status) {
    case 'Escaped': return '#48d989';
    case 'Try again': return '#f06060';
    case 'Completed': return '#9a97a8';
    case 'Scheduled': return '#5a8bff';
    default: return '#9a97a8';
  }
}

function createMarkerIcon(room) {
  const color = getMarkerColor(room);
  const isPlanned = room.status === 'Scheduled';
  const isBest = (room.tags || []).includes('best');

  const svg = `
    <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
        fill="${color}" fill-opacity="${isPlanned ? 0.6 : 1}"
        stroke="${isPlanned ? color : 'none'}" stroke-width="${isPlanned ? 2 : 0}"
        stroke-dasharray="${isPlanned ? '4,3' : 'none'}"/>
      <circle cx="14" cy="14" r="6" fill="${isPlanned ? 'transparent' : '#0f0f1a'}"/>
      ${isBest ? '<text x="14" y="18" text-anchor="middle" font-size="12" fill="#0f0f1a">\u2605</text>' : ''}
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
  const companyName = escapeHtml(room.company);
  const statusHtml = statusBadgeHtml(room.status);

  const tagsHtml = (room.tags || []).map(renderTag).join('');
  const locationStr = escapeHtml(formatLocation(room.location));
  const dateStr = formatDate(room.date);

  const photoHtml = room.photo
    ? `<div class="popup-photo"><img src="/images/rooms/${escapeHtml(room.photo)}" alt="${gameName} at ${companyName}"></div>`
    : '';

  const blogHtml = room.blogUrl
    ? `<a href="${escapeHtml(room.blogUrl)}" target="_blank" rel="noopener" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.blog-post" data-tinylytics-event-value="${gameName}">Read post \u2192</a>`
    : '';

  const mortyHtml = room.mortyId
    ? `<a href="https://morty.app/attraction/${room.mortyId}" target="_blank" rel="noopener" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.morty" data-tinylytics-event-value="${gameName}">Morty \u2192</a>`
    : '';

  const detailUrl = roomUrl(room);

  return `
    <div class="popup-room">
      ${photoHtml}
      <div class="popup-content">
        <h3><a href="${detailUrl}" style="color: inherit; text-decoration: none;" data-tinylytics-event="map.view-room" data-tinylytics-event-value="${gameName}">#${room.id} ${gameName}</a></h3>
        <div class="popup-meta">
          ${room.companyUrl ? `<a href="${escapeHtml(room.companyUrl)}" target="_blank" rel="noopener" data-tinylytics-event="map.company" data-tinylytics-event-value="${companyName}">${companyName}</a>` : companyName}<br>
          ${dateStr}${locationStr ? ' &middot; ' + locationStr : ''}
          ${room.timeLeft != null ? ' &middot; ' + escapeHtml(formatTimeLeft(room.timeLeft)) : ''}
        </div>
        ${statusHtml}
        ${tagsHtml ? `<div class="popup-tags">${tagsHtml}</div>` : ''}
        <div class="popup-links">
          <a href="${detailUrl}" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.view-room" data-tinylytics-event-value="${gameName}">View details &rarr;</a>
          ${blogHtml} ${mortyHtml}
        </div>
      </div>
    </div>
  `;
}

function updateMarkers() {
  const filters = getCurrentFilters();
  setFilterParams(filters);

  const clearBtn = document.getElementById('clear-filters');
  const hasFilters = filters.q || filters.tag || filters.year ||
    (filters.status && filters.status !== 'all') || filters.country || filters.player;
  clearBtn.style.display = hasFilters ? '' : 'none';

  const rooms = filterRooms(filters);
  const mappable = rooms.filter(r => r.location && r.location.lat != null && r.location.lng != null);

  markerClusterGroup.clearLayers();

  mappable.forEach(room => {
    const marker = L.marker([room.location.lat, room.location.lng], {
      icon: createMarkerIcon(room)
    });
    marker.bindPopup(buildPopup(room), { maxWidth: 300 });
    markerClusterGroup.addLayer(marker);
  });

  if (mappable.length > 0) {
    const bounds = markerClusterGroup.getBounds();
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

function getCurrentFilters() {
  return {
    q: document.getElementById('filter-search').value.trim(),
    tag: document.getElementById('filter-tag').value,
    year: document.getElementById('filter-year').value,
    status: document.getElementById('filter-status').value,
    country: document.getElementById('filter-country').value,
    player: document.getElementById('filter-player').value
  };
}

function applyUrlFilters() {
  const filters = getFilterParams();
  document.getElementById('filter-search').value = filters.q;
  document.getElementById('filter-year').value = filters.year;
  document.getElementById('filter-status').value = filters.status || 'all';
  document.getElementById('filter-country').value = filters.country;
  document.getElementById('filter-player').value = filters.player;

  if (filters.tag) {
    document.getElementById('filter-tag').value = filters.tag.split(',')[0];
  }

  updateMarkers();
}

function bindEvents() {
  // Filter panel toggle
  const toggleBtn = document.getElementById('filter-toggle');
  const panel = document.getElementById('filter-panel');
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    toggleBtn.classList.toggle('open');
    setTimeout(() => map.invalidateSize(), 350);
  });

  let searchTimeout;
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(updateMarkers, 200);
  });

  ['filter-tag', 'filter-year', 'filter-status', 'filter-country', 'filter-player'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateMarkers);
  });

  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-tag').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-country').value = '';
    document.getElementById('filter-player').value = '';
    updateMarkers();
  });
}

init();
