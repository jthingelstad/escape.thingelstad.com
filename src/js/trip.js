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

  return `
    <div class="popup-room">
      <div class="popup-content">
        <h3><a href="${detailUrl}" style="color: inherit; text-decoration: none;">${stop.sequence}. #${stop.id} ${gameName}</a></h3>
        <div class="popup-meta">
          ${companyName}<br>
          ${formatDate(stop.date)}${locationText ? ' &middot; ' + locationText : ''}
          ${stop.timeLeft != null ? ' &middot; ' + escapeHtml(formatTimeLeft(stop.timeLeft)) : ''}
        </div>
        ${statusBadgeHtml(stop.status)}
        <div class="popup-links">
          <a href="${detailUrl}" style="color: var(--accent-teal); font-size: 0.8rem;">View details &rarr;</a>
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

  const routePoints = stops.map((stop) => [stop.displayLat, stop.displayLng]);
  const route = L.polyline(routePoints, {
    color: '#e8924f',
    weight: 4,
    opacity: 0.85
  }).addTo(map);

  stops.forEach((stop) => {
    L.marker([stop.displayLat, stop.displayLng], { icon: createStopIcon(stop) })
      .addTo(map)
      .bindPopup(buildPopup(stop), { maxWidth: 320 });
  });

  if (routePoints.length === 1) {
    map.setView(routePoints[0], 12);
  } else {
    map.fitBounds(route.getBounds(), { padding: [36, 36] });
  }
}

initNav();
initTripMap();
