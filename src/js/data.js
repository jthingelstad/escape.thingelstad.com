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
  { key: 'player', elementId: 'filter-player', label: 'Player' },
  { key: 'award', elementId: 'filter-award', label: 'Award' },
  { key: 'theme', elementId: 'filter-theme', label: 'Theme' },
  { key: 'country', elementId: 'filter-country', label: 'Country' },
  { key: 'year', elementId: 'filter-year', label: 'Year' },
  { key: 'status', elementId: 'filter-status', label: 'Status', emptyValue: 'all' }
];

function createDefaultFilters() {
  return {
    year: '',
    status: 'all',
    country: '',
    player: '',
    award: '',
    theme: ''
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

export function setFilterParams(filters) {
  const params = new URLSearchParams();
  FILTER_FIELDS.forEach((field) => {
    const emptyValue = field.emptyValue || '';
    const value = filters[field.key];
    if (value && value !== emptyValue) params.set(field.key, value);
  });
  const search = params.toString();
  const url = window.location.pathname + (search ? `?${search}` : '');
  history.replaceState(null, '', url);
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
