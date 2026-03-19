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

function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[:/]+/g, ' ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearchQuery(query) {
  return normalizeSearchText(query)
    .split(' ')
    .filter(Boolean);
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
  return `/list/?${encodeURIComponent(type)}=${encodeURIComponent(entity.slug)}`;
}

export function entityUrl(type, entity) {
  if (!entity) return '/list/';
  if (type === 'theme') return entityFilterUrl(type, entity);
  if (type === 'list') return featuredEntityUrl(type, entity);
  return entity.featured ? featuredEntityUrl(type, entity) : entityFilterUrl(type, entity);
}

function entityChipClass(type, entity) {
  const classes = [`entity-chip`, `entity-chip-${type}`];
  if (entity.featured) classes.push('entity-chip-featured');
  return classes.join(' ');
}

export function renderEntityChip(type, entity) {
  return `<a href="${entityUrl(type, entity)}" class="${entityChipClass(type, entity)}">${escapeHtml(entity.name)}</a>`;
}

export function statusBadgeHtml(status) {
  switch (status) {
    case 'Escaped':
      return '<span class="status-badge status-escaped">\u2713 Escaped</span>';
    case 'Try again':
      return '<span class="status-badge status-try-again">\u2717 Try Again</span>';
    case 'Completed':
      return '<span class="status-badge status-completed">\u2713 Completed</span>';
    case 'Scheduled':
      return '<span class="status-badge status-scheduled">Scheduled</span>';
    default:
      return '';
  }
}

export const FILTER_FIELDS = [
  { key: 'company', elementId: 'filter-company', label: 'Company' },
  { key: 'location', elementId: 'filter-location', label: 'Location' },
  { key: 'player', elementId: 'filter-player', label: 'Player' },
  { key: 'award', elementId: 'filter-award', label: 'Award' },
  { key: 'trip', elementId: 'filter-trip', label: 'Trip' },
  { key: 'list', elementId: 'filter-list', label: 'List' },
  { key: 'theme', elementId: 'filter-theme', label: 'Theme' },
  { key: 'country', elementId: 'filter-country', label: 'Country' },
  { key: 'year', elementId: 'filter-year', label: 'Year' },
  { key: 'status', elementId: 'filter-status', label: 'Status', emptyValue: 'all' }
];

function createDefaultFilters() {
  return {
    q: '',
    year: '',
    status: 'all',
    country: '',
    company: '',
    location: '',
    player: '',
    award: '',
    trip: '',
    list: '',
    theme: ''
  };
}

function getFilterControl(field) {
  return document.getElementById(field.elementId);
}

export function getFilterParams() {
  const params = new URLSearchParams(window.location.search);
  const filters = createDefaultFilters();
  filters.q = params.get('q') || '';
  FILTER_FIELDS.forEach((field) => {
    filters[field.key] = params.get(field.key) || field.emptyValue || '';
  });
  return filters;
}

export function setFilterParams(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.year) params.set('year', filters.year);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.country) params.set('country', filters.country);
  if (filters.company) params.set('company', filters.company);
  if (filters.player) params.set('player', filters.player);
  if (filters.award) params.set('award', filters.award);
  if (filters.trip) params.set('trip', filters.trip);
  if (filters.list) params.set('list', filters.list);
  if (filters.theme) params.set('theme', filters.theme);
  if (filters.location) params.set('location', filters.location);
  const search = params.toString();
  const url = window.location.pathname + (search ? `?${search}` : '');
  history.replaceState(null, '', url);
}

export function applyFiltersToControls(filters) {
  const searchInput = document.getElementById('filter-search');
  if (searchInput) searchInput.value = filters.q || '';

  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (!control) return;
    control.value = filters[field.key] || field.emptyValue || '';
  });
}

export function readFiltersFromControls() {
  const filters = createDefaultFilters();
  const searchInput = document.getElementById('filter-search');
  filters.q = searchInput ? searchInput.value.trim() : '';

  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (!control) return;
    filters[field.key] = control.value || field.emptyValue || '';
  });

  return filters;
}

export function clearFilterControls() {
  const searchInput = document.getElementById('filter-search');
  if (searchInput) searchInput.value = '';

  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (control) control.value = field.emptyValue || '';
  });
}

export function bindFilterControls(onChange, options = {}) {
  const { searchDebounce = 200 } = options;
  const searchInput = document.getElementById('filter-search');

  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(onChange, searchDebounce);
    });
  }

  FILTER_FIELDS.forEach((field) => {
    const control = getFilterControl(field);
    if (control) control.addEventListener('change', onChange);
  });

  const clearButton = document.getElementById('clear-filters');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      clearFilterControls();
      onChange();
    });
  }
}

export function hasActiveFilters(filters) {
  if (filters.q) return true;
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
  if (filters.q) {
    const terms = tokenizeSearchQuery(filters.q);
    const searchText = normalizeSearchText(room.searchIndex || room.searchText || '');
    if (!terms.every((term) => searchText.includes(term))) return false;
  }
  if (filters.company && room.company?.slug !== filters.company) return false;
  if (filters.location && room.location?.slug !== filters.location) return false;
  if (filters.player && !(room.players || []).some((player) => player.slug === filters.player)) return false;
  if (filters.award && !(room.awards || []).some((award) => award.slug === filters.award)) return false;
  if (filters.trip && !(room.trips || []).some((trip) => trip.slug === filters.trip)) return false;
  if (filters.list && !(room.lists || []).some((list) => list.slug === filters.list)) return false;
  if (filters.theme && !(room.themes || []).some((theme) => theme.slug === filters.theme)) return false;
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
      if (window.innerWidth > 860) closeNav();
    });
  }
}
