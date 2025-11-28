'use strict';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';
const FALLBACK_POSTER = 'https://via.placeholder.com/300x450/020617/6b7280?text=No+Image';

function buildImageUrl(path, base = IMAGE_BASE) {
  if (!path) {
    return FALLBACK_POSTER;
  }
  return base + path;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

 // --- Streaming proxy integration (v2) ---

const PROXY_DEFAULT_BASE = 'http://localhost:4000';
const PROVIDER_STORAGE_KEY = 'catalog:streamProvider';

/**
 * Resolve the base URL for the streaming proxy (VidLink / Filmex).
 * This will prefer window.VIDLINK_PROXY_BASE if present so that
 * deployments can override it without rebuilding the bundle.
 */
function getProxyBase() {
  if (typeof window !== 'undefined' && window.VIDLINK_PROXY_BASE) {
    return window.VIDLINK_PROXY_BASE;
  }
  return PROXY_DEFAULT_BASE;
}

/**
 * Determine the initial provider to use, preferring a stored choice.
 */
function getInitialProvider() {
  if (typeof window === 'undefined') return 'vidlink';
  try {
    const stored =
      window.localStorage && window.localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (stored === 'filmex' || stored === 'vidlink') {
      return stored;
    }
  } catch (error) {
    console.warn('Unable to read provider preference from storage', error);
  }
  return 'vidlink';
}

let currentProvider = getInitialProvider();
let currentHlsInstance = null;

/**
 * Get the active provider name.
 */
function getCurrentProvider() {
  return currentProvider || 'vidlink';
}

/**
 * Update the active provider and persist the choice where possible.
 */
function setCurrentProvider(provider) {
  if (provider !== 'vidlink' && provider !== 'filmex') {
    provider = 'vidlink';
  }
  currentProvider = provider;

  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
      }
    } catch (error) {
      console.warn('Unable to persist provider preference', error);
    }
  }
}

/**
 * Clean up any existing Hls.js instance before starting a new stream.
 */
function cleanupHls() {
  if (currentHlsInstance && typeof currentHlsInstance.destroy === 'function') {
    try {
      currentHlsInstance.destroy();
    } catch (error) {
      console.error('Failed to destroy Hls instance', error);
    }
  }
  currentHlsInstance = null;
}

/**
 * Resolve a direct stream URL via the /v2/stream endpoint.
 *
 * @param {Object} params
 * @param {'movie'|'tv'} params.type
 * @param {number|string} [params.tmdbId]
 * @param {number|string} [params.season]
 * @param {number|string} [params.episode]
 * @param {'vidlink'|'filmex'} [params.provider]
 * @returns {Promise<{ ok: boolean, url: string, format: string, expiresAt: number, fromCache: boolean, provider: string }>}
 */
async function fetchStreamUrlV2(params) {
  const { type, tmdbId, season, episode } = params;

  const search = new URLSearchParams();
  search.set('type', type);

  const provider = params.provider || getCurrentProvider();
  if (provider) {
    search.set('provider', provider);
  }

  if (type === 'movie') {
    if (!tmdbId) {
      throw new Error('tmdbId is required for movie playback.');
    }
    search.set('tmdbId', String(tmdbId));
  } else if (type === 'tv') {
    if (!tmdbId || !season || !episode) {
      throw new Error('tmdbId, season and episode are required for TV playback.');
    }
    search.set('tmdbId', String(tmdbId));
    search.set('season', String(season));
    search.set('episode', String(episode));
  } else if (type === 'anime') {
    // Anime resolution exists on the proxy, but this UI does not yet expose anime playback.
    throw new Error('Anime playback is not wired up in this UI yet.');
  }

  const endpoint = `${getProxyBase()}/v2/stream?${search.toString()}`;

  let data;
  try {
    const res = await fetch(endpoint);
    data = await res.json();
  } catch (error) {
    console.error('Failed to call streaming proxy', error);
    throw new Error('Failed to contact streaming proxy.');
  }

  if (!data || !data.ok || !data.url) {
    console.error('Unexpected proxy response', data);
    const message =
      (data && (data.message || data.error)) ||
      'Streaming is not available for this title right now.';
    const err = new Error(message);
    if (data) {
      err.code = data.error;
      err.details = data.details;
    }
    throw err;
  }

  return data;
}

