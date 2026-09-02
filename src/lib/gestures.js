const DISMISS_DY = 110;
const DISMISS_VELOCITY = 0.65;
const EDGE_ZONE = 24;
const BACK_RATIO = 0.28;
const BACK_VELOCITY = 0.45;
const UNDER_RATIO = 0.16;
const PAGE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SNAP_MS = 320;

function sheetEl(overlay) {
  return overlay?.querySelector('.modal-card');
}

function canDragFromTarget(target, sheet) {
  if (!target || !sheet) return false;
  if (target.closest('.sheet-handle, .modal-header, .buscador-container')) return true;
  const scroller = target.closest('.modal-search-grid, .modal-body-list, .modal-card');
  if (scroller && scroller.scrollTop <= 0 && !target.closest('input, textarea, button, a, label')) {
    return true;
  }
  return Boolean(target.closest('.sheet-handle'));
}

export function bindSheetDismiss(overlay, onClose) {
  if (!overlay || typeof onClose !== 'function') return () => {};
  const sheet = sheetEl(overlay);
  if (!sheet) return () => {};

  let startY = 0;
  let startX = 0;
  let lastY = 0;
  let lastT = 0;
  let dragging = false;
  let active = false;

  const reset = () => {
    dragging = false;
    active = false;
    overlay.classList.remove('is-dragging');
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    sheet.style.transition = '';
    overlay.style.background = '';
  };

  const onStart = (e) => {
    if (!overlay.classList.contains('is-open')) return;
    const t = e.touches?.[0];
    if (!t) return;
    if (!canDragFromTarget(e.target, sheet)) return;
    startY = t.clientY;
    startX = t.clientX;
    lastY = startY;
    lastT = Date.now();
    active = true;
    dragging = false;
  };

  const onMove = (e) => {
    if (!active) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dy = t.clientY - startY;
    const dx = t.clientX - startX;
    if (!dragging) {
      if (dy < 8) return;
      if (Math.abs(dx) > dy) {
        active = false;
        return;
      }
      dragging = true;
      overlay.classList.add('is-dragging');
      sheet.classList.add('is-dragging');
      sheet.style.transition = 'none';
    }
    e.preventDefault();
    const y = Math.max(0, dy);
    sheet.style.transform = `translateY(${y}px)`;
    const dim = Math.max(0.08, 0.28 * (1 - y / 420));
    overlay.style.background = `rgba(70, 55, 45, ${dim})`;
    lastY = t.clientY;
    lastT = Date.now();
  };

  const onEnd = () => {
    if (!active) return;
    if (!dragging) {
      active = false;
      return;
    }
    const dy = Math.max(0, lastY - startY);
    const dt = Math.max(1, Date.now() - lastT);
    const velocity = dy / dt;
    const shouldClose = dy > DISMISS_DY || velocity > DISMISS_VELOCITY;
    if (shouldClose) {
      sheet.style.transition = 'transform 0.22s ease-out';
      sheet.style.transform = 'translateY(110%)';
      overlay.style.transition = 'background 0.22s ease-out, opacity 0.22s ease-out';
      overlay.style.opacity = '0';
      window.setTimeout(() => {
        reset();
        overlay.style.opacity = '';
        overlay.style.transition = '';
        onClose();
      }, 220);
      active = false;
      dragging = false;
      return;
    }
    sheet.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
    sheet.style.transform = 'translateY(0)';
    overlay.style.transition = 'background 0.28s ease';
    overlay.style.background = '';
    window.setTimeout(reset, 280);
  };

  overlay.addEventListener('touchstart', onStart, { passive: true });
  overlay.addEventListener('touchmove', onMove, { passive: false });
  overlay.addEventListener('touchend', onEnd, { passive: true });
  overlay.addEventListener('touchcancel', onEnd, { passive: true });

  return () => {
    overlay.removeEventListener('touchstart', onStart);
    overlay.removeEventListener('touchmove', onMove);
    overlay.removeEventListener('touchend', onEnd);
    overlay.removeEventListener('touchcancel', onEnd);
  };
}

/**
 * Gesto atrás estilo iOS: arrastra la página actual y se ve la anterior debajo.
 * @param {{ onBack: Function, getPrevId: () => string|null, isBusy?: () => boolean }} opts
 */
