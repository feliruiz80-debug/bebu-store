const DISMISS_DY = 110;
const DISMISS_VELOCITY = 0.65;
const EDGE_ZONE = 28;
const BACK_DX = 72;

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

export function bindBackSwipe(onBack) {
  if (typeof onBack !== 'function') return () => {};
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    if (t.clientX > EDGE_ZONE) return;
    if (e.target.closest('.modal-overlay.is-open, .bottom-nav, input, textarea')) return;
    startX = t.clientX;
    startY = t.clientY;
    tracking = true;
  };

  const onMove = (e) => {
    if (!tracking) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    if (dy > 48 && dy > dx) {
      tracking = false;
      return;
    }
    if (dx > 24) e.preventDefault();
  };

  const onEnd = (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    if (dx >= BACK_DX && dy < 64) onBack();
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
