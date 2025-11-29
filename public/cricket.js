'use strict';

(function () {
  const root = document.getElementById('cricket-view');
  if (!root) {
    return;
  }

  const API_BASE =
    (typeof window !== 'undefined' && window.VIDLINK_PROXY_BASE) ||
    'http://localhost:4000';

  class CricketStreamingAPI {
    constructor(baseUrl) {
      this.baseUrl = baseUrl || API_BASE;
    }

    async getCategories() {
      const res = await fetch(`${this.baseUrl}/v3/cricket/categories`);
      return res.json();
    }

    async getMatches(slug) {
      const res = await fetch(
        `${this.baseUrl}/v3/cricket/category/${encodeURIComponent(slug)}/matches`
      );
      return res.json();
    }

    async getStreams(matchUrl) {
      const res = await fetch(
        `${this.baseUrl}/v3/cricket/match/streams?matchUrl=${encodeURIComponent(
          matchUrl
        )}`
      );
      return res.json();
    }

    async getAllData() {
      const res = await fetch(`${this.baseUrl}/v3/cricket/all`);
      return res.json();
    }
  }

  const state = {
    initialized: false,
    loading: false,
    error: null,
    categories: [],
    selectedCategorySlug: null,
    matches: [],
    selectedMatchUrl: null,
    streams: [],
  };

  const api = new CricketStreamingAPI(API_BASE);

  let videoEl = null;
  let statusEl = null;

  function setLoading(isLoading) {
    state.loading = isLoading;
    render();
  }

  function setError(message) {
    state.error = message || null;
    render();
  }

  function render() {
    root.innerHTML = '';

    const wrapper = document.createElement('section');
    wrapper.className = 'cricket-wrapper';

    const header = document.createElement('header');
    header.className = 'cricket-header';

    const title = document.createElement('h2');
    title.className = 'cricket-title';
    title.textContent = 'Live Cricket';

    const subtitle = document.createElement('p');
    subtitle.className = 'cricket-subtitle';
    subtitle.textContent =
      'Browse categories, pick a match, and start streaming live cricket.';

    header.appendChild(title);
    header.appendChild(subtitle);
    wrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'cricket-body';

    const leftCol = document.createElement('section');
    leftCol.className = 'cricket-column cricket-column--categories';

    const categoriesHeader = document.createElement('h3');
    categoriesHeader.className = 'cricket-section-title';
    categoriesHeader.textContent = 'Categories';
    leftCol.appendChild(categoriesHeader);

    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'cricket-categories';
    if (state.categories.length === 0 && !state.loading && !state.error) {
      const empty = document.createElement('p');
      empty.className = 'cricket-empty';
      empty.textContent = 'No categories available.';
      categoriesContainer.appendChild(empty);
    } else {
      for (const category of state.categories) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cricket-chip';
        if (category.slug === state.selectedCategorySlug) {
          btn.classList.add('active');
        }
        btn.textContent = category.name;
        btn.addEventListener('click', () => {
          onCategorySelected(category);
        });
        categoriesContainer.appendChild(btn);
      }
    }
    leftCol.appendChild(categoriesContainer);

    body.appendChild(leftCol);

    const middleCol = document.createElement('section');
    middleCol.className = 'cricket-column cricket-column--matches';

    const matchesHeader = document.createElement('h3');
    matchesHeader.className = 'cricket-section-title';
    matchesHeader.textContent = state.selectedCategorySlug
      ? 'Matches'
      : 'Matches (select a category)';
    middleCol.appendChild(matchesHeader);

    const matchesContainer = document.createElement('div');
    matchesContainer.className = 'cricket-matches';

    if (state.loading && state.matches.length === 0 && state.categories.length === 0) {
      const loading = document.createElement('p');
      loading.className = 'cricket-status';
      loading.textContent = 'Loading categories…';
      matchesContainer.appendChild(loading);
    } else if (
      state.selectedCategorySlug &&
      state.matches.length === 0 &&
      !state.loading &&
      !state.error
    ) {
      const emptyMatches = document.createElement('p');
      emptyMatches.className = 'cricket-empty';
      emptyMatches.textContent = 'No matches are currently listed in this category.';
      matchesContainer.appendChild(emptyMatches);
    } else {
      for (const match of state.matches) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'cricket-match-row';
        if (match.url === state.selectedMatchUrl) {
          row.classList.add('active');
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'cricket-match-title';
        titleEl.textContent = match.title;

        const metaEl = document.createElement('div');
        metaEl.className = 'cricket-match-meta';
        if (match.streamLinks && match.streamLinks.length) {
          metaEl.textContent = match.streamLinks.map((l) => l.name).join(' • ');
        } else {
          metaEl.textContent = 'Streams will be resolved on selection.';
        }

        row.appendChild(titleEl);
        row.appendChild(metaEl);

        row.addEventListener('click', () => {
          onMatchSelected(match);
        });

        matchesContainer.appendChild(row);
      }
    }

    middleCol.appendChild(matchesContainer);
    body.appendChild(middleCol);

    const rightCol = document.createElement('section');
    rightCol.className = 'cricket-column cricket-column--player';

    const playerCard = document.createElement('div');
    playerCard.className = 'cricket-player-card';

    const playerTitle = document.createElement('div');
    playerTitle.className = 'cricket-section-title';
    playerTitle.textContent = 'Live stream';
    playerCard.appendChild(playerTitle);

    videoEl = document.createElement('video');
    videoEl.className = 'video-player';
    videoEl.controls = true;
    videoEl.playsInline = true;

    statusEl = document.createElement('p');
    statusEl.className = 'detail-overview cricket-player-status';
    if (state.loading && state.matches.length > 0) {
      statusEl.textContent = 'Loading streams…';
    } else {
      statusEl.textContent = 'Select a match to start streaming.';
    }

    const streamsContainer = document.createElement('div');
    streamsContainer.className = 'cricket-streams';

    if (state.streams.length > 0) {
      for (const stream of state.streams) {
        const sBtn = document.createElement('button');
        sBtn.type = 'button';
        sBtn.className = 'cricket-stream-chip';
        sBtn.textContent =
          stream.quality && stream.quality !== 'unknown'
            ? `${stream.format || 'Stream'} — ${stream.quality}`
            : stream.format || 'Stream';

        sBtn.addEventListener('click', () => {
          onStreamSelected(stream);
        });

        streamsContainer.appendChild(sBtn);
      }
    } else {
      const hint = document.createElement('p');
      hint.className = 'cricket-empty';
      hint.textContent =
        'Available streams for the selected match will appear here.';
      streamsContainer.appendChild(hint);
    }

    playerCard.appendChild(videoEl);
    playerCard.appendChild(statusEl);
    playerCard.appendChild(streamsContainer);

    rightCol.appendChild(playerCard);
    body.appendChild(rightCol);

    wrapper.appendChild(body);

    if (state.error) {
      const errorEl = document.createElement('div');
      errorEl.className = 'error';
      errorEl.textContent = state.error;
      wrapper.insertBefore(errorEl, body);
    } else if (state.loading && state.categories.length === 0) {
      const loadingEl = document.createElement('div');
      loadingEl.className = 'loading';
      loadingEl.textContent = 'Loading cricket data…';
      wrapper.insertBefore(loadingEl, body);
    }

    root.appendChild(wrapper);
  }

  async function loadCategories() {
    setLoading(true);
    
    // Show loading toast for cricket categories
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.showToast(
        'Loading cricket categories...',
        'loading',
        0,
        true
      );
    }
    
    try {
      const data = await api.getCategories();
      if (!data || !data.ok) {
        throw new Error(
          (data && (data.message || data.error)) ||
            'Failed to load categories.'
        );
      }
      state.categories = data.data || [];
      if (state.categories.length > 0 && !state.selectedCategorySlug) {
        state.selectedCategorySlug = state.categories[0].slug;
        await loadMatches(state.selectedCategorySlug);
      } else {
        setLoading(false);
        
        // Hide loading toast and show success
        if (typeof window.LoadingUtils !== 'undefined') {
          window.LoadingUtils.hideAllToasts('loading');
          window.LoadingUtils.showToast(
            'Cricket categories loaded',
            'success',
            2000
          );
        }
      }
    } catch (error) {
      console.error('Failed to load cricket categories', error);
      setError('Failed to load cricket categories.');
      state.loading = false;
      
      // Hide loading toast and show error
      if (typeof window.LoadingUtils !== 'undefined') {
        window.LoadingUtils.hideAllToasts('loading');
        window.LoadingUtils.showToast(
          'Failed to load cricket categories',
          'error',
          5000
        );
      }
    } finally {
      if (!state.loading) {
        render();
      }
    }
  }

  async function loadMatches(slug) {
    if (!slug) return;
    setLoading(true);
    
    // Find category name for toast message
    const category = state.categories.find(cat => cat.slug === slug);
    const categoryName = category ? category.name : 'category';
    
    // Show loading toast for cricket matches
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.showToast(
        `Loading matches for ${categoryName}...`,
        'loading',
        0,
        true
      );
    }
    
    try {
      const data = await api.getMatches(slug);
      if (!data || !data.ok) {
        throw new Error(
          (data && (data.message || data.error)) ||
            'Failed to load matches.'
        );
      }
      state.matches = data.data || [];
      state.selectedMatchUrl = null;
      state.streams = [];
      setLoading(false);
      
      // Hide loading toast and show success
      if (typeof window.LoadingUtils !== 'undefined') {
        window.LoadingUtils.hideAllToasts('loading');
        window.LoadingUtils.showToast(
          `Loaded matches for ${categoryName}`,
          'success',
          2000
        );
      }
    } catch (error) {
      console.error('Failed to load cricket matches', error);
      setError('Failed to load matches for this category.');
      state.loading = false;
      
      // Hide loading toast and show error
      if (typeof window.LoadingUtils !== 'undefined') {
        window.LoadingUtils.hideAllToasts('loading');
        window.LoadingUtils.showToast(
          'Failed to load cricket matches',
          'error',
          5000
        );
      }
    } finally {
      render();
    }
  }

  async function loadStreams(match) {
    if (!match || !match.url) return;
    setLoading(true);
    
    // Show loading toast for stream resolution
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.showToast(
        `Resolving streams for ${match.title}...`,
        'loading',
        0,
        true
      );
    }
    
    try {
      const data = await api.getStreams(match.url);
      if (!data || !data.ok) {
        throw new Error(
          (data && (data.message || data.error)) ||
            'Failed to load streams.'
        );
      }
      state.streams = data.data || [];
      state.selectedMatchUrl = match.url;
      setLoading(false);
      render();
      
      // Hide loading toast
      if (typeof window.LoadingUtils !== 'undefined') {
        window.LoadingUtils.hideAllToasts('loading');
      }
      
      if (state.streams.length > 0) {
        await playStream(state.streams[0]);
      } else if (statusEl) {
        statusEl.textContent = 'No streams are currently available for this match.';
      }
    } catch (error) {
      console.error('Failed to load cricket streams', error);
      setError('Failed to load streams for this match.');
      state.loading = false;
      
      // Hide loading toast and show error
      if (typeof window.LoadingUtils !== 'undefined') {
        window.LoadingUtils.hideAllToasts('loading');
        window.LoadingUtils.showToast(
          'Failed to resolve cricket streams',
          'error',
          5000
        );
      }
    }
  }

  function onCategorySelected(category) {
    if (!category || category.slug === state.selectedCategorySlug) {
      return;
    }
    state.selectedCategorySlug = category.slug;
    state.matches = [];
    state.selectedMatchUrl = null;
    state.streams = [];
    loadMatches(category.slug);
  }

  function onMatchSelected(match) {
    if (!match) return;
    
    // Add loading state to the selected match row
    const matchRows = document.querySelectorAll('.cricket-match-row');
    matchRows.forEach(row => {
      if (row.querySelector('.cricket-match-title')?.textContent === match.title) {
        if (typeof window.LoadingUtils !== 'undefined') {
          window.LoadingUtils.setCricketMatchLoading(row);
        }
      }
    });
    
    loadStreams(match);
  }

  function onStreamSelected(stream) {
    // Add loading state to the selected stream chip
    const streamChips = document.querySelectorAll('.cricket-stream-chip');
    streamChips.forEach(chip => {
      const chipText = chip.textContent;
      const streamText = stream.quality && stream.quality !== 'unknown'
        ? `${stream.format || 'Stream'} — ${stream.quality}`
        : stream.format || 'Stream';
      
      if (chipText === streamText) {
        if (typeof window.LoadingUtils !== 'undefined') {
          window.LoadingUtils.setCricketStreamLoading(chip);
        }
      }
    });
    
    playStream(stream);
  }

  async function playStream(stream) {
    if (!videoEl || !stream || !stream.url) {
      return;
    }
    
    const streamTitle = stream.quality && stream.quality !== 'unknown'
      ? `${stream.format || 'Stream'} — ${stream.quality}`
      : stream.format || 'Stream';

    // Create enhanced loading state
    if (statusEl && typeof window.LoadingUtils !== 'undefined') {
      statusEl.innerHTML = '';
      const statusWithLoader = window.LoadingUtils.createStatusWithLoader(
        `Loading ${streamTitle}…`,
        'spinner'
      );
      statusEl.appendChild(statusWithLoader);
      
      // Show toast for long loading operation (cricket streams take ~7 seconds)
      window.LoadingUtils.showToast(
        `Loading cricket stream... This may take a few seconds.`,
        'loading',
        0,
        true
      );
    } else if (statusEl) {
      statusEl.textContent = 'Loading stream…';
    }

    // Add loading overlay to video element
    let videoOverlay = null;
    if (videoEl && typeof window.LoadingUtils !== 'undefined') {
      videoEl.classList.add('video-player--loading');
      videoOverlay = window.LoadingUtils.createVideoLoadingOverlay(
        `Loading ${streamTitle}…`
      );
      
      // Position the overlay relative to the video element
      const videoContainer = videoEl.parentNode;
      if (videoContainer) {
        videoContainer.style.position = 'relative';
        videoContainer.appendChild(videoOverlay);
      }
    }

    try {
      if (typeof attachExternalStreamToVideo === 'function') {
        await attachExternalStreamToVideo(stream, videoEl, statusEl);
      } else {
        videoEl.src = stream.url;
        await videoEl.play().catch(() => {});
        if (statusEl) {
          statusEl.textContent = '';
        }
      }
      
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
          `Successfully loaded cricket stream`,
          'success',
          3000
        );
      }
    } catch (error) {
      console.error('Failed to start cricket stream', error);
      
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
          (error && error.message) || 'Failed to start playback.',
          'dots'
        );
        statusEl.appendChild(errorStatus);
      } else if (statusEl) {
        statusEl.textContent =
          (error && error.message) || 'Failed to start playback.';
      }
      
      // Hide loading toast and show error
      if (typeof window.LoadingUtils !== 'undefined') {
        window.LoadingUtils.hideAllToasts('loading');
        window.LoadingUtils.showToast(
          'Failed to load cricket stream',
          'error',
          5000
        );
      }
    }
  }

  function ensureInitialized() {
    if (state.initialized) {
      return;
    }
    state.initialized = true;
    render();
    loadCategories();
  }

  window.cricketEnsureInitialized = ensureInitialized;

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', ensureInitialized);
  } else {
    ensureInitialized();
  }
})();