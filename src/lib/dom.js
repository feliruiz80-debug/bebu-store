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

const PAGE_MS = 380;
let pageBusy = false;
let pageTimer = 0;
let pendingShowOpts = null;

export function setNextShowOpts(opts) {
  pendingShowOpts = opts && typeof opts === 'object' ? { ...opts } : null;
}

function clearPageClasses(node) {
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
  node.style.zIndex = '';
}

function finishPageChrome() {
  const content = document.querySelector('.content');
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

export function showSection(id, opts = {}) {
  const next = el(id);
  if (!next) return;

  const merged = { ...(pendingShowOpts || {}), ...opts };
  pendingShowOpts = null;

  const current = document.querySelector('.section.active');
  if (current === next) {
    finishPageChrome();
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fromDepth = current ? (SECTION_DEPTH[current.id] ?? 0) : 0;
  const toDepth = SECTION_DEPTH[id] ?? 0;
  let direction = merged.direction;
  if (!direction) direction = toDepth < fromDepth ? 'back' : 'forward';

  if (merged.instant || reduceMotion || !current || (pageBusy && !merged.swipeHandoff)) {
    $all('.section').forEach((s) => {
      clearPageClasses(s);
      s.classList.remove('active');
    });
    next.classList.add('active');
    pageBusy = false;
    finishPageChrome();
    return;
  }

  pageBusy = true;
  window.clearTimeout(pageTimer);

  if (merged.swipeHandoff && direction === 'back') {
    const peeked = merged.peekedId ? el(merged.peekedId) : null;
    const under = peeked && peeked !== current ? peeked : next;
    const ease = '0.32s cubic-bezier(0.22, 1, 0.36, 1)';

    // Página actual sigue el dedo → sale a la derecha (mantiene altura del layout).
    current.classList.remove('is-swipe-dragging');
    current.classList.add('is-swipe-front', 'is-page-on');
    current.style.position = 'relative';
    current.style.zIndex = '3';
    current.style.transition = `transform ${ease}, box-shadow ${ease}`;
    current.style.transform = 'translate3d(100%, 0, 0)';
    current.style.boxShadow = '-10px 0 32px rgba(60, 45, 35, 0.18)';

    // Página de atrás ya visible debajo: termina de llegar al centro.
    under.classList.add('is-page-under', 'is-page-on');
    under.classList.remove('active');
    under.style.transition = `transform ${ease}, opacity ${ease}`;
    under.style.transform = 'translate3d(0, 0, 0)';
    under.style.opacity = '1';
    under.style.pointerEvents = 'none';
    under.style.zIndex = '1';

    if (next !== under && next !== current) {
      clearPageClasses(next);
      next.classList.remove('active');
    }

    pageTimer = window.setTimeout(() => {
      current.classList.remove('active', 'is-page-on', 'is-swipe-front');
      clearPageClasses(current);
      under.classList.remove('is-page-under');
      clearPageClasses(under);
      under.classList.add('active');
      under.style.pointerEvents = '';
      pageBusy = false;
    }, 320);
    finishPageChrome();
    return;
  }

  clearPageClasses(current);
  clearPageClasses(next);

  const leaveClass = direction === 'back' ? 'is-leave-back' : 'is-leave-forward';
  const enterClass = direction === 'back' ? 'is-enter-back' : 'is-enter-forward';

  current.classList.add(leaveClass, 'is-page-on');
  // Solo is-page-on en la que entra: evita dos .active a la vez (rompe el gesto iOS).
  next.classList.add(enterClass, 'is-page-on');

  pageTimer = window.setTimeout(() => {
    current.classList.remove('active', leaveClass, 'is-page-on');
    clearPageClasses(current);
    next.classList.remove(enterClass, 'is-page-on');
    clearPageClasses(next);
    next.classList.add('active');
    pageBusy = false;
  }, PAGE_MS);

  finishPageChrome();
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
