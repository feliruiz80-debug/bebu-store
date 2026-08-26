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

export function showSection(id) {
  $all('.section').forEach((s) => s.classList.remove('active'));
  const sec = el(id);
  if (sec) sec.classList.add('active');
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
