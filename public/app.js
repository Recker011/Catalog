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
  const rowElement = document.getElementById(config.id);
  if (!container) return;

  container.textContent = '';

  // Add loading state to the row
  if (rowElement && typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.setRowLoading(rowElement, 6);
  }

  try {
    const data = await fetchJson(config.endpoint);
    const items = (data.results || []).slice(0, 14);

    // Remove loading state
    if (rowElement && typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.removeRowLoading(rowElement);
    }

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
    
    // Remove loading state
    if (rowElement && typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.removeRowLoading(rowElement);
    }
    
    const err = document.createElement('div');
    err.className = 'card-subtitle';
    err.textContent = 'Failed to load content.';
    container.appendChild(err);
  }
}

async function initRows() {
  // Show loading toast for initial page load
  if (typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.showToast(
      'Loading content...',
      'loading',
      0,
      true
    );
  }
  
  try {
    await Promise.all(rowsConfig.map(loadRow));
    
    // Hide loading toast and show success
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        'Content loaded successfully',
        'success',
        2000
      );
    }
  } catch (error) {
    console.error('Failed to initialize rows', error);
    
    // Hide loading toast and show error
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        'Failed to load some content',
        'error',
        5000
      );
    }
  }
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

  // Add loading state to search results
  if (searchResults && typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.setSearchLoading(searchResults);
    searchResults.classList.remove('hidden');
  }

  try {
    const data = await fetchJson(
      `/api/search/multi?query=${encodeURIComponent(trimmed)}`
    );
    const results = (data.results || []).slice(0, 10);
    
    // Remove loading state
    if (searchResults && typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.removeSearchLoading(searchResults);
    }
    
    renderSearchResults(results);
  } catch (error) {
    console.error('Search failed:', error);
    
    // Remove loading state
    if (searchResults && typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.removeSearchLoading(searchResults);
    }
    
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

  const { kind, movie, tv, season, episode, videoEl, statusEl } = playback;

  if (!videoEl) return;

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
    btn.addEventListener('click', function() {
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