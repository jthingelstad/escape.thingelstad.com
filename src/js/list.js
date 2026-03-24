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

const roomIndex = JSON.parse(document.getElementById('room-index-data').textContent);
const roomById = Object.fromEntries(roomIndex.map((room) => [String(room.id), room]));

const container = document.getElementById('room-list');
const allCards = [...container.querySelectorAll('.room-card')];

function init() {
  initNav();
  applyUrlFilters();
  bindEvents();
}

function applyUrlFilters() {
  applyFiltersToControls(getFilterParams());
  updateResults();
}

function getCurrentFilters() {
  return readFiltersFromControls();
}

function sortCardsByDate(cards) {
  return [...cards].sort((cardLeft, cardRight) => {
    const left = roomById[cardLeft.dataset.roomId];
    const right = roomById[cardRight.dataset.roomId];
    const dateLeft = left.date || '';
    const dateRight = right.date || '';
    if (dateLeft < dateRight) return 1;
    if (dateLeft > dateRight) return -1;
    return right.id - left.id;
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

  const sorted = sortCardsByDate(visible);
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
}

init();
