import { getRooms, formatDate, formatLocation, initNav } from './data.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function buildDetailHtml(room) {
  const statusBadge = room.status === 'planned'
    ? '<span class="status-badge status-planned">Planned</span>'
    : room.win === true
      ? '<span class="status-badge status-win">\u2713 Escaped</span>'
      : room.win === false
        ? '<span class="status-badge status-loss">\u2717 Locked Out</span>'
        : '';

  const escapeTime = room.escapeTime
    ? `<div class="scrapbook-detail-time">\u23f1 ${room.escapeTime}</div>`
    : '';

  const blogLink = room.blogUrl
    ? `<a href="${room.blogUrl}" class="scrapbook-detail-link" target="_blank" rel="noopener">Read post \u2192</a>`
    : '';

  return `
    <div class="scrapbook-detail-name">${room.game}</div>
    <div class="scrapbook-detail-company">${room.company}</div>
    <div class="scrapbook-detail-date">${formatDate(room.date)}</div>
    <div class="scrapbook-detail-location">${formatLocation(room.location)}</div>
    <div class="scrapbook-detail-status">${statusBadge}${escapeTime}</div>
    ${blogLink}
  `;
}

let activePhoto = null;
let currentMode = 'shuffle'; // 'shuffle' | 'newest' | 'oldest'

function deactivate() {
  if (activePhoto) {
    activePhoto.classList.remove('active');
    activePhoto = null;
  }
}

function orderRooms(rooms, mode) {
  if (mode === 'shuffle') return shuffle(rooms);
  const sorted = [...rooms].sort((a, b) => a.date.localeCompare(b.date));
  if (mode === 'newest') sorted.reverse();
  return sorted;
}

function renderPhotos(rooms, table, animate) {
  deactivate();
  table.innerHTML = '';

  rooms.forEach((room, i) => {
    const isScattered = currentMode === 'shuffle';
    const rotation = isScattered ? randomBetween(-12, 12) : 0;
    const size = isScattered ? randomBetween(220, 320) : 260;
    const offsetX = isScattered ? randomBetween(-8, 8) : 0;
    const offsetY = isScattered ? randomBetween(-6, 6) : 0;
    const delay = animate ? i * 40 : 0;

    const isBest = (room.tags || []).includes('best');

    const el = document.createElement('div');
    el.className = 'scrapbook-photo' + (isBest ? ' scrapbook-best' : '') + (isScattered ? '' : ' scrapbook-tidy');
    el.style.setProperty('--rotation', rotation + 'deg');
    el.style.setProperty('--size', size + 'px');
    el.style.setProperty('--offset-x', offsetX + 'px');
    el.style.setProperty('--offset-y', offsetY + 'px');
    if (animate) el.style.setProperty('--delay', delay + 'ms');

    const img = document.createElement('img');
    img.src = `/images/rooms/${room.id}.jpg`;
    img.alt = `${room.game} at ${room.company}`;
    img.loading = 'lazy';

    const caption = document.createElement('div');
    caption.className = 'scrapbook-caption';
    caption.textContent = room.game;

    const detail = document.createElement('div');
    detail.className = 'scrapbook-detail';
    detail.innerHTML = buildDetailHtml(room);

    el.appendChild(img);
    el.appendChild(caption);
    el.appendChild(detail);
    table.appendChild(el);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activePhoto === el) {
        deactivate();
      } else {
        deactivate();
        el.classList.add('active');
        activePhoto = el;
      }
    });
  });
}

function updateButtons(dateBtn, shuffleBtn) {
  dateBtn.classList.toggle('active', currentMode !== 'shuffle');
  shuffleBtn.classList.toggle('active', currentMode === 'shuffle');

  if (currentMode === 'newest') {
    dateBtn.textContent = 'Newest First';
  } else if (currentMode === 'oldest') {
    dateBtn.textContent = 'Oldest First';
  } else {
    dateBtn.textContent = 'Date';
  }
}

async function init() {
  initNav();

  const rooms = await getRooms();
  const withPhotos = rooms.filter(r => r.photoUrl);

  const table = document.getElementById('scrapbook-table');
  const controls = document.getElementById('scrapbook-controls');

  // Build control buttons
  const dateBtn = document.createElement('button');
  dateBtn.className = 'sort-btn active';
  dateBtn.textContent = 'Date';

  const shuffleBtn = document.createElement('button');
  shuffleBtn.className = 'sort-btn active';
  shuffleBtn.textContent = 'Shuffle';

  controls.appendChild(dateBtn);
  controls.appendChild(shuffleBtn);

  // Initial render
  const ordered = orderRooms(withPhotos, currentMode);
  renderPhotos(ordered, table, true);
  updateButtons(dateBtn, shuffleBtn);

  // Date button: cycles shuffle->newest->oldest->newest
  dateBtn.addEventListener('click', () => {
    if (currentMode === 'shuffle') {
      currentMode = 'newest';
    } else if (currentMode === 'newest') {
      currentMode = 'oldest';
    } else {
      currentMode = 'newest';
    }
    const ordered = orderRooms(withPhotos, currentMode);
    renderPhotos(ordered, table, false);
    updateButtons(dateBtn, shuffleBtn);
  });

  // Shuffle button: always re-shuffles
  shuffleBtn.addEventListener('click', () => {
    currentMode = 'shuffle';
    const ordered = orderRooms(withPhotos, currentMode);
    renderPhotos(ordered, table, true);
    updateButtons(dateBtn, shuffleBtn);
  });

  document.addEventListener('click', deactivate);
}

init();
