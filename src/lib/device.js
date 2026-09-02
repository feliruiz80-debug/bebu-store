const UA = String(navigator.userAgent || '');

function engineFromUa() {
  if (/SamsungBrowser|SM-\w|SAMSUNG|Galaxy/i.test(UA)) return 'samsung';
  if (/Android/i.test(UA)) return 'android';
  if (/iPhone|iPad|iPod/i.test(UA)) return 'ios';
  return 'other';
}

function sizeFromWidth(w) {
  if (w < 360) return 'phone-xs';
  if (w < 400) return 'phone-sm';
  if (w < 600) return 'phone';
  if (w < 900) return 'tablet';
  return 'desktop';
}

function fontScale() {
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;left:-9999px;top:0;font-size:16px;line-height:1;font-family:sans-serif;';
  probe.textContent = 'M';
  document.documentElement.appendChild(probe);
  const measured = probe.getBoundingClientRect().height || 16;
  probe.remove();
  return measured / 16;
}

const PHONE_UA = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i;

export function isWebLayout() {
  return document.documentElement.dataset.layout === 'web';
}

function layoutFromWidth(width) {
  if (PHONE_UA.test(UA) && width < 900) return 'app';
  return width >= 900 ? 'web' : 'app';
}

export function applyDeviceProfile() {
  const root = document.documentElement;
  const width = Math.round(window.visualViewport?.width || window.innerWidth || 0);
  const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  const scale = fontScale();
  const size = sizeFromWidth(width);
  const compact = width < 400 || height < 680 || scale > 1.12;
  const engine = engineFromUa();
  const layout = layoutFromWidth(width);

  root.dataset.device = size;
  root.dataset.layout = layout;
  root.dataset.density = compact ? 'compact' : 'comfortable';
  root.dataset.engine = engine;
  root.dataset.fontScale = scale > 1.2 ? 'large' : scale > 1.08 ? 'medium' : 'normal';
  root.style.setProperty('--vw', `${width}px`);
  root.style.setProperty('--desc-lines', compact || engine === 'samsung' ? '3' : '2');
}

export function initDeviceProfile() {
  applyDeviceProfile();
  const onChange = () => applyDeviceProfile();
  window.addEventListener('resize', onChange, { passive: true });
  window.addEventListener('orientationchange', onChange, { passive: true });
  window.visualViewport?.addEventListener('resize', onChange, { passive: true });
}
