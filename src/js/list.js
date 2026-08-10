import {
  FILTER_FIELDS,
  applyFiltersToControls,
  bindFilterControls,
  buildFilterParams,
  getFilterParams,
  getSelectedFilterLabel,
  getSortParam,
  hasActiveFilters,
  initNav,
  readFiltersFromControls,
  roomMatchesFilters,
  setFilterParams
} from './data.js';

const roomIndex = JSON.parse(document.getElementById('room-index-data').textContent);
const roomByAirtableId = Object.fromEntries(roomIndex.map((room) => [room.airtableId, room]));
const container = document.getElementById('room-list');
const allCards = [...container.querySelectorAll('.room-card')];
const panel = document.getElementById('filter-panel');
const toggleBtn = document.getElementById('filter-toggle');
const backdrop = document.getElementById('filter-backdrop');
const sortControl = document.getElementById('sort-rooms');

function isMobileFilterSheet() {
  return window.matchMedia('(max-width: 720px)').matches;
}

function setPanelExpanded(expanded) {
  panel.classList.toggle('collapsed', !expanded);
  toggleBtn.classList.toggle('open', expanded);
  toggleBtn.setAttribute('aria-expanded', String(expanded));
  backdrop.hidden = !expanded;
  document.body.classList.toggle('filters-open', expanded && isMobileFilterSheet());
  if (expanded && isMobileFilterSheet()) {
    document.getElementById('filter-close').focus();
  }
}

function syncPanelEnvironment() {
  const expanded = !panel.classList.contains('collapsed');
  const mobile = isMobileFilterSheet();
  backdrop.hidden = !expanded || !mobile;
  document.body.classList.toggle('filters-open', expanded && mobile);
}

function getCurrentFilters() {
  return readFiltersFromControls();
}

function roomRating(room) {
  return room.ratingSummary?.average == null ? Number.NEGATIVE_INFINITY : room.ratingSummary.average;
}

function sortCards(cards, sort) {
  return [...cards].sort((leftCard, rightCard) => {
    const left = roomByAirtableId[leftCard.dataset.airtableId];
    const right = roomByAirtableId[rightCard.dataset.airtableId];

    if (sort === 'oldest') {
      return (left.date || '').localeCompare(right.date || '') || left.number - right.number;
    }
    if (sort === 'rating') {
      return roomRating(right) - roomRating(left) || (right.date || '').localeCompare(left.date || '') || right.number - left.number;
    }
    if (sort === 'room') return right.number - left.number;
    return (right.date || '').localeCompare(left.date || '') || right.number - left.number;
  });
}

function makePill(text, onRemove) {
  const pill = document.createElement('span');
  pill.className = 'active-filter-pill';
  pill.appendChild(document.createTextNode(`${text} `));
  const button = document.createElement('button');
  button.setAttribute('aria-label', `Remove ${text}`);
  button.textContent = '×';
  button.addEventListener('click', onRemove);
  pill.appendChild(button);
  return pill;
}

function updateActiveFilterPills(filters) {
  const containerEl = document.getElementById('active-filters');
  const pills = [];

  FILTER_FIELDS.forEach((field) => {
    const emptyValue = field.emptyValue || '';
    const value = filters[field.key];
    if (!value || value === emptyValue) return;

    const text = `${field.label}: ${getSelectedFilterLabel(field.key)}`;
    pills.push(makePill(text, () => {
      document.getElementById(field.elementId).value = emptyValue;
      updateResults({ historyMode: 'push' });
    }));
  });

  containerEl.innerHTML = '';
  pills.forEach((pill) => containerEl.appendChild(pill));
}

function updateRoomLinks() {
  const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  allCards.forEach((card) => {
    const link = card.querySelector('.room-card-link');
    const roomPath = link.dataset.roomPath;
    link.href = `${roomPath}?from=${encodeURIComponent(returnPath)}`;
  });
}

function updateViewLink(filters) {
  const params = buildFilterParams(filters);
  const search = params.toString();
  document.getElementById('catalog-view-link').href = `/map/${search ? `?${search}` : ''}`;
}

function updateEmptyState(count) {
  let empty = container.querySelector('.empty-state');
  if (count > 0) {
    if (empty) empty.hidden = true;
    return;
  }

  if (!empty) {
    empty = document.createElement('div');
    empty.className = 'empty-state';
    const message = document.createElement('p');
    message.textContent = 'No rooms match this combination yet.';
    const clear = document.createElement('button');
    clear.className = 'btn';
    clear.type = 'button';
    clear.textContent = 'Clear filters';
    clear.addEventListener('click', () => document.getElementById('clear-filters').click());
    empty.append(message, clear);
    container.appendChild(empty);
  }
  empty.hidden = false;
}

function updateResults({ historyMode = 'replace', writeUrl = true } = {}) {
  const filters = getCurrentFilters();
  const sort = sortControl.value;
  if (writeUrl) setFilterParams(filters, { sort, historyMode });

  const activeCount = FILTER_FIELDS.filter((field) => {
    const emptyValue = field.emptyValue || '';
    return filters[field.key] && filters[field.key] !== emptyValue;
  }).length;
  const clearBtn = document.getElementById('clear-filters');
  clearBtn.hidden = activeCount === 0;
  const filterCount = document.getElementById('filter-count');
  filterCount.textContent = String(activeCount);
  filterCount.hidden = activeCount === 0;

  updateActiveFilterPills(filters);

  const visible = [];
  allCards.forEach((card) => {
    const room = roomByAirtableId[card.dataset.airtableId];
    const matches = roomMatchesFilters(room, filters);
    card.hidden = !matches;
    if (matches) visible.push(card);
  });

  sortCards(visible, sort).forEach((card) => container.appendChild(card));

  const total = allCards.length;
  const count = visible.length;
  document.getElementById('results-count').textContent =
    count === total ? `Showing all ${total} rooms` : `Showing ${count} of ${total} rooms`;
  document.getElementById('filter-apply').textContent = `Show ${count} room${count === 1 ? '' : 's'}`;

  updateEmptyState(count);
  updateViewLink(filters);
  updateRoomLinks();
}

function applyUrlState() {
  const filters = getFilterParams();
  applyFiltersToControls(filters);
  sortControl.value = getSortParam();
  setPanelExpanded(hasActiveFilters(filters) && !isMobileFilterSheet());
  updateResults({ writeUrl: false });

  const publicRoomMatch = window.location.hash.match(/^#room-(\d+)$/);
  if (publicRoomMatch) {
    const card = document.getElementById(`room-${publicRoomMatch[1]}`);
    if (card && !card.hidden) {
      card.classList.add('room-card-highlight');
      card.scrollIntoView({ block: 'center' });
    }
  }
}

function bindEvents() {
  toggleBtn.addEventListener('click', () => setPanelExpanded(panel.classList.contains('collapsed')));
  document.getElementById('filter-close').addEventListener('click', () => setPanelExpanded(false));
  document.getElementById('filter-apply').addEventListener('click', () => setPanelExpanded(false));
  backdrop.addEventListener('click', () => setPanelExpanded(false));
  sortControl.addEventListener('change', () => updateResults({ historyMode: 'push' }));
  bindFilterControls(() => updateResults({ historyMode: 'push' }));

  window.addEventListener('popstate', applyUrlState);
  window.addEventListener('resize', () => {
    syncPanelEnvironment();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.classList.contains('collapsed')) setPanelExpanded(false);
  });
}

function init() {
  initNav();
  applyUrlState();
  bindEvents();
}

init();
