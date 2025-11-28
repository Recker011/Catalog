'use strict';

// DOM references for search and provider toggle
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

const providerToggle = document.getElementById('provider-toggle');
const providerButtons = providerToggle
  ? providerToggle.querySelectorAll('.provider-option')
  : null;

let searchTimeout;

// --- Home rows ---

const rowsConfig = [
  { id: 'popular-movies', endpoint: '/api/movies/popular', type: 'movie' },
  { id: 'popular-tv', endpoint: '/api/tv/popular', type: 'tv' },
  { id: 'featured-movies', endpoint: '/api/movies/featured', type: 'movie' },
  { id: 'featured-tv', endpoint: '/api/tv/featured', type: 'tv' },
];

async function loadRow(config) {
  const container = document.querySelector(`.cards[data-row="${config.id}"]`);
  if (!container) return;

  container.textContent = '';

  try {
    const data = await fetchJson(config.endpoint);
    const items = (data.results || []).slice(0, 14);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'card-subtitle';
      empty.textContent = 'No titles available.';
      container.appendChild(empty);
      return;
    }

    for (const item of items) {
      const card = createCard(item, config.type);
      card.addEventListener('click', () => navigateToItem(item, config.type));
      container.appendChild(card);
    }
  } catch (error) {
    console.error('Failed to load row:', config.id, error);
    const err = document.createElement('div');
    err.className = 'card-subtitle';
    err.textContent = 'Failed to load content.';
    container.appendChild(err);
  }
}

async function initRows() {
  await Promise.all(rowsConfig.map(loadRow));
}

// --- Search ---

function clearSearchResults() {
  if (!searchResults) return;
  searchResults.innerHTML = '';
  searchResults.classList.add('hidden');
}

function renderSearchResults(results) {
  if (!searchResults) return;

  searchResults.innerHTML = '';

  if (!results.length) {
    clearSearchResults();
    return;
  }

  for (const item of results) {
    const container = document.createElement('div');
    container.className = 'search-result-item';

    const poster = document.createElement('img');
    poster.className = 'search-result-poster';
    poster.src = buildImageUrl(item.poster_path || item.profile_path);
    poster.alt = item.title || item.name || 'Result';

    const meta = document.createElement('div');
    meta.className = 'search-result-meta';

    const title = document.createElement('div');
    title.className = 'search-result-title';
    title.textContent = item.title || item.name || 'Untitled';

    const subtitle = document.createElement('div');
    subtitle.className = 'search-result-subtitle';
    const typeLabel =
      item.media_type === 'movie'
        ? 'Movie'
        : item.media_type === 'tv'
        ? 'Series'
        : item.media_type === 'person'
        ? 'Person'
        : '';
    const dateStr = item.release_date || item.first_air_date || '';
    const year = dateStr ? new Date(dateStr).getFullYear() : '';
    const bits = [];
    if (typeLabel) bits.push(typeLabel);
    if (year) bits.push(year);
    subtitle.textContent = bits.join(' • ');

    meta.appendChild(title);
    meta.appendChild(subtitle);

    container.appendChild(poster);
    container.appendChild(meta);

    container.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = item.title || item.name || '';
      }
      clearSearchResults();
      navigateToItem(item, item.media_type);
    });

    searchResults.appendChild(container);
  }

  searchResults.classList.remove('hidden');
}

async function performSearch(query) {
  if (!query || query.trim().length === 0) {
    clearSearchResults();
    return;
  }

  const trimmed = query.trim();

  try {
    const data = await fetchJson(
      `/api/search/multi?query=${encodeURIComponent(trimmed)}`
    );
    const results = (data.results || []).slice(0, 10);
    renderSearchResults(results);
  } catch (error) {
    console.error('Search failed:', error);
    clearSearchResults();
  }
}

function onSearchInput(event) {
  const value = event.target.value;

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  if (!value.trim()) {
    clearSearchResults();
    return;
  }

  searchTimeout = setTimeout(() => {
    performSearch(value);
  }, 350);
}

function setupSearch() {
  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', onSearchInput);

  document.addEventListener('click', (event) => {
    if (
      event.target === searchInput ||
      (searchResults && searchResults.contains(event.target))
    ) {
      return;
    }
    clearSearchResults();
  });
}

// --- Provider toggle ---

function updateProviderToggleUI() {
  if (!providerButtons || typeof getCurrentProvider !== 'function') return;

  const active = getCurrentProvider();
  providerButtons.forEach((btn) => {
    const provider = btn.dataset.provider;
    if (!provider) return;

    if (provider === active) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

async function replayCurrentPlayback() {
  const playback = window.currentPlayback;
  if (!playback) return;

  const providerLabel =
    getCurrentProvider() === 'filmex' ? 'Filmex' : 'VidLink';

  const { kind, movie, tv, season, episode, videoEl, statusEl } = playback;

  if (!videoEl) return;

  if (statusEl) {
    statusEl.textContent = `Resolving stream via ${providerLabel}…`;
  }

  try {
    if (kind === 'movie' && movie) {
      await startMoviePlayback(movie, videoEl, statusEl);
    } else if (kind === 'tv' && tv && season && episode) {
      await startEpisodePlayback(tv, season, episode, videoEl, statusEl);
    }
  } catch (error) {
    console.error('Failed to re-resolve stream after provider change', error);
  }
}

function setupProviderToggle() {
  if (!providerToggle || !providerButtons) return;

  updateProviderToggleUI();

  providerButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      if (!provider) return;

      setCurrentProvider(provider);
      updateProviderToggleUI();
      replayCurrentPlayback();
    });
  });
}

// --- Initialization ---

window.addEventListener('DOMContentLoaded', () => {
  // Shared playback context used by detail views and provider toggle.
  window.currentPlayback = null;

  // Show home layout by default.
  showHome();

  initRows().catch((err) => console.error(err));
  setupSearch();
  setupProviderToggle();
  setupHomeButton();
});