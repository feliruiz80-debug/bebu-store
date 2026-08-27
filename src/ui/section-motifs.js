/** Illustrated floating motifs for home section cards (not product photos). */

function svgPanales(uid) {
  return `<svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="60" cy="88" rx="38" ry="8" fill="currentColor" opacity="0.12"/>
    <path d="M28 38c0-14 14-22 32-22s32 8 32 22v28c0 10-8 18-18 18H46c-10 0-18-8-18-18V38z" fill="url(#dg-${uid})" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M44 36c6-8 26-8 32 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.35"/>
    <circle cx="46" cy="52" r="3.5" fill="currentColor" opacity="0.25"/>
    <circle cx="74" cy="52" r="3.5" fill="currentColor" opacity="0.25"/>
    <path d="M52 62c4 4 12 4 16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
    <defs>
      <linearGradient id="dg-${uid}" x1="28" y1="16" x2="92" y2="84" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fff" stop-opacity="0.95"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.18"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function svgAlgodones(uid) {
  return `<svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="60" cy="88" rx="34" ry="7" fill="currentColor" opacity="0.12"/>
    <circle cx="58" cy="46" r="26" fill="url(#cg-${uid})" stroke="currentColor" stroke-width="2"/>
    <circle cx="47" cy="38" r="9" fill="#fff" opacity="0.55"/>
    <circle cx="70" cy="42" r="6" fill="#fff" opacity="0.35"/>
    <circle cx="84" cy="60" r="13" fill="url(#cg2-${uid})" stroke="currentColor" stroke-width="1.8" opacity="0.85"/>
    <circle cx="81" cy="55" r="4.5" fill="#fff" opacity="0.5"/>
    <path d="M30 24c8-10 22-14 34-10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.2"/>
    <defs>
      <radialGradient id="cg-${uid}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(46 34) rotate(45) scale(38)">
        <stop stop-color="#fff"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.22"/>
      </radialGradient>
      <radialGradient id="cg2-${uid}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(80 54) rotate(45) scale(18)">
        <stop stop-color="#fff"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.2"/>
      </radialGradient>
    </defs>
  </svg>`;
}

function svgToallas(uid) {
  return `<svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="62" cy="86" rx="36" ry="7" fill="currentColor" opacity="0.12"/>
    <rect x="24" y="28" width="68" height="46" rx="10" fill="url(#wg-${uid})" stroke="currentColor" stroke-width="2.2"/>
    <path d="M34 38h52" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.28"/>
    <path d="M34 46h38" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.2"/>
    <path d="M34 54h44" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.18"/>
    <circle cx="78" cy="58" r="8" fill="#fff" fill-opacity="0.45" stroke="currentColor" stroke-width="1.4"/>
    <path d="M74 58l3 3 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M38 22l18-8 26 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/>
    <defs>
      <linearGradient id="wg-${uid}" x1="24" y1="28" x2="92" y2="74" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fff" stop-opacity="0.96"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.16"/>
      </linearGradient>
    </defs>
  </svg>`;
}

const BUILDERS = {
  panales: svgPanales,
  algodones: svgAlgodones,
  toallas: svgToallas
};

export function sectionMotifIllustrations(motif) {
  const build = BUILDERS[motif] || BUILDERS.panales;
  return [0, 1, 2].map((i) => build(`${motif}-${i}`));
}
