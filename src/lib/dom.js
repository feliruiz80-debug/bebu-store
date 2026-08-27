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

/** Curva cercana a iOS UINavigationController */
const PAGE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const PAGE_MS = 320;
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
  node.style.zIndex = '';
  node.style.pointerEvents = '';
  node.style.willChange = '';
}

function getStage() {
  return document.querySelector('.content') || document.querySelector('.main-container');
}

function lockStage(stage, heightPx) {
  if (!stage) return;
  stage.classList.add('is-page-animating');
  if (heightPx > 0) stage.style.minHeight = `${Math.ceil(heightPx)}px`;
}

function unlockStage(stage) {
  if (!stage) return;
  stage.classList.remove('is-page-animating');
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

  /* —— Gesto: continuar desde el dedo, sin re-layout brusco —— */
  if (merged.swipeHandoff && direction === 'back') {
    const peeked = merged.peekedId ? el(merged.peekedId) : null;
    const under = peeked && peeked !== current ? peeked : next;
    const ease = `transform ${PAGE_MS}ms ${PAGE_EASE}`;

    lockStage(stage, Math.max(current.offsetHeight, under.offsetHeight || 0));

    current.classList.remove('is-swipe-dragging');
    current.classList.add('is-swipe-front', 'is-page-on');
    current.style.willChange = 'transform';
    current.style.transition = ease;
    current.style.transform = 'translate3d(100%, 0, 0)';

    under.classList.add('is-page-under', 'is-page-on');
    under.classList.remove('active');
    under.style.willChange = 'transform';
    under.style.transition = ease;
    under.style.transform = 'translate3d(0, 0, 0)';
    under.style.pointerEvents = 'none';

    if (next !== under && next !== current) {
      clearPageMotion(next);
      next.classList.remove('active');
    }

    pageTimer = window.setTimeout(() => endTransition(current, under, stage), PAGE_MS);
    return;
  }

  /* —— Tap / navegación normal —— */
  const height = Math.max(current.offsetHeight, 120);
  lockStage(stage, height);

  clearPageMotion(current);
  clearPageMotion(next);

  const leaveClass = direction === 'back' ? 'is-leave-back' : 'is-leave-forward';
  const enterClass = direction === 'back' ? 'is-enter-back' : 'is-enter-forward';

  current.classList.add(leaveClass, 'is-page-on');
  next.classList.add(enterClass, 'is-page-on');

  pageTimer = window.setTimeout(() => endTransition(current, next, stage), PAGE_MS);
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
