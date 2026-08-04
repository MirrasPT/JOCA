import { useEffect, useState } from 'react';
import { BRAND_CHANGED, readBrand, type BrandTheme } from '../lib/brand';

/**
 * Marca activa, reactiva. O `index.html` já aplicou o `data-brand` antes do primeiro paint (sem
 * isso via-se o tema errado a piscar); este hook só serve para o NOME e o LOGO, que vivem em JSX
 * e não em CSS. Ouve o evento de troca para o painel de definições não obrigar a recarregar.
 */
export function useBrand(): BrandTheme {
  const [brand, setBrand] = useState<BrandTheme>(() => readBrand());

  useEffect(() => {
    const sync = () => setBrand(readBrand());
    window.addEventListener(BRAND_CHANGED, sync);
    // Outro separador aberto no mesmo JOCA muda a marca → o `storage` chega só aos OUTROS.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(BRAND_CHANGED, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return brand;
}