export function bindBackSwipe(opts = {}) {
  const onBack = typeof opts === 'function' ? opts : opts.onBack;
  const getPrevId = typeof opts === 'function' ? null : opts.getPrevId;
  const isBusy = typeof opts === 'function' ? null : opts.isBusy;
  if (typeof onBack !== 'function') return () => {};

  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastT = 0;
  let tracking = false;
  let dragging = false;
  let front = null;
  let under = null;
  let width = 0;
  let raf = 0;
  let pendingX = 0;
  let stage = null;

  const clearNodeMotion = (node) => {
    if (!node) return;
    node.classList.remove('is-swipe-front', 'is-page-under', 'is-swipe-dragging', 'is-page-on', 'is-page-layer');
    node.style.transform = '';
    node.style.transition = '';
    node.style.opacity = '';
    node.style.boxShadow = '';
    node.style.position = '';
    node.style.left = '';
    node.style.right = '';
    node.style.top = '';
    node.style.bottom = '';
    node.style.width = '';
    node.style.height = '';
    node.style.zIndex = '';
    node.style.pointerEvents = '';
    node.style.willChange = '';
  };

  const unlockStage = () => {
    if (!stage) return;
    stage.classList.remove('is-swiping');
    stage = null;
  };

  const underX = (p) => Math.round(-UNDER_RATIO * (1 - p) * width);

  const paint = () => {
    raf = 0;
    if (!front) return;
    const w = width || window.innerWidth;
    const x = Math.min(w, Math.max(0, pendingX));
    const p = x / w;
    front.style.transform = `translate3d(${Math.round(x)}px, 0, 0)`;
    if (under) {
      under.style.transform = `translate3d(${underX(p)}px, 0, 0)`;
    }
  };

  const applyProgress = (x) => {
    pendingX = x;
    if (!raf) raf = requestAnimationFrame(paint);
  };

  const prepareUnder = () => {
    if (!getPrevId || !front) return;
    const id = getPrevId();
    if (!id || id === front.id) return;
    const node = document.getElementById(id);
    if (!node) return;

    stage = document.querySelector('.content') || document.querySelector('.main-container');
    width = Math.round(stage?.getBoundingClientRect().width || window.innerWidth);
    if (stage) stage.classList.add('is-swiping');

    under = node;
    under.classList.add('is-page-under', 'is-page-on');
    under.style.transition = 'none';
    under.style.pointerEvents = 'none';
    under.style.willChange = 'transform';
    under.style.zIndex = '1';
    under.style.transform = `translate3d(${underX(0)}px, 0, 0)`;

    front.classList.add('is-swipe-front', 'is-swipe-dragging', 'is-page-on');
    front.style.willChange = 'transform';
    front.style.transition = 'none';
    front.style.zIndex = '4';
  };

  const resetCancel = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (front) {
      front.classList.remove('is-swipe-dragging');
      clearNodeMotion(front);
      front.classList.add('active');
    }
    if (under) {
      clearNodeMotion(under);
      under.classList.remove('active');
    }
    unlockStage();
    front = null;
    under = null;
    dragging = false;
  };

  const onStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    if (t.clientX > EDGE_ZONE) return;
    if (document.documentElement.dataset.layout === 'web') return;
    if (e.target.closest('.modal-overlay.is-open, .bottom-nav, input, textarea')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof isBusy === 'function' && isBusy()) return;
    const active = document.querySelector('.section.active');
    if (!active || active.id === 'home-view') return;
    if (!getPrevId || !getPrevId()) return;
    startX = t.clientX;
    startY = t.clientY;
    lastX = startX;
    lastT = performance.now();
    tracking = true;
    dragging = false;
    front = active;
    under = null;
    width = window.innerWidth;
  };

  const onMove = (e) => {
    if (!tracking || !front) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dx = Math.max(0, t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (!dragging) {
      if (dy > 40 && dy > dx) {
        tracking = false;
        front = null;
        return;
      }
      if (dx < 6) return;
      dragging = true;
      prepareUnder();
    }
    e.preventDefault();
    applyProgress(Math.min(width, dx));
    lastX = t.clientX;
    lastT = performance.now();
  };

  const onEnd = (e) => {
    if (!tracking) return;
    tracking = false;
    if (!front) return;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      paint();
    }

    const t = e.changedTouches?.[0];
    const now = performance.now();
    const dx = t ? Math.max(0, t.clientX - startX) : pendingX;
    const dy = t ? Math.abs(t.clientY - startY) : 0;
    const dt = Math.max(1, now - lastT);
    const vx = t ? Math.max(0, (t.clientX - lastX) / dt) : 0;
    const progress = dx / (width || window.innerWidth);
    const shouldBack =
      dragging &&
      dy < 110 &&
      (progress >= BACK_RATIO || (vx > BACK_VELOCITY && progress > 0.06));

    if (shouldBack) {
      const peekedId = under?.id || null;
      front = null;
      under = null;
      dragging = false;
      stage = null;
      onBack({ swipeHandoff: true, peekedId });
      return;
    }

    if (dragging) {
      const snapFront = front;
      const snapUnder = under;
      const ease = `transform ${SNAP_MS}ms ${PAGE_EASE}`;
      if (snapFront) {
        snapFront.style.transition = ease;
        snapFront.style.transform = 'translate3d(0, 0, 0)';
      }
      if (snapUnder) {
        snapUnder.style.transition = ease;
        snapUnder.style.transform = `translate3d(${underX(0)}px, 0, 0)`;
      }
      window.setTimeout(() => {
        if (snapFront) {
          snapFront.classList.remove('is-swipe-dragging');
          clearNodeMotion(snapFront);
          snapFront.classList.add('active');
        }
        if (snapUnder) {
          clearNodeMotion(snapUnder);
          snapUnder.classList.remove('active');
        }
        unlockStage();
        if (front === snapFront) front = null;
        if (under === snapUnder) under = null;
        dragging = false;
      }, SNAP_MS);
      return;
    }

    resetCancel();
  };

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onEnd, { passive: true });

  return () => {
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
  };
}
