import {
  FILTER_FIELDS,
  applyFiltersToControls,
  bindFilterControls,
  getFilterParams,
  getSelectedFilterLabel,
  hasActiveFilters,
  initNav,
  readFiltersFromControls,
  roomMatchesFilters,
  setFilterParams
} from './data.js';

let currentSort = 'date';
let currentDir = 'desc';

const roomIndex = JSON.parse(document.getElementById('room-index-data').textContent);
const roomById = Object.fromEntries(roomIndex.map((room) => [String(room.id), room]));

const container = document.getElementById('room-list');
const allCards = [...container.querySelectorAll('.room-card')];

function buildOmniboxTerm(field, value) {
  switch (field.key) {
    case 'year':
      return `year ${value}`;
    case 'status':
      return `status ${value}`;
    case 'country':
      return `country ${value}`;
    default:
      return `${field.key} ${value}`;
  }
}

function collapseTypedFiltersIntoSearch(filters) {
  const collapsed = { ...filters };
  const searchParts = [];

  if (collapsed.q) searchParts.push(collapsed.q);

  FILTER_FIELDS.forEach((field) => {
    const emptyValue = field.emptyValue || '';
    const value = collapsed[field.key];
    if (!value || value === emptyValue) return;

    const label = getSelectedFilterLabel(field.key);
    if (!label) return;
    searchParts.push(buildOmniboxTerm(field, label));
    collapsed[field.key] = emptyValue;
  });

  return {
    ...collapsed,
    q: searchParts.join(' ').trim()
  };
}

function init() {
  initNav();
  applyUrlFilters();
  bindEvents();
}

function applyUrlFilters() {
  const filters = getFilterParams();
  applyFiltersToControls(filters);

  const collapsedFilters = collapseTypedFiltersIntoSearch(filters);
  const filtersChanged = JSON.stringify(filters) !== JSON.stringify(collapsedFilters);

  applyFiltersToControls(collapsedFilters);
  if (filtersChanged) setFilterParams(collapsedFilters);
  updateResults();
}

function getCurrentFilters() {
  return readFiltersFromControls();
}

function compareRooms(left, right, field, dir) {
  let valueLeft = '';
  let valueRight = '';

  switch (field) {
    case 'game':
      valueLeft = left.game || '';
      valueRight = right.game || '';
      break;
    case 'company':
      valueLeft = left.company?.name || '';
      valueRight = right.company?.name || '';
      break;
    case 'city':
      valueLeft = left.location?.city || '';
      valueRight = right.location?.city || '';
      break;
    case 'date':
    default:
      valueLeft = left.date || '';
      valueRight = right.date || '';
      break;
  }

  if (valueLeft < valueRight) return dir === 'asc' ? -1 : 1;
  if (valueLeft > valueRight) return dir === 'asc' ? 1 : -1;
  if (field === 'date') return dir === 'asc' ? left.id - right.id : right.id - left.id;
  return left.id - right.id;
}

function sortCards(cards, field, dir) {
  return [...cards].sort((cardLeft, cardRight) => {
    const roomLeft = roomById[cardLeft.dataset.roomId];
    const roomRight = roomById[cardRight.dataset.roomId];
    return compareRooms(roomLeft, roomRight, field, dir);
  });
}

function updateResults() {
  const filters = getCurrentFilters();
  setFilterParams(filters);

  const clearBtn = document.getElementById('clear-filters');
  clearBtn.hidden = !hasActiveFilters(filters);

  updateActiveFilterPills(filters);

  const visible = [];
  allCards.forEach((card) => {
    const room = roomById[card.dataset.roomId];
    const matches = roomMatchesFilters(room, filters);
    card.hidden = !matches;
    if (matches) visible.push(card);
  });

  const sorted = sortCards(visible, currentSort, currentDir);
  sorted.forEach((card) => {
    container.appendChild(card);
  });

  const total = allCards.length;
  const count = visible.length;
  document.getElementById('results-count').textContent =
    count === total ? `Showing all ${total} rooms` : `Showing ${count} of ${total} rooms`;

  let empty = container.querySelector('.empty-state');
  if (count === 0) {
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No rooms match your filters.';
      container.appendChild(empty);
    }
    empty.hidden = false;
  } else if (empty) {
    empty.hidden = true;
  }
}

function makePill(text, onRemove) {
  const pill = document.createElement('span');
  pill.className = 'active-filter-pill';
  pill.innerHTML = `${text} <button aria-label="Remove filter">&times;</button>`;
  pill.querySelector('button').addEventListener('click', onRemove);
  return pill;
}

function updateActiveFilterPills(filters) {
  const containerEl = document.getElementById('active-filters');
  const pills = [];

  if (filters.q) {
    pills.push(makePill(`Search: "${filters.q}"`, () => {
      document.getElementById('filter-search').value = '';
      updateResults();
    }));
  }

  FILTER_FIELDS.forEach((field) => {
    const emptyValue = field.emptyValue || '';
    const value = filters[field.key];
    if (!value || value === emptyValue) return;

    pills.push(makePill(`${field.label}: ${getSelectedFilterLabel(field.key)}`, () => {
      document.getElementById(field.elementId).value = emptyValue;
      updateResults();
    }));
  });

  containerEl.innerHTML = '';
  pills.forEach((pill) => containerEl.appendChild(pill));
}

function bindEvents() {
  bindFilterControls(updateResults);

  document.querySelectorAll('.sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort;
      if (currentSort === field) {
        currentDir = currentDir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = field;
        currentDir = field === 'date' ? 'desc' : 'asc';
      }

      document.querySelectorAll('.sort-btn').forEach((button) => {
        button.classList.remove('active');
        button.textContent = button.dataset.sort.charAt(0).toUpperCase() + button.dataset.sort.slice(1);
      });
      btn.classList.add('active');
      btn.textContent = btn.dataset.sort.charAt(0).toUpperCase() + btn.dataset.sort.slice(1)
        + (currentDir === 'desc' ? ' \u25BC' : ' \u25B2');

      updateResults();
    });
  });
}

init();
