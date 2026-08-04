// Temas de marca ("Custom Temas") — trocam a APARÊNCIA e o NOME do JOCA, nada mais.
//
// Fronteira deliberada: um tema de marca é 100% cosmético. Não toca no cérebro, na memória, nos
// prompts nem no `__global__` do backend — o gestor global continua a chamar-se Joca do lado de lá.
// Só o que o utilizador VÊ muda. Trocar de tema é reversível e não deixa rasto no estado.
//
// Cada tema traz claro E escuro: o modo (claro/escuro/dinâmico) continua a ser escolha separada,
// em `theme.ts`. Marca e modo são eixos independentes — `data-brand` × `data-theme`.
//
// As cores vivem no CSS (`:root[data-brand="..."]` em App.css, um bloco por modo). Aqui fica só o
// que o JS precisa de saber: como se chama e qual o logo.

export interface BrandTheme {
  /** Escrito em `document.documentElement.dataset.brand`. O default não escreve nada. */
  id: string;
  /** Nome do tema no selector das Definições. */
  label: string;
  /** Palavra grande no topo da barra lateral (ao lado da versão). */
  wordmark: string;
  /** Nome do gestor global na navegação e no cabeçalho do chat. */
  managerName: string;
  /** Logo em imagem. Sem isto usam-se os anéis desenhados em CSS (`.sb-logo-rings`). */
  logo?: string;
  /** Ícone do separador. Quadrado, ao contrário do logo — ver `favicon-*.png`. */
  favicon: string;
  /** Uma linha no selector, para se perceber o que se está a escolher. */
  detail: string;
}

export const BRAND_THEMES: BrandTheme[] = [
  {
    id: 'joca',
    label: 'JOCA',
    wordmark: 'JOCA',
    managerName: 'Joca',
    favicon: '/favicon.png',
    detail: 'O tema de origem — laranja sobre preto.',
  },
  {
    id: 'alfredo',
    label: 'Alfredo',
    wordmark: 'ALFREDO',
    managerName: 'Alfredo',
    logo: '/brand/alfredo.png',
    favicon: '/brand/favicon-alfredo.png',
    detail: 'O mordomo de Gotham — amarelo-morcego sobre preto.',
  },
  {
    id: 'kitt',
    label: 'K.I.T.T.',
    wordmark: 'K.I.T.T.',
    managerName: 'KITT',
    logo: '/brand/kitt.png',
    favicon: '/brand/favicon-kitt.png',
    detail: 'O carro que fala — vermelho scanner sobre preto Trans Am.',
  },
  {
    id: 'r2d2',
    label: 'R2-D2',
    wordmark: 'R2-D2',
    managerName: 'R2',
    logo: '/brand/r2d2.png',
    favicon: '/brand/favicon-r2d2.png',
    detail: 'O astromecânico — azul e prata sobre branco de casco.',
  },
  {
    id: 'hal',
    label: 'HAL 9000',
    wordmark: 'HAL 9000',
    managerName: 'HAL',
    logo: '/brand/hal9000.svg',
    favicon: '/brand/favicon-hal.png',
    detail: 'A lente que não pisca — carmim frio sobre ardósia.',
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

/** Escreve a marca no `<html>`. O default não põe atributo — é o que o CSS já assume. */
export function applyBrand(id: string) {
  const brand = getBrand(id);
  if (brand.id === DEFAULT_BRAND.id) delete document.documentElement.dataset.brand;
  else document.documentElement.dataset.brand = brand.id;
  applyFavicon(brand);
  try { localStorage.setItem(LS_BRAND, brand.id); } catch { /* ignore */ }
  // Quem já está montado não observa o localStorage — este evento é o que lhes diz para relerem.
  window.dispatchEvent(new CustomEvent(BRAND_CHANGED));
}

export const BRAND_CHANGED = 'joca-brand-changed';

/**
 * Troca o ícone do separador. O `<link rel="icon">` é reutilizado em vez de se criar um novo: o
 * Chrome fica com o PRIMEIRO que encontra, portanto acrescentar um segundo não mudava nada.
 */
export function applyFavicon(brand: BrandTheme) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  // Só escreve se mudou — reatribuir o href faz o Chrome voltar a pedir o ficheiro.
  if (!link.href.endsWith(brand.favicon)) link.href = brand.favicon;
}
