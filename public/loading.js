'use strict';

/**
 * Loading indicator utilities for the CAT-alog application
 * Provides reusable loading components and animations
 */

/**
 * Create a spinner element
 * @param {string} size - 'small', 'medium', or 'large'
 * @returns {HTMLElement} Spinner element
 */
function createSpinner(size = 'medium') {
  const spinner = document.createElement('div');
  spinner.className = `spinner spinner--${size}`;
  return spinner;
}

/**
 * Create a pulse loader element
 * @param {string} size - 'small' or 'medium'
 * @returns {HTMLElement} Pulse loader element
 */
function createPulseLoader(size = 'medium') {
  const pulse = document.createElement('div');
  pulse.className = `pulse-loader${size === 'small' ? ' pulse-loader--small' : ''}`;
  return pulse;
}

/**
 * Create a dots loader element
 * @returns {HTMLElement} Dots loader element
 */
function createDotsLoader() {
  const container = document.createElement('div');
  container.className = 'dots-loader';
  
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'dots-loader__dot';
    container.appendChild(dot);
  }
  
  return container;
}

/**
 * Create a skeleton loader for text
 * @param {string} type - 'text', 'title', 'card', or 'poster'
 * @param {Object} options - Additional options
 * @returns {HTMLElement} Skeleton element
 */
function createSkeleton(type = 'text', options = {}) {
  const skeleton = document.createElement('div');
  skeleton.className = `skeleton skeleton--${type}`;
  
  if (options.width) {
    skeleton.style.width = options.width;
  }
  
  if (options.height) {
    skeleton.style.height = options.height;
  }
  
  return skeleton;
}

/**
 * Create a loading overlay for a container
 * @param {string} message - Loading message to display
 * @param {string} loaderType - Type of loader to use
 * @returns {HTMLElement} Loading overlay element
 */
function createLoadingOverlay(message = 'Loading...', loaderType = 'spinner') {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  
  const content = document.createElement('div');
  content.className = 'loading-overlay__content';
  
  // Add loader based on type
  let loader;
  switch (loaderType) {
    case 'pulse':
      loader = createPulseLoader();
      break;
    case 'dots':
      loader = createDotsLoader();
      break;
    default:
      loader = createSpinner('large');
  }
  
  const text = document.createElement('div');
  text.className = 'loading-overlay__text';
  text.textContent = message;
  
  content.appendChild(loader);
  content.appendChild(text);
  overlay.appendChild(content);
  
  return overlay;
}

/**
 * Create a video player loading overlay
 * @param {string} message - Loading message
 * @returns {HTMLElement} Video player loading overlay
 */
function createVideoLoadingOverlay(message = 'Loading stream...') {
  const overlay = document.createElement('div');
  overlay.className = 'video-player__loading-overlay';
  
  const spinner = createSpinner('large');
  const text = document.createElement('div');
  text.className = 'video-player__loading-text';
  text.textContent = message;
  
  const progressContainer = document.createElement('div');
  progressContainer.className = 'video-player__loading-progress';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'video-player__loading-progress-bar';
  
  progressContainer.appendChild(progressBar);
  
  overlay.appendChild(spinner);
  overlay.appendChild(text);
  overlay.appendChild(progressContainer);
  
  return overlay;
}

/**
 * Create a status message with a loader
 * @param {string} message - Status message
 * @param {string} loaderType - Type of loader
 * @returns {HTMLElement} Status with loader element
 */
function createStatusWithLoader(message, loaderType = 'spinner') {
  const container = document.createElement('div');
  container.className = 'status-with-loader';
  
  let loader;
  switch (loaderType) {
    case 'dots':
      loader = createDotsLoader();
      break;
    case 'pulse':
      loader = createPulseLoader('small');
      break;
    default:
      loader = createSpinner('small');
  }
  
  const text = document.createElement('div');
  text.className = 'status-with-loader__text';
  text.textContent = message;
  
  container.appendChild(loader);
  container.appendChild(text);
  
  return container;
}

/**
 * Create a toast notification
 * @param {string} message - Toast message
 * @param {string} type - 'loading', 'success', or 'error'
 * @param {boolean} showLoader - Whether to show a loader
 * @returns {HTMLElement} Toast element
 */
function createToast(message, type = 'loading', showLoader = false) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  
  if (showLoader) {
    const spinner = createSpinner('small');
    toast.appendChild(spinner);
  }
  
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);
  
  return toast;
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - 'loading', 'success', or 'error'
 * @param {number} duration - Duration in milliseconds (0 for persistent)
 * @param {boolean} showLoader - Whether to show a loader
 * @returns {HTMLElement} Toast element
 */
function showToast(message, type = 'loading', duration = 3000, showLoader = false) {
  // Remove existing toasts of the same type
  const existingToasts = document.querySelectorAll(`.toast.toast--${type}`);
  existingToasts.forEach(toast => toast.remove());
  
  const toast = createToast(message, type, showLoader);
  document.body.appendChild(toast);
  
  // Auto-hide after duration (except for loading toasts)
  if (duration > 0 && type !== 'loading') {
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, duration);
  }
  
  return toast;
}

/**
 * Hide a specific toast
 * @param {HTMLElement} toast - Toast element to hide
 */
function hideToast(toast) {
  if (toast && toast.parentNode) {
    toast.remove();
  }
}

/**
 * Hide all toasts of a specific type
 * @param {string} type - Type of toasts to hide
 */
function hideAllToasts(type = null) {
  const selector = type ? `.toast.toast--${type}` : '.toast';
  const toasts = document.querySelectorAll(selector);
  toasts.forEach(toast => toast.remove());
}

