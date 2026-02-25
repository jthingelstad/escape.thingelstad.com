import {
  escapeHtml, getFilterParams, setFilterParams,
  initNav, formatDate, formatLocation, renderTag, statusBadgeHtml
} from './data.js';

let allRooms = [];
let currentSort = 'date';
let currentDir = 'desc';

const container = document.getElementById('room-list');
const allCards = [...container.querySelectorAll('.room-card')];

function init() {
  initNav();
  allRooms = JSON.parse(document.getElementById('list-rooms-data').textContent);

  applyUrlFilters();
  bindEvents();
  openFromHash();
}

function openFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const room = allRooms.find(r => r.airtableId === hash);
  if (!room) return;

  const card = document.getElementById(hash);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('deeplink-highlight');
  }

  openModal(room);
}

function applyUrlFilters() {
  const filters = getFilterParams();

  document.getElementById('filter-search').value = filters.q;
  document.getElementById('filter-year').value = filters.year;
  document.getElementById('filter-status').value = filters.status || 'all';
  document.getElementById('filter-country').value = filters.country;
  document.getElementById('filter-player').value = filters.player;

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
    country: document.getElementById('filter-country').value,
    player: document.getElementById('filter-player').value
  };
}

function hasActiveFilters(filters) {
  return filters.q || filters.tag || filters.year ||
    (filters.status && filters.status !== 'all') ||
    filters.country || filters.player;
}

function cardMatchesFilters(card, filters) {
  if (filters.q) {
    const searchText = (card.dataset.search || '').toLowerCase();
    if (!searchText.includes(filters.q.toLowerCase())) return false;
  }

  if (filters.tag) {
    const filterTags = filters.tag.split(',').map(t => t.trim());
    const cardTags = card.dataset.tags ? card.dataset.tags.split(',') : [];
    if (!filterTags.every(ft => cardTags.includes(ft))) return false;
  }

  if (filters.year) {
    const cardDate = card.dataset.date || '';
    if (cardDate.substring(0, 4) !== filters.year) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (card.dataset.status !== filters.status) return false;
  }

  if (filters.country) {
    if (card.dataset.country !== filters.country) return false;
  }

  if (filters.player) {
    const cardPlayers = card.dataset.players ? card.dataset.players.split(',') : [];
    if (!cardPlayers.includes(filters.player)) return false;
  }

  return true;
}

