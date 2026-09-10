// Brand themes ("Custom Themes") — they swap JOCA's LOOK and NAME, nothing else.
//
// A deliberate boundary: a brand theme is 100% cosmetic. It does not touch the brain, the memory, the
// backend prompts.
// Only what the user SEES changes. Switching theme is reversible and leaves no trace in the state.
//
// Every theme brings light AND dark: the mode (light/dark/dynamic) remains a separate choice,
// in `theme.ts`. Brand and mode are independent axes — `data-brand` × `data-theme`.
//
// The colors live in the CSS (`:root[data-brand="..."]` in App.css, one block per mode). Here stays
// only what the JS needs to know: what it is called and which logo it uses.

export interface BrandTheme {
  /** Written to `document.documentElement.dataset.brand`. The default writes nothing. */
  id: string;
  /** Name of the theme in the Settings selector. */
  label: string;
  /** Big word at the top of the sidebar (next to the version). */
  wordmark: string;
  /** Image logo. Without this the rings drawn in CSS are used (`.sb-logo-rings`). */
  logo?: string;
  /** Tab icon. Square, unlike the logo — see `favicon-*.png`. */
  favicon: string;
  /** One line in the selector, so you can tell what you are choosing. */
  detail: string;
}

export const BRAND_THEMES: BrandTheme[] = [
  {
    id: 'joca',
    label: 'JOCA',
    wordmark: 'JOCA',
    favicon: '/favicon.png',
    detail: 'The original theme — orange on black.',
  },
  {
    id: 'alfredo',
    label: 'Alfredo',
    wordmark: 'ALFREDO',
    logo: '/brand/alfredo.png',
    favicon: '/brand/favicon-alfredo.png',
    detail: "Gotham's butler — bat-yellow on black.",
  },
  {
    id: 'kitt',
    label: 'K.I.T.T.',
    wordmark: 'K.I.T.T.',
    logo: '/brand/kitt.png',
    favicon: '/brand/favicon-kitt.png',
    detail: 'The car that talks — scanner red on Trans Am black.',
  },
  {
    id: 'r2d2',
    label: 'R2-D2',
    wordmark: 'R2-D2',
    logo: '/brand/r2d2.png',
    favicon: '/brand/favicon-r2d2.png',
    detail: 'The astromech — blue and silver on hull white.',
  },
  {
    id: 'hal',
    label: 'HAL 9000',
    wordmark: 'HAL 9000',
    logo: '/brand/hal9000.svg',
    favicon: '/brand/favicon-hal.png',
    detail: 'The lens that does not blink — cold crimson on slate.',
  },
  {
    id: 'office',
    label: 'The Office',
    wordmark: 'DUNDER MIFFLIN',
    logo: '/brand/office.png',
    favicon: '/brand/favicon-office.png',
    detail: 'Scranton office — black and white, ink on paper.',
  },
];

export const DEFAULT_BRAND = BRAND_THEMES[0];
export const LS_BRAND = 'joca-brand';

export function getBrand(id: string | null | undefined): BrandTheme {
  return BRAND_THEMES.find((b) => b.id === id) ?? DEFAULT_BRAND;
}

export function readBrand(): BrandTheme {
  try { return getBrand(localStorage.getItem(LS_BRAND)); } catch { return DEFAULT_BRAND; }
}

/** Writes the brand on `<html>`. The default sets no attribute — that is what the CSS already assumes. */
export function applyBrand(id: string) {
  const brand = getBrand(id);
  if (brand.id === DEFAULT_BRAND.id) delete document.documentElement.dataset.brand;
  else document.documentElement.dataset.brand = brand.id;
  applyFavicon(brand);
  try { localStorage.setItem(LS_BRAND, brand.id); } catch { /* ignore */ }
  // Whatever is already mounted does not observe localStorage — this event is what tells it to re-read.
  window.dispatchEvent(new CustomEvent(BRAND_CHANGED));
}

export const BRAND_CHANGED = 'joca-brand-changed';

/**
 * Swaps the tab icon. The `<link rel="icon">` is reused instead of creating a new one: Chrome
 * keeps the FIRST one it finds, so adding a second would change nothing.
 */
export function applyFavicon(brand: BrandTheme) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  // Only writes if it changed — reassigning the href makes Chrome request the file again.
  if (!link.href.endsWith(brand.favicon)) link.href = brand.favicon;
}