/**
 * Add loading state to a button
 * @param {HTMLElement} button - Button element
 * @param {string} originalText - Original button text
 */
function setButtonLoading(button, originalText = null) {
  if (!button) return;
  
  // Store original text if not provided
  if (originalText === null) {
    originalText = button.textContent;
  }
  
  button.dataset.originalText = originalText;
  button.classList.add('button--loading');
  button.disabled = true;
}

/**
 * Remove loading state from a button
 * @param {HTMLElement} button - Button element
 */
function removeButtonLoading(button) {
  if (!button) return;
  
  button.classList.remove('button--loading');
  button.disabled = false;
  
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

/**
 * Add loading state to a card
 * @param {HTMLElement} card - Card element
 */
function setCardLoading(card) {
  if (!card) return;
  card.classList.add('card--loading');
}

/**
 * Remove loading state from a card
 * @param {HTMLElement} card - Card element
 */
function removeCardLoading(card) {
  if (!card) return;
  card.classList.remove('card--loading');
}

/**
 * Add loading state to a row
 * @param {HTMLElement} row - Row element
 * @param {number} skeletonCount - Number of skeleton cards to show
 */
function setRowLoading(row, skeletonCount = 6) {
  if (!row) return;
  
  row.classList.add('row--loading');
  const cardsContainer = row.querySelector('.cards');
  if (!cardsContainer) return;
  
  // Clear existing content
  cardsContainer.innerHTML = '';
  
  // Add skeleton cards
  for (let i = 0; i < skeletonCount; i++) {
    const skeletonCard = document.createElement('div');
    skeletonCard.className = 'card card--loading';
    
    const skeletonPoster = createSkeleton('poster');
    const skeletonTitle = createSkeleton('text', { width: '80%' });
    const skeletonSubtitle = createSkeleton('text', { width: '60%' });
    
    skeletonCard.appendChild(skeletonPoster);
    skeletonCard.appendChild(skeletonTitle);
    skeletonCard.appendChild(skeletonSubtitle);
    
    cardsContainer.appendChild(skeletonCard);
  }
}

/**
 * Remove loading state from a row
 * @param {HTMLElement} row - Row element
 */
function removeRowLoading(row) {
  if (!row) return;

  // Remove loading styling
  row.classList.remove('row--loading');

  // Clear any skeleton cards that were added during loading
  const cardsContainer = row.querySelector('.cards');
  if (cardsContainer) {
    cardsContainer.innerHTML = '';
  }
}

/**
 * Add loading state to search results
 * @param {HTMLElement} searchResults - Search results container
 */
function setSearchLoading(searchResults) {
  if (!searchResults) return;
  
  searchResults.classList.add('search-results--loading');
  searchResults.innerHTML = '';
}

/**
 * Remove loading state from search results
 * @param {HTMLElement} searchResults - Search results container
 */
function removeSearchLoading(searchResults) {
  if (!searchResults) return;
  searchResults.classList.remove('search-results--loading');
}

/**
 * Add loading state to cricket match row
 * @param {HTMLElement} matchRow - Match row element
 */
function setCricketMatchLoading(matchRow) {
  if (!matchRow) return;
  matchRow.classList.add('cricket-match-row--loading');
}

/**
 * Remove loading state from cricket match row
 * @param {HTMLElement} matchRow - Match row element
 */
function removeCricketMatchLoading(matchRow) {
  if (!matchRow) return;
  matchRow.classList.remove('cricket-match-row--loading');
}

/**
 * Add loading state to cricket stream chip
 * @param {HTMLElement} streamChip - Stream chip element
 */
function setCricketStreamLoading(streamChip) {
  if (!streamChip) return;
  streamChip.classList.add('cricket-stream-chip--loading');
}

/**
 * Remove loading state from cricket stream chip
 * @param {HTMLElement} streamChip - Stream chip element
 */
function removeCricketStreamLoading(streamChip) {
  if (!streamChip) return;
  streamChip.classList.remove('cricket-stream-chip--loading');
}

/**
 * Create a progress bar
 * @param {number} progress - Progress percentage (0-100)
 * @returns {HTMLElement} Progress bar element
 */
function createProgressBar(progress = 0) {
  const container = document.createElement('div');
  container.className = 'progress-bar';
  
  const fill = document.createElement('div');
  fill.className = 'progress-bar__fill';
  fill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  
  container.appendChild(fill);
  return container;
}

/**
 * Update progress bar
 * @param {HTMLElement} progressBar - Progress bar element
 * @param {number} progress - Progress percentage (0-100)
 */
function updateProgressBar(progressBar, progress) {
  if (!progressBar) return;
  
  const fill = progressBar.querySelector('.progress-bar__fill');
  if (fill) {
    fill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
}

// Export all functions for use in other modules
window.LoadingUtils = {
  createSpinner,
  createPulseLoader,
  createDotsLoader,
  createSkeleton,
  createLoadingOverlay,
  createVideoLoadingOverlay,
  createStatusWithLoader,
  createToast,
  showToast,
  hideToast,
  hideAllToasts,
  setButtonLoading,
  removeButtonLoading,
  setCardLoading,
  removeCardLoading,
  setRowLoading,
  removeRowLoading,
  setSearchLoading,
  removeSearchLoading,
  setCricketMatchLoading,
  removeCricketMatchLoading,
  setCricketStreamLoading,
  removeCricketStreamLoading,
  createProgressBar,
  updateProgressBar
};