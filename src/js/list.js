import {
  getRooms, filterRooms, renderRoomCard, getFilterParams, setFilterParams,
  initNav
} from './data.js';

let allRooms = [];
let currentSort = 'date';
let currentDir = 'desc';

async function init() {
  initNav();
  allRooms = await getRooms();

  applyUrlFilters();
  bindEvents();
}

function applyUrlFilters() {
  const filters = getFilterParams();

  document.getElementById('filter-search').value = filters.q;
  document.getElementById('filter-year').value = filters.year;
  document.getElementById('filter-status').value = filters.status || 'all';
  const winEl = document.getElementById('filter-win');
  if (winEl) winEl.value = filters.win || 'all';
  document.getElementById('filter-country').value = filters.country;
  document.getElementById('filter-player').value = filters.player;

  // For tags, set the first tag in the select (multi-tag via URL still works for filtering)
  if (filters.tag) {
    const firstTag = filters.tag.split(',')[0];
    document.getElementById('filter-tag').value = firstTag;
  }

  updateResults();
}

function getCurrentFilters() {
  return {
    q: document.getElementById('filter-search').value.trim(),
    tag: document.getElementById('filter-tag').value,
    year: document.getElementById('filter-year').value,
    status: document.getElementById('filter-status').value,
    win: (document.getElementById('filter-win') || {}).value || 'all',
    country: document.getElementById('filter-country').value,
    player: document.getElementById('filter-player').value
  };
}

function hasActiveFilters(filters) {
  return filters.q || filters.tag || filters.year ||
    (filters.status && filters.status !== 'all') ||
    (filters.win && filters.win !== 'all') ||
    filters.country || filters.player;
}

async function updateResults() {
  const filters = getCurrentFilters();
  setFilterParams(filters);

  const clearBtn = document.getElementById('clear-filters');
  clearBtn.style.display = hasActiveFilters(filters) ? '' : 'none';

  updateActiveFilterPills(filters);

  let rooms = await filterRooms(filters);
  rooms = sortRooms(rooms, currentSort, currentDir);

  const total = allRooms.length;
  const count = rooms.length;
  document.getElementById('results-count').textContent =
    count === total ? `Showing all ${total} rooms` : `Showing ${count} of ${total} rooms`;

  const container = document.getElementById('room-list');
  if (rooms.length === 0) {
    container.innerHTML = '<div class="empty-state">No rooms match your filters.</div>';
  } else {
    container.innerHTML = rooms.map(r => renderRoomCard(r)).join('');
  }
}

function updateActiveFilterPills(filters) {
  const container = document.getElementById('active-filters');
  const pills = [];

  if (filters.q) {
    pills.push(makePill(`Search: "${filters.q}"`, () => {
      document.getElementById('filter-search').value = '';
      updateResults();
    }));
  }
  if (filters.tag) {
    filters.tag.split(',').forEach(tag => {
      pills.push(makePill(`Tag: ${tag}`, () => {
        document.getElementById('filter-tag').value = '';
        updateResults();
      }));
    });
  }
  if (filters.year) {
    pills.push(makePill(`Year: ${filters.year}`, () => {
      document.getElementById('filter-year').value = '';
      updateResults();
    }));
  }
  if (filters.status && filters.status !== 'all') {
    pills.push(makePill(`Status: ${filters.status}`, () => {
      document.getElementById('filter-status').value = 'all';
      updateResults();
    }));
  }
  if (filters.win && filters.win !== 'all') {
    pills.push(makePill(`Result: ${filters.win}`, () => {
      const winEl = document.getElementById('filter-win');
      if (winEl) winEl.value = 'all';
      updateResults();
    }));
  }
  if (filters.country) {
    pills.push(makePill(`Country: ${filters.country}`, () => {
      document.getElementById('filter-country').value = '';
      updateResults();
    }));
  }
  if (filters.player) {
    pills.push(makePill(`Player: ${filters.player}`, () => {
      document.getElementById('filter-player').value = '';
      updateResults();
    }));
  }

  container.innerHTML = '';
  pills.forEach(p => container.appendChild(p));
}

function makePill(text, onRemove) {
  const pill = document.createElement('span');
  pill.className = 'active-filter-pill';
  pill.innerHTML = `${text} <button aria-label="Remove filter">&times;</button>`;
  pill.querySelector('button').addEventListener('click', onRemove);
  return pill;
}

function sortRooms(rooms, field, dir) {
  const sorted = [...rooms].sort((a, b) => {
    let valA, valB;
    switch (field) {
      case 'date':
        valA = a.date || '';
        valB = b.date || '';
        break;
      case 'game':
        valA = (a.game || '').toLowerCase();
        valB = (b.game || '').toLowerCase();
        break;
      case 'company':
        valA = (a.company || '').toLowerCase();
        valB = (b.company || '').toLowerCase();
        break;
      case 'city':
        valA = (a.location?.city || '').toLowerCase();
        valB = (b.location?.city || '').toLowerCase();
        break;
      default:
        valA = a.date || '';
        valB = b.date || '';
    }
    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

function bindEvents() {
  let searchTimeout;
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(updateResults, 200);
  });

  ['filter-tag', 'filter-year', 'filter-status', 'filter-win', 'filter-country', 'filter-player'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateResults);
  });

  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-tag').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-status').value = 'all';
    const winEl = document.getElementById('filter-win');
    if (winEl) winEl.value = 'all';
    document.getElementById('filter-country').value = '';
    document.getElementById('filter-player').value = '';
    updateResults();
  });

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort;
      if (currentSort === field) {
        currentDir = currentDir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = field;
        currentDir = field === 'date' ? 'desc' : 'asc';
      }

      document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.remove('active');
        b.textContent = b.dataset.sort.charAt(0).toUpperCase() + b.dataset.sort.slice(1);
      });
      btn.classList.add('active');
      btn.textContent = btn.dataset.sort.charAt(0).toUpperCase() + btn.dataset.sort.slice(1) +
        (currentDir === 'desc' ? ' \u25BC' : ' \u25B2');

      updateResults();
    });
  });
}

init();