function sortCards(cards, field, dir) {
  return [...cards].sort((a, b) => {
    let valA, valB;
    switch (field) {
      case 'date':
        valA = a.dataset.date || '';
        valB = b.dataset.date || '';
        break;
      case 'game':
        valA = a.dataset.game || '';
        valB = b.dataset.game || '';
        break;
      case 'company':
        valA = a.dataset.company || '';
        valB = b.dataset.company || '';
        break;
      case 'city':
        valA = a.dataset.city || '';
        valB = b.dataset.city || '';
        break;
      default:
        valA = a.dataset.date || '';
        valB = b.dataset.date || '';
    }
    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function updateResults() {
  const filters = getCurrentFilters();
  setFilterParams(filters);

  const clearBtn = document.getElementById('clear-filters');
  clearBtn.style.display = hasActiveFilters(filters) ? '' : 'none';

  updateActiveFilterPills(filters);

  // Filter
  const visible = [];
  allCards.forEach(card => {
    const matches = cardMatchesFilters(card, filters);
    card.hidden = !matches;
    if (matches) visible.push(card);
  });

  // Sort and reorder DOM
  const sorted = sortCards(visible, currentSort, currentDir);
  sorted.forEach(card => container.appendChild(card));

  const total = allCards.length;
  const count = visible.length;
  document.getElementById('results-count').textContent =
    count === total ? `Showing all ${total} rooms` : `Showing ${count} of ${total} rooms`;

  if (count === 0) {
    let empty = container.querySelector('.empty-state');
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No rooms match your filters.';
      container.appendChild(empty);
    }
    empty.hidden = false;
  } else {
    const empty = container.querySelector('.empty-state');
    if (empty) empty.hidden = true;
  }
}

function updateActiveFilterPills(filters) {
  const pillContainer = document.getElementById('active-filters');
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

  pillContainer.innerHTML = '';
  pills.forEach(p => pillContainer.appendChild(p));
}

function makePill(text, onRemove) {
  const pill = document.createElement('span');
  pill.className = 'active-filter-pill';
  pill.innerHTML = `${text} <button aria-label="Remove filter">&times;</button>`;
  pill.querySelector('button').addEventListener('click', onRemove);
  return pill;
}

function bindEvents() {
  let searchTimeout;
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(updateResults, 200);
  });

  ['filter-tag', 'filter-year', 'filter-status', 'filter-country', 'filter-player'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateResults);
  });

  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-tag').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-country').value = '';
    document.getElementById('filter-player').value = '';
    updateResults();
  });

  // Room card clicks → open modal
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.room-card');
    if (!card) return;
    if (e.target.closest('a') || e.target.closest('button')) return;
    const roomId = parseInt(card.dataset.id);
    const room = allRooms.find(r => r.id === roomId);
    if (room) openModal(room);
  });

  // Modal close
  document.getElementById('room-modal-close').addEventListener('click', closeModal);
  document.getElementById('room-modal-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
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

function openModal(room) {
  const backdrop = document.getElementById('room-modal-backdrop');
  const body = document.getElementById('room-modal-body');

  const gameName = escapeHtml(room.game);
  const companyName = escapeHtml(room.company);

  const photoHtml = room.photoUrl
    ? `<div class="room-modal-photo"><img src="${escapeHtml(room.photoUrl)}" alt="${gameName} at ${companyName}"></div>`
    : '';

  const statusBadge = statusBadgeHtml(room.status);

  const companyHtml = room.companyUrl
    ? `<a href="${escapeHtml(room.companyUrl)}" target="_blank" rel="noopener" data-tinylytics-event="list.company" data-tinylytics-event-value="${companyName}">${companyName}</a>`
    : companyName;

  const locationStr = escapeHtml(formatLocation(room.location));
  const tagsHtml = (room.tags || []).map(renderTag).join('');

  const escapeTimeHtml = room.escapeTime
    ? `<div class="room-modal-meta-item">\u23f1 ${escapeHtml(room.escapeTime)}</div>`
    : '';

  const playersHtml = (room.players || []).length > 0
    ? `<div class="room-modal-meta-item">\ud83d\udc65 ${room.players.map(escapeHtml).join(', ')}</div>`
    : '';

  const notesHtml = room.notes
    ? `<div class="room-modal-notes">${escapeHtml(room.notes)}</div>`
    : '';

  const blogHtml = room.blogUrl
    ? `<a href="${escapeHtml(room.blogUrl)}" class="blog-link" target="_blank" rel="noopener" data-tinylytics-event="list.blog-post" data-tinylytics-event-value="${gameName}">Read post \u2192</a>`
    : '';

  const mortyHtml = room.mortyId
    ? `<a href="https://morty.app/attraction/${room.mortyId}" class="morty-link" target="_blank" rel="noopener" data-tinylytics-event="list.morty" data-tinylytics-event-value="${gameName}">Morty \u2192</a>`
    : '';

  body.innerHTML = `
    ${photoHtml}
    <div class="room-modal-info">
      <div class="room-modal-header">
        <span class="room-number">#${room.id}</span>
        <h3>${gameName}</h3>
        ${statusBadge}
      </div>
      <div class="room-modal-company">${companyHtml}</div>
      <div class="room-modal-meta">
        <div class="room-modal-meta-item">\ud83d\udcc5 ${formatDate(room.date)}</div>
        ${locationStr ? `<div class="room-modal-meta-item">\ud83d\udccd ${locationStr}</div>` : ''}
        ${escapeTimeHtml}
        ${playersHtml}
      </div>
      ${tagsHtml ? `<div class="room-modal-tags">${tagsHtml}</div>` : ''}
      ${notesHtml}
      <div class="room-modal-links">
        ${blogHtml}
        ${mortyHtml}
        <button class="permalink-btn" data-permalink="${window.location.origin}/list/#${room.airtableId}" data-tinylytics-event="list.copy-link" data-tinylytics-event-value="${gameName}">Copy link</button>
      </div>
    </div>
  `;

  body.querySelector('.permalink-btn').addEventListener('click', (e) => {
    const url = e.currentTarget.dataset.permalink;
    const btn = e.currentTarget;
    navigator.clipboard.writeText(url).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy link'; }, 1500);
    }).catch(() => {
      btn.textContent = 'Failed';
      setTimeout(() => { btn.textContent = 'Copy link'; }, 1500);
    });
  });

  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  history.replaceState(null, '', '#' + room.airtableId);
}

function closeModal() {
  const backdrop = document.getElementById('room-modal-backdrop');
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

init();
