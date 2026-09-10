import { useEffect, useState } from 'react';
import { BRAND_CHANGED, readBrand, type BrandTheme } from '../lib/brand';

/**
 * Active brand, reactive. `index.html` already applied the `data-brand` before the first paint
 * (without that you saw the wrong theme flash); this hook only serves the NAME and the LOGO, which
 * live in JSX and not in CSS. It listens to the switch event so the settings panel does not force a reload.
 */
export function useBrand(): BrandTheme {
  const [brand, setBrand] = useState<BrandTheme>(() => readBrand());

  useEffect(() => {
    const sync = () => setBrand(readBrand());
    window.addEventListener(BRAND_CHANGED, sync);
    // Another tab open on the same JOCA changes the brand → `storage` reaches only the OTHERS.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(BRAND_CHANGED, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return brand;
}
