export function el(id) {
  return document.getElementById(id);
}

export function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function showToast(msg, t = 2200) {
  const existing = document.querySelector('.bebu-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'bebu-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), t);
}

const SECTION_DEPTH = {
  'home-view': 0,
  'brands-view': 1,
  'subcats-view': 2,
  'products-view': 3
};

/** Seda / iOS */
const PAGE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const PAGE_MS = 380;
/** Parallax suave de la página de atrás (solo translate en px, sin estirar) */
const UNDER_RATIO = 0.18;

let pageBusy = false;
let pageTimer = 0;
let pendingShowOpts = null;

export function setNextShowOpts(opts) {
  pendingShowOpts = opts && typeof opts === 'object' ? { ...opts } : null;
}

export function isPageBusy() {
  return pageBusy;
}

function clearPageMotion(node) {
  if (!node) return;
  node.classList.remove(
    'is-enter-forward',
    'is-enter-back',
    'is-leave-forward',
    'is-leave-back',
    'is-page-on',
    'is-page-layer',
    'is-swipe-dragging',
    'is-swipe-front',
    'is-page-under'
  );
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
}

function getStage() {
  return document.querySelector('.content') || document.querySelector('.main-container');
}

function stageWidth(stage) {
  return Math.round((stage || getStage())?.getBoundingClientRect().width || window.innerWidth);
}

function lockKeyed(stage, heightPx) {
  if (!stage) return;
  stage.classList.remove('is-swiping');
  stage.classList.add('is-page-animating');
  if (heightPx > 0) stage.style.minHeight = `${Math.ceil(heightPx)}px`;
}

function lockSwipe(stage, heightPx) {
  if (!stage) return;
  stage.classList.remove('is-page-animating');
  stage.classList.add('is-swiping');
  if (heightPx > 0) stage.style.minHeight = `${Math.ceil(heightPx)}px`;
}

function unlockStage(stage) {
  if (!stage) return;
  stage.classList.remove('is-page-animating', 'is-swiping');
  stage.style.minHeight = '';
}

function finishPageChrome() {
  const content = getStage();
  if (content) content.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (
    !el('modal-buscar')?.classList.contains('is-open') &&
    !el('modal-carrito')?.classList.contains('is-open') &&
    !el('modal-promos')?.classList.contains('is-open')
  ) {
    setBottomNav('home');
  }
}

function endTransition(leaving, entering, stage) {
  if (leaving) {
    leaving.classList.remove('active');
    clearPageMotion(leaving);
  }
  $all('.section').forEach((s) => {
    if (s !== entering) {
      s.classList.remove('active');
      clearPageMotion(s);
    }
  });
  clearPageMotion(entering);
  entering.classList.add('active');
  unlockStage(stage);
  pageBusy = false;
  finishPageChrome();
}

function setLayer(node, { z, x }) {
  node.classList.add('is-page-on', 'is-page-layer');
  node.style.zIndex = String(z);
  node.style.willChange = 'transform';
  node.style.transition = 'none';
  node.style.transform = `translate3d(${Math.round(x)}px, 0, 0)`;
}

function animateTo(node, x, ms = PAGE_MS) {
  node.style.transition = `transform ${ms}ms ${PAGE_EASE}`;
  node.style.transform = `translate3d(${Math.round(x)}px, 0, 0)`;
}

export function showSection(id, opts = {}) {
  const next = el(id);
  if (!next) return;

  const merged = { ...(pendingShowOpts || {}), ...opts };
  pendingShowOpts = null;

  const current =
    document.querySelector('.section.active') ||
    document.querySelector('.section.is-swipe-front');

  if (current === next) {
    finishPageChrome();
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fromDepth = current ? (SECTION_DEPTH[current.id] ?? 0) : 0;
  const toDepth = SECTION_DEPTH[id] ?? 0;
  let direction = merged.direction;
  if (!direction) direction = toDepth < fromDepth ? 'back' : 'forward';

  const stage = getStage();

  if (merged.instant || reduceMotion || !current || (pageBusy && !merged.swipeHandoff)) {
    window.clearTimeout(pageTimer);
    $all('.section').forEach((s) => {
      clearPageMotion(s);
      s.classList.remove('active');
    });
    next.classList.add('active');
    unlockStage(stage);
    pageBusy = false;
    finishPageChrome();
    return;
  }

  pageBusy = true;
  window.clearTimeout(pageTimer);
  const w = stageWidth(stage);

  /* —— Gesto: misma geometría (front relative, under absolute), solo px —— */
  if (merged.swipeHandoff && direction === 'back') {
    const peeked = merged.peekedId ? el(merged.peekedId) : null;
    const under = peeked && peeked !== current ? peeked : next;

    lockSwipe(stage, current.offsetHeight);

    current.classList.remove('is-swipe-dragging');
    current.classList.add('is-swipe-front', 'is-page-on');
    current.style.willChange = 'transform';
    animateTo(current, w);

    under.classList.add('is-page-under', 'is-page-on');
    under.classList.remove('active');
    under.style.willChange = 'transform';
    under.style.pointerEvents = 'none';
    animateTo(under, 0);

    if (next !== under && next !== current) {
      clearPageMotion(next);
      next.classList.remove('active');
    }

    pageTimer = window.setTimeout(() => endTransition(current, under, stage), PAGE_MS);
    return;
  }

  /* —— Volver / avanzar con tap: capas fijas + translate en px (sin deformar) —— */
  const height = Math.max(current.offsetHeight, 120);
  lockKeyed(stage, height);

  clearPageMotion(current);
  clearPageMotion(next);

  const underShift = Math.round(w * UNDER_RATIO);

  if (direction === 'forward') {
    // current se queda quieta detrás un poco; next entra desde la derecha
    setLayer(current, { z: 2, x: 0 });
    setLayer(next, { z: 3, x: w });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animateTo(current, -underShift);
        animateTo(next, 0);
      });
    });
  } else {
    // next (anterior) ya está detrás, quieta o casi; current se va a la derecha
    // La página de atrás NO se escala ni se estira: solo un slide suave en px
    setLayer(next, { z: 2, x: -underShift });
    setLayer(current, { z: 3, x: 0 });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animateTo(next, 0);
        animateTo(current, w);
      });
    });
  }

  pageTimer = window.setTimeout(() => endTransition(current, next, stage), PAGE_MS + 16);
}

export function setBottomNav(name) {
  $all('.bottom-nav-btn').forEach((btn) => {
    const active = btn.getAttribute('data-nav') === name;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

export function openOverlay(node) {
  if (!node) return;
  node.classList.add('is-open');
  node.setAttribute('aria-hidden', 'false');
}

export function closeOverlay(node) {
  if (!node) return;
  node.classList.remove('is-open');
  node.setAttribute('aria-hidden', 'true');
}

export function bindActivate(root, selector, handler) {
  root.addEventListener('click', (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(target, e);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest(selector);
    if (!target || !root.contains(target)) return;
    e.preventDefault();
    handler(target, e);
  });
}
