export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function classifyTag(tag) {
  if (tag === 'best') return 'best';
  if (tag.startsWith('terpeca-')) return 'terpeca';
  if (tag === 'online') return 'online';
  if (/^[a-z]+-\d{4}$/.test(tag)) return 'trip';
  return 'default';
}

function formatTagLabel(tag) {
  if (tag === 'best') return '\u2605 Best';
  if (tag.startsWith('terpeca-')) {
    const year = tag.replace('terpeca-', '');
    return 'TERPECA ' + year;
  }
  if (tag === 'online') return 'Online';
  if (/^[a-z]+-\d{4}$/.test(tag)) {
    const [location, year] = tag.split('-');
    return location.charAt(0).toUpperCase() + location.slice(1) + ' ' + year;
  }
  return tag;
}

export function renderTag(tag) {
  const type = classifyTag(tag);
  const label = formatTagLabel(tag);
  return `<span class="tag tag-${type}" data-tag="${escapeHtml(tag)}">${escapeHtml(label)}</span>`;
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

// URL filter helpers
export function getFilterParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') || '',
    tag: params.get('tag') || '',
    year: params.get('year') || '',
    status: params.get('status') || 'all',
    country: params.get('country') || '',
    player: params.get('player') || ''
  };
}

export function setFilterParams(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.year) params.set('year', filters.year);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.country) params.set('country', filters.country);
  if (filters.player) params.set('player', filters.player);
  const search = params.toString();
  const url = window.location.pathname + (search ? '?' + search : '');
  history.replaceState(null, '', url);
}

// Nav toggle
export function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }
}
