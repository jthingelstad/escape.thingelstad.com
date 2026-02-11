import {
  getAllTags, getAllYears, getAllCountries, getAllPlayers,
  filterRooms, formatDate, formatLocation, renderTag,
  getFilterParams, setFilterParams, initNav
} from './data.js';

let map;
let markerClusterGroup;

async function init() {
  initNav();
  initMap();
  await populateFilterOptions();
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
  if (room.status === 'planned') return '#60a5fa';
  if ((room.tags || []).includes('best')) return '#e6b84f';
  if (room.win === true) return '#48d989';
  if (room.win === false) return '#f06060';
  return '#9a97a8';
}

function createMarkerIcon(room) {
  const color = getMarkerColor(room);
  const isPlanned = room.status === 'planned';
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
  const statusHtml = room.status === 'planned'
    ? '<span class="status-badge status-planned">Planned</span>'
    : room.win === true
      ? '<span class="status-badge status-win">\u2713 Escaped</span>'
      : room.win === false
        ? '<span class="status-badge status-loss">\u2717 Locked Out</span>'
        : '';

  const tagsHtml = (room.tags || []).map(renderTag).join('');
  const locationStr = formatLocation(room.location);
  const dateStr = formatDate(room.date);

  const blogHtml = room.blogUrl
    ? `<a href="${room.blogUrl}" target="_blank" rel="noopener" style="color: #4fd1c5; font-size: 0.8rem;">Read post \u2192</a>`
    : '';

  return `
    <div>
      <h3>#${room.id} ${room.game}</h3>
      <div class="popup-meta">
        ${room.companyUrl ? `<a href="${room.companyUrl}" target="_blank" rel="noopener" style="color: #4fd1c5;">${room.company}</a>` : room.company}<br>
        ${dateStr}${locationStr ? ' &middot; ' + locationStr : ''}
        ${room.escapeTime ? ' &middot; ' + room.escapeTime : ''}
      </div>
      ${statusHtml}
      ${tagsHtml ? `<div class="popup-tags">${tagsHtml}</div>` : ''}
      ${blogHtml}
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

async function populateFilterOptions() {
  const tags = await getAllTags();
  const years = await getAllYears();
  const countries = await getAllCountries();
  const players = await getAllPlayers();

  const tagSelect = document.getElementById('filter-tag');
  tags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    tagSelect.appendChild(opt);
  });

  const yearSelect = document.getElementById('filter-year');
  [...years].reverse().forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  const countrySelect = document.getElementById('filter-country');
  countries.forEach(country => {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = country;
    countrySelect.appendChild(opt);
  });

  const playerSelect = document.getElementById('filter-player');
  players.forEach(player => {
    const opt = document.createElement('option');
    opt.value = player;
    opt.textContent = player;
    playerSelect.appendChild(opt);
  });
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
    document.getElementById(id).addEventListener('change', updateMarkers);
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
