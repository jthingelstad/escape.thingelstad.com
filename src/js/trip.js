import { escapeHtml, formatDate, formatLocation, formatTimeLeft, initNav, roomUrl, statusBadgeHtml } from './data.js';

function getStatusClass(status) {
  switch (status) {
    case 'Escaped':
      return 'trip-route-marker-escaped';
    case 'Try again':
      return 'trip-route-marker-try-again';
    case 'Scheduled':
      return 'trip-route-marker-scheduled';
    case 'Completed':
    default:
      return 'trip-route-marker-completed';
  }
}

function offsetDuplicateStops(stops) {
  const counts = new Map();
  stops.forEach((stop) => {
    const key = `${stop.location.lat},${stop.location.lng}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const seen = new Map();
  return stops.map((stop) => {
    const key = `${stop.location.lat},${stop.location.lng}`;
    const total = counts.get(key) || 1;
    const occurrence = seen.get(key) || 0;
    seen.set(key, occurrence + 1);

    if (total === 1) {
      return { ...stop, displayLat: stop.location.lat, displayLng: stop.location.lng };
    }

    const angle = (Math.PI * 2 * occurrence) / total;
    const radius = 0.003;
    return {
      ...stop,
      displayLat: stop.location.lat + Math.sin(angle) * radius,
      displayLng: stop.location.lng + Math.cos(angle) * radius
    };
  });
}

function buildPopup(stop) {
  const gameName = escapeHtml(stop.game);
  const companyName = escapeHtml(stop.company?.name || 'Unknown Company');
  const locationText = escapeHtml(formatLocation(stop.location));
  const detailUrl = roomUrl(stop);
  const metaItems = [
    stop.date ? `<span><span class="meta-icon">\u{1F4C5}</span> ${escapeHtml(formatDate(stop.date))}</span>` : '',
    locationText ? `<span><span class="meta-icon">\u{1F4CD}</span> ${locationText}</span>` : '',
    stop.timeLeft != null ? `<span><span class="meta-icon">\u23F1</span> ${escapeHtml(formatTimeLeft(stop.timeLeft))}</span>` : ''
  ].filter(Boolean).join('');

  return `
    <div class="popup-room popup-room-no-photo">
      <div class="popup-room-frame">
        <div class="popup-photo-fallback" aria-hidden="true"></div>
        <div class="popup-room-top">
          <span class="room-number">Stop ${stop.sequence}</span>
          <span class="status-indicator">${statusBadgeHtml(stop.status)}</span>
        </div>
        <div class="popup-room-body">
          <div class="popup-room-title">
            <h3><a href="${detailUrl}" class="popup-link popup-link-detail">${gameName}</a></h3>
            <div class="popup-room-company">${companyName}</div>
          </div>
          ${metaItems ? `<div class="popup-meta">${metaItems}</div>` : ''}
        </div>
      </div>
      <div class="popup-room-details">
        <div class="popup-links">
          <a href="${detailUrl}" class="popup-link popup-link-detail">View details &rarr;</a>
        </div>
      </div>
    </div>
  `;
}

function createStopIcon(stop) {
  return L.divIcon({
    html: `<div class="trip-route-marker ${getStatusClass(stop.status)}"><span>${stop.sequence}</span></div>`,
    className: 'trip-route-marker-wrapper',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -14]
  });
}

function initTripMap() {
  const dataEl = document.getElementById('trip-map-data');
  const mapEl = document.getElementById('trip-map');
  if (!dataEl || !mapEl) return;

  const rawStops = JSON.parse(dataEl.textContent);
  if (!rawStops.length) return;

  const stops = offsetDuplicateStops(rawStops);
  const map = L.map('trip-map', {
    zoomControl: true,
    attributionControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  stops.forEach((stop) => {
    L.marker([stop.displayLat, stop.displayLng], { icon: createStopIcon(stop) })
      .addTo(map)
      .bindPopup(buildPopup(stop), { maxWidth: 320 });
  });

  const markerPoints = stops.map((stop) => [stop.displayLat, stop.displayLng]);
  if (markerPoints.length === 1) {
    map.setView(markerPoints[0], 12);
  } else {
    map.fitBounds(L.latLngBounds(markerPoints), { padding: [36, 36] });
  }

  // Leaflet computes some dimensions before the page has fully settled.
  setTimeout(() => map.invalidateSize(), 0);
}

initNav();
initTripMap();
