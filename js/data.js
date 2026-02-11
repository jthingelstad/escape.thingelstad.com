let cachedRooms = null;

export async function loadRooms() {
  if (cachedRooms) return cachedRooms;
  const res = await fetch('data/rooms.json');
  const data = await res.json();
  cachedRooms = data.rooms;
  return cachedRooms;
}

export async function getRooms() {
  return await loadRooms();
}

export async function getCompletedRooms() {
  const rooms = await loadRooms();
  return rooms.filter(r => r.status === 'completed');
}

export async function getPlannedRooms() {
  const rooms = await loadRooms();
  return rooms.filter(r => r.status === 'planned');
}

export async function getAllTags() {
  const rooms = await loadRooms();
  const tags = new Set();
  rooms.forEach(r => (r.tags || []).forEach(t => tags.add(t)));
  return [...tags].sort();
}

export async function getAllYears() {
  const rooms = await loadRooms();
  const years = new Set();
  rooms.forEach(r => {
    if (r.date) years.add(r.date.substring(0, 4));
  });
  return [...years].sort();
}

export async function getAllCountries() {
  const rooms = await loadRooms();
  const countries = new Set();
  rooms.forEach(r => {
    if (r.location && r.location.country) countries.add(r.location.country);
  });
  return [...countries].sort();
}

export async function getAllPlayers() {
  const rooms = await loadRooms();
  const players = new Set();
  rooms.forEach(r => (r.players || []).forEach(p => players.add(p)));
  return [...players].sort();
}

export async function filterRooms(filters = {}) {
  const rooms = await loadRooms();
  return rooms.filter(room => {
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const searchable = [
        room.game,
        room.company,
        room.location?.city,
        room.location?.region,
        room.notes
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    if (filters.tag) {
      const filterTags = filters.tag.split(',').map(t => t.trim());
      if (!filterTags.every(ft => (room.tags || []).includes(ft))) return false;
    }

    if (filters.year) {
      if (!room.date || room.date.substring(0, 4) !== filters.year) return false;
    }

    if (filters.status && filters.status !== 'all') {
      if (room.status !== filters.status) return false;
    }

    if (filters.win && filters.win !== 'all') {
      if (filters.win === 'wins' && room.win !== true) return false;
      if (filters.win === 'losses' && room.win !== false) return false;
    }

    if (filters.country) {
      if (!room.location || room.location.country !== filters.country) return false;
    }

    if (filters.player) {
      if (!(room.players || []).includes(filters.player)) return false;
    }

    return true;
  });
}

export function parseEscapeTime(str) {
  if (!str) return null;
  let totalSeconds = 0;
  const minMatch = str.match(/(\d+)m/);
  const secMatch = str.match(/(\d+)s/);
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1]);
  return totalSeconds;
}

export function escapeTimeMinutes(str) {
  const seconds = parseEscapeTime(str);
  if (seconds === null) return null;
  return seconds / 60;
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

export function classifyTag(tag) {
  if (tag === 'best') return 'best';
  if (tag.startsWith('terpeca-')) return 'terpeca';
  if (tag === 'online') return 'online';
  if (/[a-z]+-\d{4}$/.test(tag)) return 'trip';
  return 'default';
}

export function formatTagLabel(tag) {
  if (tag === 'best') return '\u2605 Best';
  if (tag.startsWith('terpeca-')) {
    const year = tag.replace('terpeca-', '');
    return 'TERPECA ' + year;
  }
  if (tag === 'online') return 'Online';
  if (/[a-z]+-\d{4}$/.test(tag)) {
    const [location, year] = tag.split('-');
    return location.charAt(0).toUpperCase() + location.slice(1) + ' ' + year;
  }
  return tag;
}

export function renderTag(tag) {
  const type = classifyTag(tag);
  const label = formatTagLabel(tag);
  return `<span class="tag tag-${type}" data-tag="${tag}">${label}</span>`;
}

export function renderRoomCard(room, options = {}) {
  const { compact = false, featured = false } = options;

  const statusBadge = room.status === 'planned'
    ? '<span class="status-badge status-planned">Planned</span>'
    : room.win === true
      ? '<span class="status-badge status-win">\u2713 Escaped</span>'
      : room.win === false
        ? '<span class="status-badge status-loss">\u2717 Locked Out</span>'
        : '';

  const companyHtml = room.companyUrl
    ? `<span class="company"><a href="${room.companyUrl}" target="_blank" rel="noopener">${room.company}</a></span>`
    : `<span class="company">${room.company}</span>`;

  const locationStr = formatLocation(room.location);
  const dateStr = formatDate(room.date);
  const tagsHtml = (room.tags || []).map(renderTag).join('');

  const escapeTimeHtml = room.escapeTime
    ? `<span class="escape-time"><span class="meta-icon">\u23f1</span> ${room.escapeTime}</span>`
    : '';

  const blogHtml = room.blogUrl
    ? `<a href="${room.blogUrl}" class="blog-link" target="_blank" rel="noopener">Read post \u2192</a>`
    : '';

  const playersHtml = (room.players || []).length > 0
    ? `<div class="room-card-players"><span class="meta-icon">\ud83d\udc65</span> ${room.players.join(', ')}</div>`
    : '';

  const notesHtml = room.notes && !compact
    ? `<div class="room-card-notes">${room.notes}</div>`
    : '';

  return `
    <div class="room-card${featured ? ' featured' : ''}" data-id="${room.id}">
      <div class="room-card-header">
        <div class="room-card-title">
          <span class="room-number">#${room.id}</span>
          <h3>${room.game}</h3>
        </div>
        <span class="status-indicator">${statusBadge}</span>
      </div>
      <div class="room-card-meta">
        ${companyHtml}
        <span class="date"><span class="meta-icon">\ud83d\udcc5</span> ${dateStr}</span>
        ${locationStr ? `<span class="location"><span class="meta-icon">\ud83d\udccd</span> ${locationStr}</span>` : ''}
        ${escapeTimeHtml}
      </div>
      ${playersHtml}
      ${tagsHtml ? `<div class="room-card-tags">${tagsHtml}</div>` : ''}
      <div class="room-card-footer">
        ${blogHtml}
        <button class="tinylytics_kudos room-kudos" data-path="/room/${room.id}"></button>
      </div>
      ${notesHtml}
    </div>
  `;
}

// URL filter helpers
export function getFilterParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') || '',
    tag: params.get('tag') || '',
    year: params.get('year') || '',
    status: params.get('status') || 'all',
    win: params.get('win') || 'all',
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
  if (filters.win && filters.win !== 'all') params.set('win', filters.win);
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
