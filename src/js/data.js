export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatLocation(location) {
  if (!location) return '';
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) parts.push(location.country);
  return parts.join(', ');
}

export function formatTimeLeft(value) {
  if (value == null) return '';
  const abs = Math.abs(value);
  const mins = Math.floor(abs);
  const secs = Math.round((abs - mins) * 60);
  const suffix = value < 0 ? 'over' : 'left';
  return `${mins}m ${secs}s ${suffix}`;
}

export function roomUrl(room) {
  if (room.slug) return `/room/${room.slug}/`;
  const slug = String(room.game || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `/room/${room.id}-${slug}/`;
}

export function featuredEntityUrl(type, entity) {
  return `/${type}/${encodeURIComponent(entity.slug)}/`;
}

export function entityFilterUrl(type, entity) {
  return `/rooms/?${encodeURIComponent(type)}=${encodeURIComponent(entity.slug)}`;
}

export function entityUrl(type, entity) {
  if (!entity) return '/rooms/';
  if (type === 'theme') return entityFilterUrl(type, entity);
  if (type === 'list') return featuredEntityUrl(type, entity);
  return entity.featured ? featuredEntityUrl(type, entity) : entityFilterUrl(type, entity);
}

export const STATUS_CONFIG = {
  Escaped: { label: '\u2713 Escaped', cssClass: 'status-escaped', color: '#4CAF50', markerClass: 'trip-route-marker-escaped' },
  'Try again': { label: '\u2717 Try Again', cssClass: 'status-try-again', color: '#EF4444', markerClass: 'trip-route-marker-try-again' },
  Completed: { label: '\u2713 Completed', cssClass: 'status-completed', color: '#6B7280', markerClass: 'trip-route-marker-completed' },
  Scheduled: { label: 'Scheduled', cssClass: 'status-scheduled', color: '#5AA9FF', markerClass: 'trip-route-marker-scheduled' }
};

export function statusBadgeHtml(status) {
  const config = STATUS_CONFIG[status];
  if (!config) return '';
  return `<span class="status-badge ${config.cssClass}">${config.label}</span>`;
}

export const NAV_BREAKPOINT = 860;

export const FILTER_FIELDS = [
  { key: 'player', elementId: 'filter-player', label: 'Player' },
  { key: 'award', elementId: 'filter-award', label: 'Award' },
  { key: 'theme', elementId: 'filter-theme', label: 'Theme' },
  { key: 'country', elementId: 'filter-country', label: 'Country' },
  { key: 'trip', elementId: 'filter-trip', label: 'Trip' },
  { key: 'list', elementId: 'filter-list', label: 'List' },
  { key: 'year', elementId: 'filter-year', label: 'Year' },
  { key: 'status', elementId: 'filter-status', label: 'Status', emptyValue: 'all' }
];

export const VALID_SORTS = new Set(['newest', 'oldest', 'rating', 'room']);

function createDefaultFilters() {
  return {
    year: '',
    status: 'all',
    country: '',
    player: '',
    award: '',
    theme: '',
    trip: '',
    list: ''
  };
}

function getFilterControl(field) {
  return document.getElementById(field.elementId);
}

export function getFilterParams() {
  const params = new URLSearchParams(window.location.search);
  const filters = createDefaultFilters();
  FILTER_FIELDS.forEach((field) => {
    filters[field.key] = params.get(field.key) || field.emptyValue || '';
  });
  return filters;
}

export function getSortParam() {
  const value = new URLSearchParams(window.location.search).get('sort') || 'newest';
  return VALID_SORTS.has(value) ? value : 'newest';
}

export function getSelectedRoomParam() {
  const value = Number(new URLSearchParams(window.location.search).get('room'));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function buildFilterParams(filters, { sort = 'newest', room = null } = {}) {
  const params = new URLSearchParams();
  FILTER_FIELDS.forEach((field) => {
    const emptyValue = field.emptyValue || '';
    const value = filters[field.key];
    if (value && value !== emptyValue) params.set(field.key, value);
  });
  if (VALID_SORTS.has(sort) && sort !== 'newest') params.set('sort', sort);
  if (Number.isSafeInteger(Number(room)) && Number(room) > 0) params.set('room', String(room));
  return params;
}

export function setFilterParams(filters, { sort = 'newest', room = null, historyMode = 'replace' } = {}) {
  const params = buildFilterParams(filters, { sort, room });
  const search = params.toString();
  const url = window.location.pathname + (search ? `?${search}` : '');
  const method = historyMode === 'push' ? 'pushState' : 'replaceState';
  if (window.location.pathname + window.location.search !== url) {
    history[method](null, '', url);
  }
}

export function applyFiltersToControls(filters) {
  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (!control) return;
    control.value = filters[field.key] || field.emptyValue || '';
  });
}

export function readFiltersFromControls() {
  const filters = createDefaultFilters();

  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (!control) return;
    filters[field.key] = control.value || field.emptyValue || '';
  });

  return filters;
}

export function clearFilterControls() {
  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (control) control.value = field.emptyValue || '';
  });
}

export function bindFilterControls(onChange) {
  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (control) control.addEventListener('change', () => onChange({ source: 'user' }));
  });

  const clearButton = document.getElementById('clear-filters');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      clearFilterControls();
      onChange({ source: 'user' });
    });
  }
}

export function hasActiveFilters(filters) {
  return FILTER_FIELDS.some((field) => {
    const emptyValue = field.emptyValue || '';
    return filters[field.key] && filters[field.key] !== emptyValue;
  });
}

export function getSelectedFilterLabel(key) {
  const field = FILTER_FIELDS.find((entry) => entry.key === key);
  if (!field) return '';

  const control = getFilterControl(field);
  return control?.options[control.selectedIndex]?.textContent || '';
}

export function roomMatchesFilters(room, filters) {
  if (filters.player && !(room.players || []).some((player) => player.slug === filters.player)) return false;
  if (filters.award && !(room.awards || []).some((award) => award.slug === filters.award)) return false;
  if (filters.theme && !(room.themes || []).some((theme) => theme.slug === filters.theme)) return false;
  if (filters.trip && !(room.trips || []).some((trip) => trip.slug === filters.trip)) return false;
  if (filters.list && !(room.lists || []).some((list) => list.slug === filters.list)) return false;
  if (filters.country && room.location?.country !== filters.country) return false;
  if (filters.year && (!room.date || room.date.substring(0, 4) !== filters.year)) return false;
  if (filters.status && filters.status !== 'all' && room.status !== filters.status) return false;
  return true;
}

export function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    const closeNav = () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    links.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('click', (event) => {
      if (!links.classList.contains('open')) return;
      if (links.contains(event.target) || toggle.contains(event.target)) return;
      closeNav();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > NAV_BREAKPOINT) closeNav();
    });
  }
}