/**
 * Call the /v2/stream endpoint and attach the resulting HLS stream to the
 * provided <video> element using Hls.js or native playback.
 *
 * @param {Object} params
 * @param {HTMLVideoElement} videoEl
 */
async function loadStreamIntoVideo(params, videoEl) {
  if (!videoEl) return;

  const provider = params.provider || getCurrentProvider();

  // Reset any existing source when provider or content changes.
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();

  const data = await fetchStreamUrlV2({ ...params, provider });
  const streamUrl = data.url;

  cleanupHls();

  const HlsConstructor = typeof window !== 'undefined' ? window.Hls : null;

  if (HlsConstructor && HlsConstructor.isSupported && HlsConstructor.isSupported()) {
    const hls = new HlsConstructor();
    currentHlsInstance = hls;
    hls.loadSource(streamUrl);
    hls.attachMedia(videoEl);
    hls.on(HlsConstructor.Events.MANIFEST_PARSED, () => {
      videoEl.play().catch(() => {});
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = streamUrl;
    videoEl.play().catch(() => {});
  } else {
    throw new Error('HLS playback is not supported in this browser.');
  }

  // Track the provider used for this video element.
  videoEl.dataset.provider = provider;
}

/**
 * Convenience wrapper for starting movie playback given a TMDB movie object.
 */
async function startMoviePlayback(movie, videoEl, statusEl) {
  if (!movie || !movie.id) return;

  const providerLabel =
    getCurrentProvider() === 'filmex' ? 'Filmex' : 'VidLink';

  if (statusEl) {
    statusEl.textContent = `Resolving stream via ${providerLabel}…`;
  }

  try {
    await loadStreamIntoVideo(
      {
        type: 'movie',
        tmdbId: movie.id,
        provider: getCurrentProvider(),
      },
      videoEl
    );
    if (statusEl) {
      statusEl.textContent = '';
    }
  } catch (error) {
    console.error('Failed to start movie playback', error);
    if (statusEl) {
      statusEl.textContent =
        error && error.message
          ? error.message
          : 'Failed to start playback.';
    }
  }
}

/**
 * Convenience wrapper for starting TV episode playback given TV/season/episode info.
 */
async function startEpisodePlayback(tv, season, episode, videoEl, statusEl) {
  if (!tv || !tv.id || !season || !episode) return;

  const providerLabel =
    getCurrentProvider() === 'filmex' ? 'Filmex' : 'VidLink';

  if (statusEl) {
    statusEl.textContent = `Resolving stream via ${providerLabel}…`;
  }

  try {
    await loadStreamIntoVideo(
      {
        type: 'tv',
        tmdbId: tv.id,
        season: season.season_number,
        episode: episode.episode_number,
        provider: getCurrentProvider(),
      },
      videoEl
    );
    if (statusEl) {
      statusEl.textContent = '';
    }
  } catch (error) {
    console.error('Failed to start episode playback', error);
    if (statusEl) {
      statusEl.textContent =
        error && error.message
          ? error.message
          : 'Failed to start playback.';
    }
  }
}

 // DOM references
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const homeButton = document.getElementById('home-button');

const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

const providerToggle = document.getElementById('provider-toggle');
const providerButtons = providerToggle
  ? providerToggle.querySelectorAll('.provider-option')
  : null;

let searchTimeout;

let currentPlayback = null;

function showHome() {
  if (!homeView || !detailView) return;
  homeView.style.display = 'flex';
  detailView.style.display = 'none';
  detailView.innerHTML = '';
  cleanupHls();
  currentPlayback = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (homeButton) {
    homeButton.classList.add('active');
  }
}

function showDetail() {
  if (!homeView || !detailView) return;
  homeView.style.display = 'none';
  detailView.style.display = 'block';
  cleanupHls();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (homeButton) {
    homeButton.classList.remove('active');
  }
}

function createChip(text) {
  const span = document.createElement('span');
  span.className = 'chip';
  span.textContent = text;
  return span;
}

function createCard(item, typeHint) {
  const card = document.createElement('article');
  card.className = 'card';

  const name = item.title || item.name || 'Untitled';
  const mediaType = item.media_type || typeHint || 'movie';
  const dateStr = item.release_date || item.first_air_date || '';
  const year = dateStr ? new Date(dateStr).getFullYear() : '';

  const posterWrapper = document.createElement('div');
  posterWrapper.className = 'card-poster-wrapper';

  if (item.poster_path) {
    const img = document.createElement('img');
    img.className = 'card-poster';
    img.src = buildImageUrl(item.poster_path);
    img.alt = name;
    posterWrapper.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'card-poster placeholder';
    posterWrapper.appendChild(placeholder);
  }

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';
  const playIcon = document.createElement('div');
  playIcon.className = 'card-play-icon';
  playIcon.textContent = '▶';
  overlay.appendChild(playIcon);
  posterWrapper.appendChild(overlay);

  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  titleEl.textContent = name;

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'card-subtitle';
  const parts = [];
  if (mediaType === 'movie') parts.push('Movie');
  if (mediaType === 'tv') parts.push('Series');
  if (year) parts.push(year);
  subtitleEl.textContent = parts.join(' • ');

  card.appendChild(posterWrapper);
  card.appendChild(titleEl);
  card.appendChild(subtitleEl);

  return card;
}

const rowsConfig = [
  { id: 'popular-movies', endpoint: '/api/movies/popular', type: 'movie' },
  { id: 'popular-tv', endpoint: '/api/tv/popular', type: 'tv' },
  { id: 'featured-movies', endpoint: '/api/movies/featured', type: 'movie' },
  { id: 'featured-tv', endpoint: '/api/tv/featured', type: 'tv' },
];


function navigateToItem(item, typeHint) {
  const mediaType = item.media_type || typeHint;
  const id = item.id;
  if (!id || !mediaType) return;

  if (mediaType === 'movie') {
    openMovie(id);
  } else if (mediaType === 'tv') {
    openTv(id);
  }
}

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

// SEARCH

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
    const data = await fetchJson(`/api/search/multi?query=${encodeURIComponent(trimmed)}`);
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

/**
 * Reflect the currently selected provider in the toggle UI.
 */
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

/**
 * If a movie or episode is currently being played, re-resolve it with
 * the newly selected provider.
 */
async function replayCurrentPlayback() {
  if (!currentPlayback) return;

  const providerLabel =
    getCurrentProvider() === 'filmex' ? 'Filmex' : 'VidLink';

  const { kind, movie, tv, season, episode, videoEl, statusEl } =
    currentPlayback;

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

/**
 * Wire up the provider toggle so the user can switch between VidLink and Filmex.
 */
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

// DETAIL VIEWS

function renderBreadcrumb(parts) {
  const nav = document.createElement('nav');
  nav.className = 'detail-breadcrumb';
  nav.textContent = parts.join(' / ');
  return nav;
}

function renderSectionTitle(text) {
  const h3 = document.createElement('h3');
  h3.className = 'detail-section-title';
  h3.textContent = text;
  return h3;
}

function renderMovieDetail(movie) {
  if (!detailView) return;
  showDetail();
  detailView.innerHTML = '';

  const wrapper = document.createElement('section');
  wrapper.className = 'detail-wrapper';

  const header = document.createElement('div');
  header.className = 'detail-header';

  const poster = document.createElement('img');
  poster.className = 'detail-poster';
  poster.src = buildImageUrl(movie.poster_path);
  poster.alt = movie.title || 'Movie';

  const meta = document.createElement('div');
  meta.className = 'detail-meta';

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = movie.title;

  const chips = document.createElement('div');
  chips.className = 'detail-chips';

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  if (year) chips.appendChild(createChip(String(year)));

  if (movie.runtime) chips.appendChild(createChip(`${movie.runtime} min`));

  if (movie.vote_average) {
    chips.appendChild(createChip(`★ ${movie.vote_average.toFixed(1)}`));
  }

  if (Array.isArray(movie.genres) && movie.genres.length) {
    chips.appendChild(createChip(movie.genres.map((g) => g.name).join(', ')));
  }

  const overview = document.createElement('p');
  overview.className = 'detail-overview';
  overview.textContent = movie.overview || 'No overview available.';

  meta.appendChild(renderBreadcrumb(['Home', 'Movie', movie.title]));
  meta.appendChild(title);
  meta.appendChild(chips);
  meta.appendChild(overview);

  header.appendChild(poster);
  header.appendChild(meta);

  wrapper.appendChild(header);

  // Video player section – resolves a playable HLS stream via the selected provider.
  const playerSection = document.createElement('section');
  playerSection.className = 'video-player-section';

  const playerTitle = document.createElement('div');
  playerTitle.className = 'video-player-title';
  playerTitle.textContent = 'Watch now';

  const videoEl = document.createElement('video');
  videoEl.className = 'video-player';
  videoEl.controls = true;
  videoEl.playsInline = true;

  const statusEl = document.createElement('p');
  statusEl.className = 'detail-overview';
  const initialProviderLabel =
    getCurrentProvider() === 'filmex' ? 'Filmex' : 'VidLink';
  statusEl.textContent = `Resolving stream via ${initialProviderLabel}…`;

  playerSection.appendChild(playerTitle);
  playerSection.appendChild(videoEl);
  playerSection.appendChild(statusEl);

  wrapper.appendChild(playerSection);

  // Track active playback context for provider switching.
  currentPlayback = {
    kind: 'movie',
    movie,
    videoEl,
    statusEl,
  };

  // Kick off playback for this movie.
  startMoviePlayback(movie, videoEl, statusEl);

  const cast = movie.credits && Array.isArray(movie.credits.cast)
    ? movie.credits.cast.slice(0, 8)
    : [];

  if (cast.length) {
    const castSection = document.createElement('section');
    castSection.className = 'detail-subsection';

    castSection.appendChild(renderSectionTitle('Top Cast'));

    const castList = document.createElement('div');
    castList.className = 'detail-cast-list';

    for (const person of cast) {
      const item = document.createElement('div');
      item.className = 'detail-cast-item';
      const name = document.createElement('div');
      name.className = 'detail-cast-name';
      name.textContent = person.name;
      const role = document.createElement('div');
      role.className = 'detail-cast-role';
      role.textContent = person.character || 'Cast';

      item.appendChild(name);
      item.appendChild(role);
      castList.appendChild(item);
    }

    castSection.appendChild(castList);
    wrapper.appendChild(castSection);
  }

  const recs =
    movie.recommendations && Array.isArray(movie.recommendations.results)
      ? movie.recommendations.results.slice(0, 10)
      : [];

  if (recs.length) {
    const recSection = document.createElement('section');
    recSection.className = 'detail-subsection';
    recSection.appendChild(renderSectionTitle('You might also like'));

    const recRow = document.createElement('div');
    recRow.className = 'cards';

    for (const item of recs) {
      const card = createCard(item, 'movie');
      card.addEventListener('click', () => navigateToItem(item, 'movie'));
      recRow.appendChild(card);
    }

    recSection.appendChild(recRow);
    wrapper.appendChild(recSection);
  }

  detailView.appendChild(wrapper);
}

async function openMovie(id) {
  try {
    const movie = await fetchJson(`/api/movie/${id}`);
    renderMovieDetail(movie);
  } catch (error) {
    console.error('Failed to open movie', error);
  }
}

// TV: SHOW / SEASONS / EPISODES

function renderTvSeasons(tv) {
  if (!detailView) return;
  showDetail();
  detailView.innerHTML = '';
  currentPlayback = null;

  const wrapper = document.createElement('section');
  wrapper.className = 'detail-wrapper';

  const header = document.createElement('div');
  header.className = 'detail-header';

  const poster = document.createElement('img');
  poster.className = 'detail-poster';
  poster.src = buildImageUrl(tv.poster_path);
  poster.alt = tv.name || 'Series';

  const meta = document.createElement('div');
  meta.className = 'detail-meta';

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = tv.name;

  const chips = document.createElement('div');
  chips.className = 'detail-chips';

  const firstYear = tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : '';
  if (firstYear) chips.appendChild(createChip(String(firstYear)));

  if (typeof tv.number_of_seasons === 'number') {
    chips.appendChild(createChip(`${tv.number_of_seasons} season(s)`));
  }

  if (tv.vote_average) {
    chips.appendChild(createChip(`★ ${tv.vote_average.toFixed(1)}`));
  }

  const overview = document.createElement('p');
  overview.className = 'detail-overview';
  overview.textContent = tv.overview || 'No overview available.';

  meta.appendChild(renderBreadcrumb(['Home', 'Series', tv.name]));
  meta.appendChild(title);
  meta.appendChild(chips);
  meta.appendChild(overview);

  header.appendChild(poster);
  header.appendChild(meta);

  wrapper.appendChild(header);

  const seasons = Array.isArray(tv.seasons)
    ? tv.seasons.filter((s) => s.season_number > 0 && s.episode_count > 0)
    : [];

  if (seasons.length) {
    const seasonSection = document.createElement('section');
    seasonSection.className = 'detail-subsection';
    seasonSection.appendChild(renderSectionTitle('Select a season'));

    const seasonList = document.createElement('div');
    seasonList.className = 'detail-season-list';

    for (const season of seasons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'season-pill';
      btn.textContent = `Season ${season.season_number} (${season.episode_count} eps)`;
      btn.addEventListener('click', () =>
        openSeason(tv.id, season.season_number, tv)
      );
      seasonList.appendChild(btn);
    }

    seasonSection.appendChild(seasonList);
    wrapper.appendChild(seasonSection);
  }

  detailView.appendChild(wrapper);
}

async function openTv(id) {
  try {
    const tv = await fetchJson(`/api/tv/${id}`);
    renderTvSeasons(tv);
  } catch (error) {
    console.error('Failed to open series', error);
  }
}

function renderSeasonEpisodes(tv, season) {
  if (!detailView) return;
  showDetail();
  detailView.innerHTML = '';
  currentPlayback = null;

  const wrapper = document.createElement('section');
  wrapper.className = 'detail-wrapper';

  const headerRow = document.createElement('div');
  headerRow.className = 'detail-header-row';

  const backToSeasons = document.createElement('button');
  backToSeasons.type = 'button';
  backToSeasons.className = 'back-button';
  backToSeasons.textContent = '← Back to seasons';
  backToSeasons.addEventListener('click', () => renderTvSeasons(tv));

  headerRow.appendChild(backToSeasons);
  headerRow.appendChild(renderBreadcrumb([
    'Home',
    'Series',
    tv.name,
    `Season ${season.season_number}`,
  ]));

  wrapper.appendChild(headerRow);

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = `${tv.name} — Season ${season.season_number}`;
  wrapper.appendChild(title);

  const episodes = Array.isArray(season.episodes) ? season.episodes : [];

  if (episodes.length) {
    const list = document.createElement('div');
    list.className = 'episode-list';

    for (const ep of episodes) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'episode-row';

      const label = document.createElement('div');
      label.className = 'episode-label';
      label.textContent = `E${ep.episode_number}: ${ep.name}`;

      const meta = document.createElement('div');
      meta.className = 'episode-meta';
      const bits = [];
      if (ep.runtime) bits.push(`${ep.runtime} min`);
      if (ep.air_date) bits.push(new Date(ep.air_date).toLocaleDateString());
      meta.textContent = bits.join(' • ');

      row.appendChild(label);
      row.appendChild(meta);

      row.addEventListener('click', () =>
        openEpisode(tv.id, season.season_number, ep.episode_number, tv, season)
      );

      list.appendChild(row);
    }

    wrapper.appendChild(list);
  } else {
    const empty = document.createElement('p');
    empty.className = 'detail-overview';
    empty.textContent = 'No episode information available for this season.';
    wrapper.appendChild(empty);
  }

  detailView.appendChild(wrapper);
}

async function openSeason(tvId, seasonNumber, tv) {
  try {
    const season = await fetchJson(`/api/tv/${tvId}/season/${seasonNumber}`);
    renderSeasonEpisodes(tv, season);
  } catch (error) {
    console.error('Failed to load season', error);
  }
}

function renderEpisodeDetail(tv, season, episode) {
  if (!detailView) return;
  showDetail();
  detailView.innerHTML = '';

  const wrapper = document.createElement('section');
  wrapper.className = 'detail-wrapper';

  const headerRow = document.createElement('div');
  headerRow.className = 'detail-header-row';

  const backToEpisodes = document.createElement('button');
  backToEpisodes.type = 'button';
  backToEpisodes.className = 'back-button';
  backToEpisodes.textContent = '← Back to episodes';
  backToEpisodes.addEventListener('click', () =>
    renderSeasonEpisodes(tv, season)
  );

  headerRow.appendChild(backToEpisodes);
  headerRow.appendChild(
    renderBreadcrumb([
      'Home',
      'Series',
      tv.name,
      `Season ${season.season_number}`,
      `Episode ${episode.episode_number}`,
    ])
  );

  wrapper.appendChild(headerRow);

  const header = document.createElement('div');
  header.className = 'detail-header';

  const still = document.createElement('img');
  still.className = 'detail-poster';
  still.src = buildImageUrl(
    episode.still_path || tv.poster_path,
    episode.still_path ? BACKDROP_BASE : IMAGE_BASE
  );
  still.alt = episode.name || 'Episode';

  const meta = document.createElement('div');
  meta.className = 'detail-meta';

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = `S${season.season_number} • E${episode.episode_number} — ${episode.name}`;

  const chips = document.createElement('div');
  chips.className = 'detail-chips';

  if (episode.runtime) chips.appendChild(createChip(`${episode.runtime} min`));

  if (episode.air_date) {
    const date = new Date(episode.air_date).toLocaleDateString();
    chips.appendChild(createChip(date));
  }

  if (episode.vote_average) {
    chips.appendChild(createChip(`★ ${episode.vote_average.toFixed(1)}`));
  }

  const overview = document.createElement('p');
  overview.className = 'detail-overview';
  overview.textContent = episode.overview || 'No overview available.';

  meta.appendChild(title);
  meta.appendChild(chips);
  meta.appendChild(overview);

  header.appendChild(still);
  header.appendChild(meta);

  wrapper.appendChild(header);

    // Video player section – resolves a playable HLS stream for this episode.
    const playerSection = document.createElement('section');
    playerSection.className = 'video-player-section';

  const playerTitle = document.createElement('div');
  playerTitle.className = 'video-player-title';
  playerTitle.textContent = 'Watch episode';

  const videoEl = document.createElement('video');
  videoEl.className = 'video-player';
  videoEl.controls = true;
  videoEl.playsInline = true;

  const statusEl = document.createElement('p');
  statusEl.className = 'detail-overview';
  const initialProviderLabel =
    getCurrentProvider() === 'filmex' ? 'Filmex' : 'VidLink';
  statusEl.textContent = `Resolving stream via ${initialProviderLabel}…`;

  playerSection.appendChild(playerTitle);
  playerSection.appendChild(videoEl);
  playerSection.appendChild(statusEl);

  wrapper.appendChild(playerSection);

  // Track active playback context for provider switching.
  currentPlayback = {
    kind: 'tv',
    tv,
    season,
    episode,
    videoEl,
    statusEl,
  };

  // Kick off playback for this TV episode.
  startEpisodePlayback(tv, season, episode, videoEl, statusEl);

  const credits =
    episode.credits && Array.isArray(episode.credits.cast)
      ? episode.credits.cast.slice(0, 6)
      : [];

  if (credits.length) {
    const castSection = document.createElement('section');
    castSection.className = 'detail-subsection';
    castSection.appendChild(renderSectionTitle('Episode Cast'));

    const castList = document.createElement('div');
    castList.className = 'detail-cast-list';

    for (const person of credits) {
      const item = document.createElement('div');
      item.className = 'detail-cast-item';
      const name = document.createElement('div');
      name.className = 'detail-cast-name';
      name.textContent = person.name;
      const role = document.createElement('div');
      role.className = 'detail-cast-role';
      role.textContent = person.character || 'Cast';

      item.appendChild(name);
      item.appendChild(role);
      castList.appendChild(item);
    }

    castSection.appendChild(castList);
    wrapper.appendChild(castSection);
  }

  detailView.appendChild(wrapper);
}

async function openEpisode(tvId, seasonNumber, episodeNumber, tv, season) {
  try {
    const episode = await fetchJson(
      `/api/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
    );
    renderEpisodeDetail(tv, season, episode);
  } catch (error) {
    console.error('Failed to load episode', error);
  }
}

// INITIALIZATION

function setupHomeButton() {
  if (!homeButton) return;
  homeButton.addEventListener('click', () => {
    showHome();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  showHome();
  initRows().catch((err) => console.error(err));
  setupSearch();
  setupProviderToggle();
  setupHomeButton();
});