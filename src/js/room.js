import { initNav } from './data.js';

function getSafeReturnPath() {
  const value = new URLSearchParams(window.location.search).get('from');
  if (!value) return null;

  try {
    const url = new URL(value, window.location.origin);
    const allowed = ['/', '/rooms/', '/map/', '/trips/', '/trip/', '/lists/', '/list/', '/players/', '/player/'];
    if (url.origin !== window.location.origin) return null;
    if (!allowed.some((path) => url.pathname === path || (path !== '/' && url.pathname.startsWith(path)))) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function returnLabel(path) {
  if (path === '/') return 'Back Home';
  if (path.startsWith('/map/')) return 'Back to Map';
  if (path.startsWith('/trip/')) return 'Back to Trip';
  if (path.startsWith('/list/')) return 'Back to List';
  if (path.startsWith('/player/')) return 'Back to Player';
  if (path.startsWith('/rooms/') && path.includes('?')) return 'Back to Filtered Rooms';
  return 'All Rooms';
}

function initRoomContext() {
  const returnPath = getSafeReturnPath();
  if (!returnPath) return;

  const contextLink = document.getElementById('room-context-link');
  contextLink.href = returnPath;
  contextLink.textContent = returnLabel(returnPath);

  document.querySelectorAll('.room-nav-prev, .room-nav-next').forEach((link) => {
    const url = new URL(link.href, window.location.origin);
    url.searchParams.set('from', returnPath);
    link.href = `${url.pathname}${url.search}`;
  });
}

initNav();
initRoomContext();
