'use strict';

const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const homeButton = document.getElementById('home-button');

const cricketView = document.getElementById('cricket-view');
const cricketButton = document.getElementById('cricket-button');

/**
 * Show the home grid and hide any active detail view.
 */
function showHome() {
  if (!homeView || !detailView) return;

  homeView.style.display = 'flex';
  detailView.style.display = 'none';
  detailView.innerHTML = '';

  if (cricketView) {
    cricketView.style.display = 'none';
  }

  if (typeof cleanupHls === 'function') {
    cleanupHls();
  }

  window.currentPlayback = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (homeButton) {
    homeButton.classList.add('active');
  }
  if (cricketButton) {
    cricketButton.classList.remove('active');
  }
}

/**
 * Show the detail view and hide the home grid.
 */
function showDetail() {
  if (!homeView || !detailView) return;

  homeView.style.display = 'none';
  detailView.style.display = 'block';

  if (cricketView) {
    cricketView.style.display = 'none';
  }

  if (typeof cleanupHls === 'function') {
    cleanupHls();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (homeButton) {
    homeButton.classList.remove('active');
  }
  if (cricketButton) {
    cricketButton.classList.remove('active');
  }
}

/**
 * Navigate from a generic TMDB search/list item into the correct detail view.
 */
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

/**
 * Render the movie detail page, including a video player and related content.
 */
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
  window.currentPlayback = {
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

/**
 * Fetch and open a movie detail page.
 */
async function openMovie(id) {
  // Show loading toast for movie details
  if (typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.showToast(
      'Loading movie details...',
      'loading',
      0,
      true
    );
  }
  
  try {
    const movie = await fetchJson(`/api/movie/${id}`);
    renderMovieDetail(movie);
    
    // Hide loading toast and show success
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Loaded "${movie.title}"`,
        'success',
        2000
      );
    }
  } catch (error) {
    console.error('Failed to open movie', error);
    
    // Hide loading toast and show error
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        'Failed to load movie details',
        'error',
        5000
      );
    }
  }
}

// TV: SHOW / SEASONS / EPISODES

function renderTvSeasons(tv) {
  if (!detailView) return;
  showDetail();
  detailView.innerHTML = '';
  window.currentPlayback = null;

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
      btn.addEventListener('click', function() {
        if (typeof window.LoadingUtils !== 'undefined') {
          window.LoadingUtils.setButtonLoading(btn, `Season ${season.season_number}`);
        }
        openSeason(tv.id, season.season_number, tv);
      });
      seasonList.appendChild(btn);
    }

    seasonSection.appendChild(seasonList);
    wrapper.appendChild(seasonSection);
  }

  detailView.appendChild(wrapper);
}

async function openTv(id) {
  // Show loading toast for TV series details
  if (typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.showToast(
      'Loading series details...',
      'loading',
      0,
      true
    );
  }
  
  try {
    const tv = await fetchJson(`/api/tv/${id}`);
    renderTvSeasons(tv);
    
    // Hide loading toast and show success
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Loaded "${tv.name}"`,
        'success',
        2000
      );
    }
  } catch (error) {
    console.error('Failed to open series', error);
    
    // Hide loading toast and show error
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        'Failed to load series details',
        'error',
        5000
      );
    }
  }
}

function renderSeasonEpisodes(tv, season) {
  if (!detailView) return;
  showDetail();
  detailView.innerHTML = '';
  window.currentPlayback = null;

  const wrapper = document.createElement('section');
  wrapper.className = 'detail-wrapper';

  const headerRow = document.createElement('div');
  headerRow.className = 'detail-header-row';

  const backToSeasons = document.createElement('button');
  backToSeasons.type = 'button';
  backToSeasons.className = 'back-button';
  backToSeasons.textContent = '← Back to seasons';
  backToSeasons.addEventListener('click', function() {
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.setButtonLoading(backToSeasons, '← Back to seasons');
    }
    renderTvSeasons(tv);
  });

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
  // Show loading toast for season details
  if (typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.showToast(
      `Loading Season ${seasonNumber}...`,
      'loading',
      0,
      true
    );
  }
  
  try {
    const season = await fetchJson(`/api/tv/${tvId}/season/${seasonNumber}`);
    renderSeasonEpisodes(tv, season);
    
    // Hide loading toast and show success
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Loaded Season ${seasonNumber}`,
        'success',
        2000
      );
    }
  } catch (error) {
    console.error('Failed to load season', error);
    
    // Hide loading toast and show error
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        'Failed to load season details',
        'error',
        5000
      );
    }
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
  window.currentPlayback = {
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
  // Show loading toast for episode details
  if (typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.showToast(
      `Loading episode details...`,
      'loading',
      0,
      true
    );
  }
  
  try {
    const episode = await fetchJson(
      `/api/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
    );
    renderEpisodeDetail(tv, season, episode);
    
    // Hide loading toast and show success
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        `Loaded episode details`,
        'success',
        2000
      );
    }
  } catch (error) {
    console.error('Failed to load episode', error);
    
    // Hide loading toast and show error
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.hideAllToasts('loading');
      window.LoadingUtils.showToast(
        'Failed to load episode details',
        'error',
        5000
      );
    }
  }
}

/**
 * Wire up the home button in the sidebar.
 */
function showCricket() {
  if (!cricketView || !homeView || !detailView) return;

  homeView.style.display = 'none';
  detailView.style.display = 'none';
  cricketView.style.display = 'block';

  if (typeof cleanupHls === 'function') {
    cleanupHls();
  }

  window.currentPlayback = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (homeButton) {
    homeButton.classList.remove('active');
  }
  if (cricketButton) {
    cricketButton.classList.add('active');
  }

  // Show loading toast for cricket initialization
  if (typeof window.LoadingUtils !== 'undefined') {
    window.LoadingUtils.showToast(
      'Loading cricket streams...',
      'loading',
      0,
      true
    );
  }

  if (typeof window !== 'undefined' && typeof window.cricketEnsureInitialized === 'function') {
    window.cricketEnsureInitialized();
  }
}

/**
 * Wire up the home and cricket buttons in the sidebar.
 */
function setupHomeButton() {
  if (homeButton) {
    homeButton.addEventListener('click', () => {
      showHome();
    });
  }
  if (cricketButton) {
    cricketButton.addEventListener('click', () => {
      showCricket();
    });
  }
}