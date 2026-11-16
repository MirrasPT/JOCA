// Defeito D1 (verificação 2026-11-16): mudar de vista a meio de uma gravação desmontava o
// `TerminalView` que gravava e o áudio perdia-se em silêncio. O controlador do ditado vive no
// frontend, fora do React, e é código puro: testa-se aqui com o vitest do backend, com o
// microfone, o motor e a limpeza como duplos.
import { describe, expect, it, vi } from 'vitest';
import {
  ControladorDoDitado,
  type DependenciasDoDitado,
  type Destino,
} from '../../../frontend/src/components/voice/dictation-controller';

const ESTADO = {
  modelos: [{ id: 'm', nome: 'M', bytes: 1, origem: 'joca' as const }],
  idiomas: ['pt'],
  descarga: null,
  definicoes: { correcaoLigada: true, modeloCorrecao: 'haiku', termos: [], modeloVoz: 'm', idioma: 'pt' },
  falhaDoMotor: null,
  motorCarregado: true,
};

function montar(texto = 'o que eu disse') {
  const gravador = { terminar: vi.fn(() => new Float32Array(16_000)), descartar: vi.fn() };
  const deps = {
    lerEstado: vi.fn(async () => ESTADO),
    transcrever: vi.fn(async () => ({ texto, truncado: false })),
    corrigir: vi.fn(async (t: string) => ({ corrigido: true as const, texto: `${t}.` })),
    prepararMotor: vi.fn(async () => undefined),
    descarregar: vi.fn(async () => undefined),
    abrirMicrofone: vi.fn(async () => gravador),
    capturarContexto: vi.fn(async () => null),
  } satisfies DependenciasDoDitado;
  return { c: new ControladorDoDitado(deps), deps, gravador };
}

/** Uma vista (`TerminalView`) que só consegue entregar às sessões que mostra. */
function vista(sessoes: string[]) {
  const entregues: [string, string][] = [];
  const avisos: (string | null)[] = [];
  const destino: Destino = {
    entregar: vi.fn((origem: string, texto: string) => {
      if (!sessoes.includes(origem)) return false;
      entregues.push([origem, texto]);
      return true;
    }),
    avisar: vi.fn((a: string | null) => { avisos.push(a); }),
  };
  return { destino, entregues, avisos, sessoes };
}

describe('D1 — mudar de vista a meio de uma gravação', () => {
  it('a vista que gravava desmonta: a gravação termina, é transcrita e não se perde', async () => {
    const { c, deps, gravador } = montar();
    const projecto = vista(['s1']);
    c.ligar(projecto.destino);
    await c.iniciar('s1');
    expect(c.fase.nome).toBe('a-ouvir');

    // Troca para a vista solta: a do projecto desmonta, a solta (que não mostra s1) monta.
    const solta = vista(['s2']);
    c.desmontar(projecto.destino);
    c.ligar(solta.destino);

    await vi.waitFor(() => expect(c.fase.nome).toBe('parado'));
    expect(gravador.terminar).toHaveBeenCalledTimes(1);
    expect(gravador.descartar).not.toHaveBeenCalled();
    expect(deps.transcrever).toHaveBeenCalledTimes(1);
    // Ninguém mostra s1: fica guardado para s1, com aviso — nunca no terminal errado.
    expect(solta.entregues).toEqual([]);
    expect(c.pendentesDe('s1')).toEqual(['o que eu disse.']);
    expect(solta.avisos.at(-1)).toMatch(/ficou guardado/);

    // s1 volta a estar visível: o texto entra, com aviso, e sai da memória.
    solta.sessoes.push('s1');
    c.entregarPendentes('s1');
    expect(solta.entregues).toEqual([['s1', 'o que eu disse.']]);
    expect(solta.avisos.at(-1)).toMatch(/Recuperei/);
    expect(c.pendentesDe('s1')).toEqual([]);
  });

  it('a nova vista mostra a sessão de origem: entrega logo, pela id da sessão', async () => {
    const { c } = montar();
    const a = vista(['s1']);
    c.ligar(a.destino);
    await c.iniciar('s1');
    const b = vista(['s1', 's2']);
    c.desmontar(a.destino);
    c.ligar(b.destino);
    await vi.waitFor(() => expect(b.entregues).toEqual([['s1', 'o que eu disse.']]));
    expect(a.entregues).toEqual([]);
  });

  it('sem nenhuma vista montada quando o texto chega: guarda o texto e o aviso para a próxima', async () => {
    const { c } = montar();
    const a = vista(['s1']);
    c.ligar(a.destino);
    await c.iniciar('s1');
    c.desmontar(a.destino);
    await vi.waitFor(() => expect(c.fase.nome).toBe('parado'));
    expect(c.pendentesDe('s1')).toEqual(['o que eu disse.']);
    const b = vista(['s1']);
    c.ligar(b.destino);
    expect(b.avisos.at(-1)).toMatch(/ficou guardado/);
    c.entregarPendentes('s1');
    expect(b.entregues).toEqual([['s1', 'o que eu disse.']]);
  });

  it('a limpeza a falhar depois da troca entrega o texto em bruto à origem', async () => {
    const { c, deps } = montar();
    deps.corrigir.mockRejectedValueOnce(new Error('o backend não respondeu em 45 s'));
    const a = vista(['s1']);
    c.ligar(a.destino);
    await c.iniciar('s1');
    const b = vista(['s1']);
    c.desmontar(a.destino);
    c.ligar(b.destino);
    await vi.waitFor(() => expect(b.entregues).toEqual([['s1', 'o que eu disse']]));
  });

  it('desmontar ainda a abrir o microfone cancela (nada foi dito) e larga o microfone', async () => {
    const { c, deps, gravador } = montar();
    let abrir!: (g: typeof gravador) => void;
    deps.abrirMicrofone.mockImplementationOnce(() => new Promise((r) => { abrir = r; }));
    const a = vista(['s1']);
    c.ligar(a.destino);
    const inicio = c.iniciar('s1');
    await vi.waitFor(() => expect(deps.abrirMicrofone).toHaveBeenCalled());
    c.desmontar(a.destino);
    abrir(gravador);
    await inicio;
    expect(c.fase.nome).toBe('parado');
    expect(gravador.descartar).toHaveBeenCalledTimes(1);
    expect(deps.transcrever).not.toHaveBeenCalled();
  });
});
