import { initNav } from './data.js';

function syncQuery(input) {
  const params = new URLSearchParams();
  const query = input.value.trim();
  if (query) params.set('q', query);
  const search = params.toString();
  history.replaceState(null, '', `/search/${search ? `?${search}` : ''}`);
}

function init() {
  initNav();

  if (typeof PagefindUI === 'undefined') {
    document.getElementById('pagefind-search-page').innerHTML = '<p class="empty-state">Search is unavailable until the Pagefind index has been built.</p>';
    return;
  }

  new PagefindUI({
    element: '#pagefind-search-page',
    showSubResults: true,
    showImages: false,
    ranking: {
      pageLength: 0.75,
      termFrequency: 0.0
    }
  });

  const input = document.querySelector('#pagefind-search-page .pagefind-ui__search-input');
  if (!input) return;

  const query = new URLSearchParams(window.location.search).get('q') || '';
  if (query) {
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  input.addEventListener('input', () => syncQuery(input));
  input.focus();
}

init();
