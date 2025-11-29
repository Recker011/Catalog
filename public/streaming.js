'use strict';

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
      // Attach extra context where available.
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
 * Attach an already-resolved external stream URL (for example, from the
 * /v3/cricket/match/streams endpoint) to a <video> element. Uses Hls.js
 * when appropriate and falls back to direct MP4 playback.
 *
 * @param {{ url: string, format?: string }} stream
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLElement} [statusEl]
 */
async function attachExternalStreamToVideo(stream, videoEl, statusEl) {
  if (!videoEl || !stream || !stream.url) {
    if (statusEl) {
      statusEl.textContent = 'Stream is not available.';
    }
    return;
  }

  const url = stream.url;
  let format = (stream.format || '').toLowerCase();

  // Try to infer format from URL when not provided.
  if (!format) {
    if (/\.m3u8($|\?)/i.test(url)) {
      format = 'hls';
    } else if (/\.mp4($|\?)/i.test(url)) {
      format = 'mp4';
    } else {
      format = 'unknown';
    }
  }

  if (statusEl) {
    statusEl.textContent = 'Loading stream…';
  }

  // Reset any existing source and Hls.js instance.
  cleanupHls();
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();

  const HlsConstructor = typeof window !== 'undefined' ? window.Hls : null;

  try {
    const isHlsFormat =
      format === 'hls' || /\.m3u8($|\?)/i.test(url);

    if (isHlsFormat) {
      if (HlsConstructor && HlsConstructor.isSupported && HlsConstructor.isSupported()) {
        const hls = new HlsConstructor();
        currentHlsInstance = hls;
        hls.loadSource(url);
        hls.attachMedia(videoEl);
        hls.on(HlsConstructor.Events.MANIFEST_PARSED, () => {
          videoEl.play().catch(() => {});
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = url;
        videoEl.play().catch(() => {});
      } else {
        throw new Error('HLS playback is not supported in this browser.');
      }
    } else {
      // Treat as direct file (MP4 or similar).
      videoEl.src = url;
      videoEl.play().catch(() => {});
    }

    videoEl.dataset.provider = stream.provider || 'cricket';

    if (statusEl) {
      statusEl.textContent = '';
    }
  } catch (error) {
    console.error('Failed to attach external stream', error);
    if (statusEl) {
      statusEl.textContent =
        error && error.message ? error.message : 'Failed to start playback.';
    }
    throw error;
  }
}

/**
 * Convenience wrapper for starting movie playback given a TMDB movie object.
 */
async function startMoviePlayback(movie, videoEl, statusEl) {
  if (!movie || !movie.id) return;

  const providerLabel =
    getCurrentProvider() === 'filmex' ? 'Filmex' : 'VidLink';

  // Create enhanced loading state
  if (statusEl && typeof window.LoadingUtils !== 'undefined') {
    statusEl.innerHTML = '';
    const statusWithLoader = window.LoadingUtils.createStatusWithLoader(
      `Resolving stream via ${providerLabel}…`,
      'spinner'
    );
    statusEl.appendChild(statusWithLoader);
    
    // Show toast for long loading operation
    window.LoadingUtils.showToast(
      `Loading "${movie.title}" via ${providerLabel}...`,
      'loading',
      0,
      true
    );
  } else if (statusEl) {
    statusEl.textContent = `Resolving stream via ${providerLabel}…`;
  }

  // Add loading overlay to video element
  let videoOverlay = null;
  if (videoEl && typeof window.LoadingUtils !== 'undefined') {
    videoEl.classList.add('video-player--loading');
    videoOverlay = window.LoadingUtils.createVideoLoadingOverlay(
      `Resolving stream via ${providerLabel}…`
    );
    
    // Position the overlay relative to the video element
    const videoContainer = videoEl.parentNode;
    if (videoContainer) {
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(videoOverlay);
    }
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
    
    // Clean up loading states
    if (statusEl && typeof window.LoadingUtils !== 'undefined') {
      statusEl.textContent = '';
    }
    
    if (videoOverlay && videoOverlay.parentNode) {
      videoOverlay.remove();
    }
    
    if (videoEl) {
      videoEl.classList.remove('video-player--loading');
    }
    
    // Hide loading toast and show success
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Successfully loaded "${movie.title}"`,
        'success',
        3000
      );
    }
  } catch (error) {
    console.error('Failed to start movie playback', error);
    
    // Clean up loading states
    if (videoOverlay && videoOverlay.parentNode) {
      videoOverlay.remove();
    }
    
    if (videoEl) {
      videoEl.classList.remove('video-player--loading');
    }
    
    // Show error state
    if (statusEl && typeof window.LoadingUtils !== 'undefined') {
      statusEl.textContent = '';
      const errorStatus = window.LoadingUtils.createStatusWithLoader(
        error && error.message ? error.message : 'Failed to start playback.',
        'dots'
      );
      statusEl.appendChild(errorStatus);
    } else if (statusEl) {
      statusEl.textContent =
        error && error.message
          ? error.message
          : 'Failed to start playback.';
    }
    
    // Hide loading toast and show error
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Failed to load "${movie.title}"`,
        'error',
        5000
      );
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
  const episodeTitle = episode.name || `Episode ${episode.episode_number}`;

  // Create enhanced loading state
  if (statusEl && typeof window.LoadingUtils !== 'undefined') {
    statusEl.innerHTML = '';
    const statusWithLoader = window.LoadingUtils.createStatusWithLoader(
      `Resolving ${episodeTitle} via ${providerLabel}…`,
      'spinner'
    );
    statusEl.appendChild(statusWithLoader);
    
    // Show toast for long loading operation
    window.LoadingUtils.showToast(
      `Loading ${episodeTitle} via ${providerLabel}...`,
      'loading',
      0,
      true
    );
  } else if (statusEl) {
    statusEl.textContent = `Resolving stream via ${providerLabel}…`;
  }

  // Add loading overlay to video element
  let videoOverlay = null;
  if (videoEl && typeof window.LoadingUtils !== 'undefined') {
    videoEl.classList.add('video-player--loading');
    videoOverlay = window.LoadingUtils.createVideoLoadingOverlay(
      `Resolving ${episodeTitle} via ${providerLabel}…`
    );
    
    // Position the overlay relative to the video element
    const videoContainer = videoEl.parentNode;
    if (videoContainer) {
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(videoOverlay);
    }
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
    
    // Clean up loading states
    if (statusEl && typeof window.LoadingUtils !== 'undefined') {
      statusEl.textContent = '';
    }
    
    if (videoOverlay && videoOverlay.parentNode) {
      videoOverlay.remove();
    }
    
    if (videoEl) {
      videoEl.classList.remove('video-player--loading');
    }
    
    // Hide loading toast and show success
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Successfully loaded ${episodeTitle}`,
        'success',
        3000
      );
    }
  } catch (error) {
    console.error('Failed to start episode playback', error);
    
    // Clean up loading states
    if (videoOverlay && videoOverlay.parentNode) {
      videoOverlay.remove();
    }
    
    if (videoEl) {
      videoEl.classList.remove('video-player--loading');
    }
    
    // Show error state
    if (statusEl && typeof window.LoadingUtils !== 'undefined') {
      statusEl.textContent = '';
      const errorStatus = window.LoadingUtils.createStatusWithLoader(
        error && error.message ? error.message : 'Failed to start playback.',
        'dots'
      );
      statusEl.appendChild(errorStatus);
    } else if (statusEl) {
      statusEl.textContent =
        error && error.message
          ? error.message
          : 'Failed to start playback.';
    }
    
    // Hide loading toast and show error
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Failed to load ${episodeTitle}`,
        'error',
        5000
      );
    }
  }
}