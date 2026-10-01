#!/usr/bin/env node
// `node "<MKT>/scripts/resumo.mjs" <cliente>` (#10, F3): estado do cliente, contas com/sem acesso, última auditoria e
// próximos passos — para outro membro da equipa retomar onde o colega parou. Só leitura.
// Uso: node "<MKT>/scripts/resumo.mjs" <slug> [raiz]   (raiz default: MARKETEER_RAIZ ou a pasta atual)
// Sai com 0 e imprime o resumo; 2 se o cliente não existe (lista os que existem); 1 noutro erro.
//
//   verCliente(slug, { raiz, lerCofre, chaves }) → resumo (objecto; ver o fim do ficheiro)
//   mostrarResumo(resumo) → texto
//
// - Acesso confirma-se pelo cofre (`lerCofre(slug, chave) !== null`), não só pelo `acesso:` do
//   dossier: o valor lido vira booleano logo ali e nunca sai desta função.
// - Canal sem chave conhecida em CHAVES_DO_COFRE, ou cofre ilegível → acesso "por confirmar" (null).
// - Última auditoria = data maior; no mesmo dia, sufixo numérico maior (-10 > -9). Inválida ou
//   corrompida → aviso, e mostra-se a válida anterior (se houver).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ordenarAchados } from './auditoria/correr.mjs';
import { validarDossier, validarFicheiroAuditoria, eEntrada, SEM_FONTE } from './validar-dossier.mjs';
import { ler } from './cofre.mjs';
// Canal → chave(s) do cofre que provam o acesso (basta uma presente); tabela única em chaves.mjs.
import { CHAVES_DO_COFRE } from './chaves.mjs';
import { raizDados } from './raiz.mjs';

// Igual à de correr.mjs: aceita o _exemplo (começa por "_").
const SLUG = /^[a-z0-9_][a-z0-9_-]*$/;
const NOME_AUDITORIA = /^(\d{4}-\d{2}-\d{2})(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?\.json$/;
const TOP = 5;

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---/;

// Slugs de clientes reais: pastas com dossier.md, sem as que começam por "_" (fixtures: _exemplo).
export function listarClientes(raiz = raizDados()) {
  const pasta = join(raiz, 'clientes');
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && existsSync(join(pasta, e.name, 'dossier.md')))
    .map((e) => e.name)
    .sort();
}

// Sem sufixo = 1 (a 1.ª do dia); "-N" = N; sufixo não numérico (só manual) = 1, desempata por texto.
function chaveAuditoria(nome) {
  const [, data, sufixo] = NOME_AUDITORIA.exec(nome);
  const n = sufixo && /^\d+$/.test(sufixo) ? Number(sufixo) : 1;
  return { data, n, sufixo: sufixo ?? '' };
}

export function ordenarAuditorias(nomes) {
  return nomes
    .filter((n) => NOME_AUDITORIA.test(n))
    .sort((a, b) => {
      const x = chaveAuditoria(a);
      const y = chaveAuditoria(b);
      return y.data.localeCompare(x.data) || y.n - x.n || y.sufixo.localeCompare(x.sufixo);
    });
}

// Sem o detalhe do JSON.parse: o Node cita um excerto do ficheiro.
const semExcerto = (e) => (e.startsWith('JSON inválido') ? 'JSON inválido' : e);

function ultimaAuditoria(pasta, slug, avisos) {
  const dir = join(pasta, 'auditorias');
  if (!existsSync(dir)) return null;
  for (const ficheiro of ordenarAuditorias(readdirSync(dir))) {
    const nome = ficheiro.replace(/\.json$/, '');
    let texto;
    let erros;
    try {
      texto = readFileSync(join(dir, ficheiro), 'utf8');
      erros = validarFicheiroAuditoria(texto, slug, nome);
    } catch (e) {
      erros = [`não foi possível ler (${e.code ?? e.name})`];
    }
    if (erros.length) {
      avisos.push(`auditoria auditorias/${ficheiro} inválida, ignorada: ${erros.slice(0, 3).map(semExcerto).join('; ')}`);
      continue;
    }
    const a = JSON.parse(texto.replace(/^﻿/, ''));
    const achados = ordenarAchados(a.achados);
    const graves = achados.filter((ac) => ac.severidade === 'critica' || ac.severidade === 'alta');
    const contagem = { critica: 0, alta: 0, media: 0, baixa: 0 };
    for (const ac of achados) contagem[ac.severidade]++;
    return {
      ficheiro: `auditorias/${ficheiro}`,
      data: a.data,
      metodo: a.metodo,
      contagem,
      graves: graves.slice(0, TOP),
      gravesOmitidos: Math.max(0, graves.length - TOP),
      areasPorVerificar: a.areas.filter((ar) => ar.estado !== 'verificado').map(({ area, estado, nota }) => ({ area, estado, nota })),
    };
  }
  return null;
}

