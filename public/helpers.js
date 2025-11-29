'use strict';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';
const FALLBACK_POSTER =
  'https://via.placeholder.com/300x450/020617/6b7280?text=No+Image';

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

  // Add click handler with loading state
  card.addEventListener('click', function() {
    if (typeof window.LoadingUtils !== 'undefined') {
      window.LoadingUtils.setCardLoading(card);
      
      // Show loading toast for navigation
      window.LoadingUtils.showToast(
        `Opening ${name}...`,
        'loading',
        0,
        true
      );
      
      // Remove loading state after a short delay to prevent UI freezing
      setTimeout(() => {
        window.LoadingUtils.removeCardLoading(card);
      }, 500);
    }
  });

  return card;
}

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