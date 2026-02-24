import {
  filterRooms, formatDate, formatLocation, renderTag,
  getFilterParams, setFilterParams, initNav, statusBadgeHtml
} from './data.js';

let map;
let markerClusterGroup;

async function init() {
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
  if ((room.tags || []).includes('best')) return '#e6b84f';
  switch (room.status) {
    case 'Escaped': return '#48d989';
    case 'Try again': return '#f06060';
    case 'Completed': return '#9a97a8';
    case 'Scheduled': return '#60a5fa';
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
  const statusHtml = statusBadgeHtml(room.status);

  const tagsHtml = (room.tags || []).map(renderTag).join('');
  const locationStr = formatLocation(room.location);
  const dateStr = formatDate(room.date);

  const photoHtml = room.photoUrl
    ? `<div class="popup-photo"><img src="${room.photoUrl}" alt="${room.game} at ${room.company}"></div>`
    : '';

  const blogHtml = room.blogUrl
    ? `<a href="${room.blogUrl}" target="_blank" rel="noopener" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.blog-post" data-tinylytics-event-value="${room.game}">Read post \u2192</a>`
    : '';

  const mortyHtml = room.mortyId
    ? `<a href="https://morty.app/attraction/${room.mortyId}" target="_blank" rel="noopener" style="color: var(--accent-teal); font-size: 0.8rem;" data-tinylytics-event="map.morty" data-tinylytics-event-value="${room.game}">Morty \u2192</a>`
    : '';

  return `
    <div class="popup-room">
      ${photoHtml}
      <div class="popup-content">
        <h3>#${room.id} ${room.game}</h3>
        <div class="popup-meta">
          ${room.companyUrl ? `<a href="${room.companyUrl}" target="_blank" rel="noopener" data-tinylytics-event="map.company" data-tinylytics-event-value="${room.company}">${room.company}</a>` : room.company}<br>
          ${dateStr}${locationStr ? ' &middot; ' + locationStr : ''}
          ${room.escapeTime ? ' &middot; ' + room.escapeTime : ''}
        </div>
        ${statusHtml}
        ${tagsHtml ? `<div class="popup-tags">${tagsHtml}</div>` : ''}
        <div class="popup-links">${blogHtml} ${mortyHtml}</div>
      </div>
    </div>
  `;
}

async function updateMarkers() {
  const filters = getCurrentFilters();
  setFilterParams(filters);

  const clearBtn = document.getElementById('clear-filters');
  const hasFilters = filters.q || filters.tag || filters.year ||
    (filters.status && filters.status !== 'all') || filters.country || filters.player;
  clearBtn.style.display = hasFilters ? '' : 'none';

  const rooms = await filterRooms(filters);
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