// → { tipo, id, dossier, cofre, acesso, chaves, diverge }. cofre/acesso: true | false | null.
function conta(canal, slug, lerCofre, chaves) {
  const lista = chaves[canal?.tipo] ?? [];
  let cofre = null;
  if (lista.length) {
    try {
      cofre = lista.some((c) => lerCofre(slug, c) !== null);
    } catch {
      cofre = null; // slug que o cofre recusa (ex.: _exemplo) ou ficheiro ilegível
    }
  }
  const dossier = canal?.acesso === true;
  return {
    tipo: String(canal?.tipo ?? '?'),
    id: typeof canal?.id === 'string' ? canal.id : SEM_FONTE,
    dossier,
    cofre,
    acesso: cofre,
    chaves: lista,
    diverge: cofre !== null && cofre !== dossier,
  };
}

function proximosPassos(slug, contas, auditoria, semFonte) {
  const passos = [];
  if (!auditoria) passos.push(`Auditar: /marketeer ${slug}`);
  for (const c of contas) {
    if (c.cofre === false && c.dossier) {
      passos.push(`${c.tipo}: o dossier diz acesso mas o cofre não tem ${c.chaves.join(' / ')} — guardar com node "<MKT>/scripts/guardar-credencial.mjs" ${slug} ${c.chaves[0]} (no terminal do operador)`);
    } else if (c.cofre === true && !c.dossier) {
      passos.push(`${c.tipo}: o cofre tem credencial mas o dossier diz acesso: false — corrigir o dossier`);
    } else if (c.acesso === null && c.dossier) {
      passos.push(`${c.tipo}: confirmar o acesso (o cofre não o prova)`);
    } else if (c.acesso !== true && !c.dossier) {
      passos.push(`${c.tipo}: pedir acesso ao cliente`);
    }
  }
  if (semFonte.length) passos.push(`Completar o dossier (${semFonte.join(', ')} em ${SEM_FONTE}): /marketeer ${slug} → retomar`);
  if (auditoria) {
    for (const ac of auditoria.graves) passos.push(`Resolver [${ac.severidade}] ${ac.regra}${ac.alvo ? ` (${ac.alvo})` : ''} com a skill ${ac.skill}`);
    if (auditoria.areasPorVerificar.length) {
      passos.push(`Áreas por verificar na última auditoria (${auditoria.areasPorVerificar.map((a) => a.area).join(', ')}) — re-auditar quando a causa estiver resolvida`);
    }
  }
  return passos;
}

export function verCliente(slug, { raiz = raizDados(), lerCofre = (s, c) => ler(s, c), chaves = CHAVES_DO_COFRE } = {}) {
  const pasta = typeof slug === 'string' && SLUG.test(slug) ? join(raiz, 'clientes', slug) : null;
  if (!pasta || !existsSync(join(pasta, 'dossier.md'))) {
    return { existe: false, slug: String(slug ?? ''), clientes: listarClientes(raiz) };
  }

  const texto = readFileSync(join(pasta, 'dossier.md'), 'utf8');
  const avisos = validarDossier(texto, slug).map((e) => `dossier: ${e}`);
  let d;
  try {
    d = parse(FRONTMATTER.exec(texto)?.[1] ?? '');
  } catch {
    d = null;
  }
  if (!d || typeof d !== 'object') throw new Error(`dossier ilegível em clientes/${slug}/dossier.md — corrigir com npm run validar`);

  const contas = (Array.isArray(d.canais) ? d.canais : []).map((c) => conta(c, slug, lerCofre, chaves));
  const auditoria = ultimaAuditoria(pasta, slug, avisos);
  const semFonte = ['marca', 'publico', 'objectivos', 'concorrentes'].filter((k) => d[k] === SEM_FONTE)
    .concat(['sector', 'site'].filter((k) => d.cliente?.[k] === SEM_FONTE).map((k) => `cliente.${k}`));

  return {
    existe: true,
    slug,
    nome: typeof d.cliente?.nome === 'string' ? d.cliente.nome : SEM_FONTE,
    estado: typeof d.estado === 'string' ? d.estado : SEM_FONTE,
    actualizado: d.actualizado ? String(d.actualizado) : SEM_FONTE,
    contas,
    auditoria,
    proximosPassos: proximosPassos(slug, contas, auditoria, semFonte),
    avisos,
  };
}

