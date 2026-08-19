// GIFs do tema "The Office" — substituem os ícones da barra lateral, e SÓ com `data-brand="office"`.
//
// NÃO se edita código para os pôr. Largam-se ficheiros em `public/brand/office/` com estes nomes:
//
//     dashboard · automacoes · agentes · definicoes · projectos
//
// A extensão pode ser `.webp`, `.gif` ou `.png`, por essa ordem de preferência. O Giphy serve
// `.webp` animado, que é o formato mais leve dos três (e o que o "copiar link" de lá dá), por isso
// vem primeiro — não vale a pena converter para GIF para o ficheiro ficar maior.
//
// Cada um que exista passa a ser o ícone; os que faltarem continuam com o glifo desenhado. Não é
// preciso reiniciar nada — basta recarregar a página.
//
// ⚠ Porquê ficheiros locais e não links do Giphy cravados aqui: este repositório é PÚBLICO, e os
// GIFs da série são obra de terceiros. Um link no código publicado faz com que TODA a gente que
// clonar passe a distribuí-los; um ficheiro na pasta abaixo fica só nesta máquina — a pasta está no
// `.gitignore`. Como efeito lateral, funciona offline, coisa que o hotlink não faz.
const DIR = '/brand/office/';
/** Ordem de tentativa. Primeiro o que o Giphy dá e é mais leve. */
const EXT = ['webp', 'gif', 'png'];

/** Nome do ícone na barra → nome do ficheiro. Só estes cinco é que aceitam GIF. */
export const OFFICE_GIF_FILES: Record<string, string> = {
  'layout-dashboard': 'dashboard',
  zap: 'automacoes',
  terminal: 'agentes',
  // Chave à parte da dos Agentes de propósito: partilhá-la punha o mesmo GIF nos dois sítios.
  'terminal-quick': 'sessao',
  settings: 'definicoes',
  folder: 'projectos',
};

/**
 * Cache do resultado da sondagem, por nome de ícone. Sem isto havia um pedido por CADA instância do
 * ícone (a barra desenha o mesmo ícone em várias linhas) e o 404 dos que não existem repetia-se em
 * todos os renders.
 *   undefined = ainda não sondado · null = não existe · string = URL bom
 */
const cache = new Map<string, string | null>();
const emCurso = new Map<string, Promise<string | null>>();

/**
 * Tenta `base.webp`, `base.gif`, `base.png` e devolve o primeiro que carregue.
 * `new Image()` em vez de fetch: não precisa de CORS e é o mesmo pedido que o `<img>` faria a
 * seguir, portanto o browser serve-o do cache e não há segunda ida à rede.
 */
function primeiraQueCarrega(base: string, i = 0): Promise<string | null> {
  if (i >= EXT.length) return Promise.resolve(null);
  const url = `${base}.${EXT[i]}`;
  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  }).then((r) => r ?? primeiraQueCarrega(base, i + 1));
}

/** Sonda o ficheiro uma vez e devolve o URL se ele existir. */
export function probeOfficeGif(name: string): Promise<string | null> {
  const ficheiro = OFFICE_GIF_FILES[name];
  if (!ficheiro) return Promise.resolve(null);
  if (cache.has(name)) return Promise.resolve(cache.get(name) ?? null);
  const jaVai = emCurso.get(name);
  if (jaVai) return jaVai;

  const p = primeiraQueCarrega(`${DIR}${ficheiro}`).then((r) => {
    cache.set(name, r);
    emCurso.delete(name);
    return r;
  });
  emCurso.set(name, p);
  return p;
}

// ── Pool: um GIF por projecto / por sessão ─────────────────────────────────────────────────────
//
// Ficheiros em `public/brand/office/pool/` numerados a partir de `01`: `01.webp`, `02.webp`, …
// (também aceita `.gif` e `.png`). A sondagem pára no primeiro número que falte, portanto o
// tamanho da pool é o que estiver na pasta — acrescentar ou tirar ficheiros não exige tocar aqui.
const POOL_DIR = '/brand/office/pool/';
/** Tecto da sondagem. Só existe para o ciclo não ser infinito se a pasta tiver algo estranho. */
const POOL_MAX = 60;

let poolPromise: Promise<string[]> | null = null;

/** URLs da pool, por ordem. Sondada UMA vez por carregamento da página. */
export function loadOfficePool(): Promise<string[]> {
  if (poolPromise) return poolPromise;
  poolPromise = (async () => {
    const encontrados: string[] = [];
    for (let i = 1; i <= POOL_MAX; i++) {
      const url = await primeiraQueCarrega(POOL_DIR + String(i).padStart(2, '0'));
      if (!url) break;
      encontrados.push(url);
    }
    return encontrados;
  })();
  return poolPromise;
}

/**
 * Escolha ESTÁVEL: o mesmo id dá sempre o mesmo GIF.
 *
 * "Aleatório" aqui não pode ser `Math.random()` — com um valor novo a cada render o ícone mudava a
 * cada repintura da barra e nunca se aprendia a reconhecer um projecto pela imagem. O que se quer é
 * imprevisível ENTRE projectos e fixo PARA um projecto: um hash do id dá exactamente isso, e
 * sobrevive a recarregar a página sem guardar estado nenhum.
 */
export function poolIndex(id: string, total: number): number {
  if (total <= 0) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h % total;
}

/**
 * URL do fotograma PARADO que acompanha um animado (`x.webp` → `x-still.webp`).
 *
 * Gerado por script a partir do primeiro fotograma. É o que se mostra em repouso: um GIF não se
 * pausa por CSS nem por atributo, portanto "estático até ao hover" só se faz com duas imagens.
 * Efeito lateral que vale por si: a barra passa a carregar ~20 KB por ícone em vez de 0,5-2 MB, e o
 * ficheiro animado só é pedido à rede quando o rato lá passa.
 */
export function stillFor(url: string): string {
  return url.replace(/\.(webp|gif|png)$/i, '-still.webp');
}
