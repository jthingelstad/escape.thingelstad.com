import { escapeHtml, formatDate, formatLocation, initNav, statusBadgeHtml, formatTimeLeft, roomUrl } from './data.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDetailHtml(room) {
  const gameName = escapeHtml(room.game);
  const statusBadge = statusBadgeHtml(room.status);
  const listsHtml = room.lists?.length
    ? `<div class="scrapbook-detail-lists">${room.lists.map((list) => `<span class="scrapbook-detail-list">${escapeHtml(list.name)}</span>`).join('')}</div>`
    : '';

  const timeLeftHtml = room.timeLeft != null
    ? `<div class="scrapbook-detail-time">\u23f1 ${escapeHtml(formatTimeLeft(room.timeLeft))}</div>`
    : '';

  const blogLink = room.blogUrl
    ? `<a href="${escapeHtml(room.blogUrl)}" class="scrapbook-detail-link" target="_blank" rel="noopener" data-tinylytics-event="scrapbook.blog-post" data-tinylytics-event-value="${gameName}">Read post \u2192</a>`
    : '';

  const officialLink = room.officialUrl
    ? `<a href="${escapeHtml(room.officialUrl)}" class="scrapbook-detail-link" target="_blank" rel="noopener" data-tinylytics-event="scrapbook.official-site" data-tinylytics-event-value="${gameName}">Official site \u2192</a>`
    : '';

  const detailLink = room.id
    ? `<a href="${roomUrl(room)}" class="scrapbook-detail-link" data-tinylytics-event="scrapbook.view-room" data-tinylytics-event-value="${gameName}">View details &rarr;</a>`
    : '';

  return `
    <div class="scrapbook-detail-name">${gameName}</div>
    <div class="scrapbook-detail-company">${escapeHtml(room.company?.name || '')}</div>
    <div class="scrapbook-detail-date">${formatDate(room.date)}</div>
    <div class="scrapbook-detail-location">${escapeHtml(formatLocation(room.location))}</div>
    <div class="scrapbook-detail-status">${statusBadge}${timeLeftHtml}</div>
    ${listsHtml}
    ${detailLink}
    ${officialLink}
    ${blogLink}
  `;
}

function buildCardSummaryHtml(room) {
  const gameName = escapeHtml(room.game);
  const companyName = escapeHtml(room.company?.name || 'Unknown Company');
  const location = escapeHtml(formatLocation(room.location));
  const date = escapeHtml(formatDate(room.date));
  const roomNumber = room.id ? `<span class="room-number">#${escapeHtml(room.id)}</span>` : '';
  const statusBadge = room.status
    ? `<span class="scrapbook-photo-status">${statusBadgeHtml(room.status)}</span>`
    : '';
  const metaParts = [
    date ? `<span><span class="meta-icon">\u{1F4C5}</span> ${date}</span>` : '',
    location ? `<span><span class="meta-icon">\u{1F4CD}</span> ${location}</span>` : ''
  ].filter(Boolean).join('');

  return `
    <div class="scrapbook-photo-top">
      ${roomNumber}
      ${statusBadge}
    </div>
    <div class="scrapbook-photo-body">
      <div class="scrapbook-photo-title">
        <div class="scrapbook-photo-name">${gameName}</div>
        <div class="scrapbook-photo-company">${companyName}</div>
      </div>
      ${metaParts ? `<div class="scrapbook-photo-meta">${metaParts}</div>` : ''}
    </div>
  `;
}

let activePhoto = null;
let currentMode = 'shuffle'; // 'shuffle' | 'newest' | 'oldest'

function deactivate() {
  if (activePhoto) {
    activePhoto.classList.remove('active');
    activePhoto.querySelector('.scrapbook-photo-frame')?.setAttribute('aria-expanded', 'false');
    activePhoto = null;
  }
}

function orderRooms(rooms, mode) {
  if (mode === 'shuffle') return shuffle(rooms);
  const sorted = [...rooms];
  if (mode === 'newest') sorted.reverse();
  return sorted;
}

function renderPhotos(rooms, table, animate) {
  deactivate();
  table.innerHTML = '';

  rooms.forEach((room, i) => {
    const delay = animate ? i * 40 : 0;

    const el = document.createElement('div');
    el.className = 'scrapbook-photo';
    if (animate) el.style.setProperty('--delay', delay + 'ms');

    const frame = document.createElement('button');
    frame.type = 'button';
    frame.className = 'scrapbook-photo-frame';
    frame.setAttribute('aria-expanded', 'false');
    frame.setAttribute('aria-label', `Show details for ${room.game}`);
    frame.innerHTML = `
      <img src="/images/rooms/${room.photo}" alt="${escapeHtml(room.game)} at ${escapeHtml(room.company?.name || 'Unknown Company')}" loading="lazy">
      ${buildCardSummaryHtml(room)}
    `;

    const detail = document.createElement('div');
    detail.className = 'scrapbook-detail';
    detail.innerHTML = buildDetailHtml(room);

    el.appendChild(frame);
    el.appendChild(detail);
    table.appendChild(el);

    frame.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activePhoto === el) {
        deactivate();
      } else {
        deactivate();
        el.classList.add('active');
        frame.setAttribute('aria-expanded', 'true');
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

function init() {
  initNav();

  const withPhotos = JSON.parse(document.getElementById('scrapbook-data').textContent);

  const table = document.getElementById('scrapbook-table');
  const controls = document.getElementById('scrapbook-controls');

  // Build control buttons
  const dateBtn = document.createElement('button');
  dateBtn.className = 'sort-btn active';
  dateBtn.textContent = 'Date';
  dateBtn.setAttribute('data-tinylytics-event', 'scrapbook.sort-date');

  const shuffleBtn = document.createElement('button');
  shuffleBtn.className = 'sort-btn active';
  shuffleBtn.textContent = 'Shuffle';
  shuffleBtn.setAttribute('data-tinylytics-event', 'scrapbook.shuffle');

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

  document.addEventListener('click', (event) => {
    if (activePhoto?.contains(event.target)) return;
    deactivate();
  });
}

init();