function linhaConta(c) {
  const id = c.id === SEM_FONTE ? '' : ` ${c.id}`;
  if (c.acesso === true) {
    return `  ✓ ${c.tipo}${id} — com acesso (confirmado no cofre)${c.diverge ? ' ⚠ o dossier diz acesso: false' : ''}`;
  }
  if (c.acesso === false) {
    return `  ✗ ${c.tipo}${id} — sem acesso${c.diverge ? ` ⚠ o dossier diz acesso: true, mas o cofre não tem ${c.chaves.join(' / ')}` : ''}`;
  }
  return c.dossier
    ? `  ? ${c.tipo}${id} — acesso por confirmar ⚠ o dossier diz acesso: true, o cofre não o confirma`
    : `  ✗ ${c.tipo}${id} — sem acesso`;
}

export function mostrarResumo(r) {
  if (!r.existe) {
    return [
      `Cliente "${r.slug}" não existe em clientes/.`,
      r.clientes.length ? `Clientes existentes: ${r.clientes.join(', ')}` : 'Ainda não há clientes (só o _exemplo). Criar com /marketeer <marca>.',
    ].join('\n');
  }
  const linhas = [`${r.nome} (${r.slug})`, `Estado: ${r.estado} · actualizado ${r.actualizado}`, '', 'Contas:'];
  if (!r.contas.length) linhas.push('  (nenhum canal no dossier)');
  for (const c of r.contas) linhas.push(linhaConta(c));

  linhas.push('');
  const a = r.auditoria;
  if (!a) {
    linhas.push(`Sem auditoria. Correr /marketeer ${r.slug}`);
  } else {
    const { critica, alta, media, baixa } = a.contagem;
    linhas.push(`Última auditoria: ${a.data} (${a.ficheiro}) — ${critica} crítica(s), ${alta} alta(s), ${media} média(s), ${baixa} baixa(s)`);
    if (!a.graves.length) linhas.push('  Sem achados críticos nem altos.');
    for (const ac of a.graves) linhas.push(`  [${ac.severidade}] ${ac.regra}${ac.alvo ? ` (${ac.alvo})` : ''} — ${ac.evidencia}`);
    if (a.gravesOmitidos) linhas.push(`  (+${a.gravesOmitidos} críticos/altos no ficheiro)`);
    for (const ar of a.areasPorVerificar) linhas.push(`  – ${ar.area}: ${ar.estado} (${ar.nota})`);
  }

  linhas.push('', 'Próximos passos:');
  if (!r.proximosPassos.length) linhas.push('  (nada pendente)');
  r.proximosPassos.forEach((p, i) => linhas.push(`  ${i + 1}. ${p}`));

  if (r.avisos.length) {
    linhas.push('', 'Avisos:');
    for (const av of r.avisos) linhas.push(`  ⚠ ${av}`);
  }
  return linhas.join('\n');
}

if (eEntrada(import.meta.url)) {
  try {
    const [slug, raiz] = process.argv.slice(2);
    if (!slug) throw new Error('uso: node "<MKT>/scripts/resumo.mjs" <slug> [raiz]');
    const r = verCliente(slug, raiz ? { raiz } : {});
    if (!r.existe) {
      console.error(mostrarResumo(r));
      process.exit(2);
    }
    console.log(mostrarResumo(r));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
