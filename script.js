(() => {
  'use strict';

  /*
   * REDtr portfolio controls.
   * Edit titles/categories/tags below. Image paths remain in index.html.
   */
  const ARTWORK_METADATA = {
    // Example:
    // 1: { title: 'Untitled I', category: 'Digital', tags: ['portrait', 'red'] },
  };

  const root = document.documentElement;
  const body = document.body;
  const cards = [...document.querySelectorAll('.artwork-card')];
  const triggers = [...document.querySelectorAll('.artwork-trigger')];
  const searchInput = document.querySelector('#artwork-search');
  const emptyState = document.querySelector('[data-gallery-empty]');
  const clearSearch = document.querySelector('[data-clear-search]');
  const viewer = document.querySelector('[data-viewer]');
  const viewerImage = document.querySelector('[data-viewer-image]');
  const viewerFigure = document.querySelector('[data-viewer-figure]');
  const viewerNumber = document.querySelector('[data-viewer-number]');
  const viewerTitle = document.querySelector('[data-viewer-title]');
  const viewerSideTitle = document.querySelector('[data-viewer-title-side]');
  const zoomLevel = document.querySelector('[data-zoom-level]');
  const thumbnails = document.querySelector('[data-thumbnail-track]');
  const live = document.querySelector('[data-live-region]');
  const cursor = document.querySelector('[data-cursor]');
  const menu = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('#mobile-menu');

  const state = {
    current: 0,
    query: '',
    visibleCards: [...cards],
    zoom: 1,
    slideshow: false,
    slideshowTimer: null,
    touchX: null,
    touchY: null,
  };

  const originals = cards.map((card, index) => {
    const image = card.querySelector('img');
    const number = Number(card.dataset.artwork) || index + 1;
    return {
      card,
      index,
      number,
      source: image?.getAttribute('src') || '',
      alt: image?.getAttribute('alt') || `Artwork ${pad(number)}`,
    };
  });

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function metadataFor(number) {
    return ARTWORK_METADATA[number] || {};
  }

  function artworkTitle(number) {
    return metadataFor(number).title || `Artwork ${pad(number)}`;
  }

  function artworkCategory(number) {
    return metadataFor(number).category || 'Archive';
  }

  function artworkMatches(item) {
    const meta = metadataFor(item.number);
    const searchable = [
      item.number,
      `artwork ${pad(item.number)}`,
      meta.title || '',
      meta.category || '',
      ...(meta.tags || []),
    ].join(' ').toLowerCase();

    return !state.query || searchable.includes(state.query.toLowerCase().trim());
  }

  function applyFilters() {
    state.visibleCards = originals.filter(artworkMatches).map(item => item.card);

    cards.forEach(card => {
      card.classList.toggle('is-hidden', !state.visibleCards.includes(card));
    });

    emptyState.hidden = state.visibleCards.length !== 0;

    const visibleCount = document.querySelector('[data-visible-count]');
    if (visibleCount) visibleCount.textContent = String(state.visibleCards.length).padStart(2, '0');

    originals.forEach(item => {
      const title = item.card.querySelector('[data-card-title]');
      const category = item.card.querySelector('[data-card-category]');
      if (title) title.textContent = artworkTitle(item.number);
      if (category) category.textContent = artworkCategory(item.number);
    });
  }

  function setupMenu() {
    menu?.addEventListener('click', () => {
      const opening = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(opening));
      menu.setAttribute('aria-label', opening ? 'Close menu' : 'Open menu');
      if (opening) mobileMenu?.removeAttribute('hidden');
      else mobileMenu?.setAttribute('hidden', '');
    });

    mobileMenu?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu?.setAttribute('aria-expanded', 'false');
        menu?.setAttribute('aria-label', 'Open menu');
        mobileMenu?.setAttribute('hidden', '');
      });
    });
  }

  function updateCount() {
    document.querySelectorAll('[data-artwork-count]').forEach(node => {
      node.textContent = originals.length;
    });
  }

  function buildThumbnails() {
    if (!thumbnails) return;
    thumbnails.innerHTML = '';

    originals.forEach((item, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'thumbnail';
      thumb.setAttribute('role', 'option');
      thumb.dataset.index = index;
      thumb.setAttribute('aria-label', `Open Artwork ${pad(item.number)}`);

      const img = document.createElement('img');
      img.src = item.source;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';

      thumb.appendChild(img);
      thumb.addEventListener('click', () => openViewer(index));
      thumbnails.appendChild(thumb);
    });
  }

  function preloadAround(index) {
    [-1, 1].forEach(offset => {
      const target = originals[(index + offset + originals.length) % originals.length];
      if (!target?.source) return;
      const img = new Image();
      img.src = target.source;
    });
  }

  function updateZoom() {
    if (!viewerFigure || !zoomLevel) return;
    viewerFigure.style.transform = `scale(${state.zoom})`;
    zoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function resetZoom() {
    state.zoom = 1;
    updateZoom();
  }

  function zoomBy(delta) {
    state.zoom = Math.min(3.5, Math.max(0.5, +(state.zoom + delta).toFixed(2)));
    updateZoom();
  }

  function updateViewer() {
    const item = originals[state.current];
    if (!item) return;

    const update = () => {
      viewerImage.src = item.source;
      viewerImage.alt = item.alt;
      viewerNumber.textContent = `${pad(item.number)} / ${pad(originals.length)}`;
      viewerTitle.textContent = artworkTitle(item.number);
      viewerSideTitle.textContent = artworkTitle(item.number);

      document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
        const active = index === state.current;
        thumb.classList.toggle('is-active', active);
        thumb.setAttribute('aria-selected', String(active));
        if (active) {
          thumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        }
      });

      resetZoom();
      preloadAround(state.current);
      if (live) {
        live.textContent = `${artworkTitle(item.number)}, ${pad(item.number)} of ${pad(originals.length)}`;
      }
    };

    if (document.startViewTransition) {
      document.startViewTransition(update);
    } else {
      update();
    }
  }

  function openViewer(index) {
    if (!originals.length) return;
    state.current = (index + originals.length) % originals.length;
    updateViewer();
    stopSlideshow();

    if (!viewer.open) viewer.showModal();
    body.classList.add('viewer-open');

    setTimeout(() => document.querySelector('[data-close]')?.focus(), 0);
  }

  function closeViewer() {
    stopSlideshow();
    resetZoom();
    body.classList.remove('viewer-open');
    if (viewer.open) viewer.close();
  }

  function navigate(direction) {
    if (!originals.length) return;
    state.current = (state.current + (direction > 0 ? 1 : -1) + originals.length) % originals.length;
    updateViewer();
  }

  function startSlideshow() {
    if (state.slideshow) return;

    state.slideshow = true;
    const btn = document.querySelector('[data-slideshow-toggle]');

    if (btn) {
      btn.textContent = 'Pause';
      btn.setAttribute('aria-pressed', 'true');
    }

    state.slideshowTimer = setInterval(() => navigate(1), 5000);
  }

  function stopSlideshow() {
    state.slideshow = false;
    clearInterval(state.slideshowTimer);
    state.slideshowTimer = null;

    const btn = document.querySelector('[data-slideshow-toggle]');
    if (btn) {
      btn.textContent = 'Play';
      btn.setAttribute('aria-pressed', 'false');
    }

    const progress = document.querySelector('[data-progress]');
    if (progress) {
      progress.style.animation = 'none';
      progress.offsetHeight;
      progress.style.animation = '';
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (viewer.requestFullscreen) await viewer.requestFullscreen();
        else await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (_) {
      if (live) live.textContent = 'Fullscreen is not available in this browser.';
    }
  }

  function chooseRandomVisible() {
    const pool = state.visibleCards.length ? state.visibleCards : cards;
    if (!pool.length) return;

    const card = pool[Math.floor(Math.random() * pool.length)];
    const index = cards.indexOf(card);
    openViewer(index);
  }

  function setupSearch() {
    searchInput?.addEventListener('input', event => {
      state.query = event.target.value;
      applyFilters();
    });

    clearSearch?.addEventListener('click', () => {
      state.query = '';
      if (searchInput) searchInput.value = '';
      applyFilters();
      searchInput?.focus();
    });
  }

  function setupViewer() {
    triggers.forEach((trigger, index) => {
      trigger.addEventListener('click', () => openViewer(index));
    });

    document.querySelector('[data-prev]')?.addEventListener('click', () => navigate(-1));
    document.querySelector('[data-next]')?.addEventListener('click', () => navigate(1));
    document.querySelector('[data-close]')?.addEventListener('click', closeViewer);
    document.querySelector('[data-close-viewer]')?.addEventListener('click', closeViewer);
    document.querySelector('[data-zoom-in]')?.addEventListener('click', () => zoomBy(0.25));
    document.querySelector('[data-zoom-out]')?.addEventListener('click', () => zoomBy(-0.25));
    document.querySelector('[data-zoom-reset]')?.addEventListener('click', resetZoom);
    document.querySelector('[data-fullscreen]')?.addEventListener('click', toggleFullscreen);
    document.querySelector('[data-slideshow-toggle]')?.addEventListener('click', () => {
      state.slideshow ? stopSlideshow() : startSlideshow();
    });

    viewerImage?.addEventListener('load', () => {
      if (viewerFigure) viewerFigure.style.viewTransitionName = 'active-artwork';
    });

    viewer?.addEventListener('cancel', event => {
      event.preventDefault();
      closeViewer();
    });

    viewer?.addEventListener('close', () => body.classList.remove('viewer-open'));

    viewerStageWheelSetup();
    viewerTouchSetup();
  }

  function viewerStageWheelSetup() {
    const stage = document.querySelector('[data-viewer-stage]');
    if (!stage) return;

    stage.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      if (state.zoom <= 1 && event.deltaY > 0) return;

      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 0.1 : -0.1);
    }, { passive: false });
  }

  function viewerTouchSetup() {
    const stage = document.querySelector('[data-viewer-stage]');
    if (!stage) return;

    stage.addEventListener('touchstart', event => {
      const touch = event.changedTouches[0];
      state.touchX = touch.clientX;
      state.touchY = touch.clientY;
    }, { passive: true });

    stage.addEventListener('touchend', event => {
      if (state.touchX == null) return;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - state.touchX;
      const dy = touch.clientY - state.touchY;

      state.touchX = null;
      state.touchY = null;

      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      navigate(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function setupKeyboard() {
    document.addEventListener('keydown', event => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && !viewer.open) {
        event.preventDefault();
        searchInput?.focus();
        return;
      }

      if (!viewer.open) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          navigate(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigate(1);
          break;
        case '+':
        case '=':
          event.preventDefault();
          zoomBy(0.25);
          break;
        case '-':
        case '_':
          event.preventDefault();
          zoomBy(-0.25);
          break;
        case '0':
          event.preventDefault();
          resetZoom();
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          toggleFullscreen();
          break;
        case ' ':
          event.preventDefault();
          state.slideshow ? stopSlideshow() : startSlideshow();
          break;
        case 'Escape':
          event.preventDefault();
          closeViewer();
          break;
      }
    });
  }

  function setupCursor() {
    const finePointer = matchMedia('(pointer:fine)').matches;
    if (!finePointer || !cursor) return;

    body.classList.add('has-pointer');

    let raf = null;
    let x = -100;
    let y = -100;

    document.addEventListener('pointermove', event => {
      x = event.clientX;
      y = event.clientY;

      if (!raf) {
        raf = requestAnimationFrame(() => {
          cursor.style.left = `${x}px`;
          cursor.style.top = `${y}px`;
          raf = null;
        });
      }
    });

    document.querySelectorAll('.artwork-trigger').forEach(trigger => {
      trigger.addEventListener('pointerenter', () => cursor.classList.add('is-visible'));
      trigger.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
    });
  }

  function updateYear() {
    const node = document.querySelector('[data-year]');
    if (node) node.textContent = new Date().getFullYear();
  }

  document.querySelector('[data-discover]')?.addEventListener('click', chooseRandomVisible);

  updateCount();
  setupMenu();
  setupSearch();
  buildThumbnails();
  setupViewer();
  setupKeyboard();
  setupCursor();
  updateYear();
  applyFilters();
})();
