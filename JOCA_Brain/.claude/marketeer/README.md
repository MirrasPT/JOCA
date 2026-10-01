# Motor do pack marketeer

Scripts Node que as skills `marketeer*` e `mkt-*` chamam: dossier e estado das marcas, cofre de
credenciais, auditoria (SEO, tracking, presença, GBP, GA4), Google Ads (diagnóstico, campanhas em
pausa, CSV, investimento) e tracking (plano de medição, contentor GTM, prova de consentimento).
Nomes, ficheiros e regras: `CONTRATO.md` (ganha a tudo).

O motor **não guarda dados de marcas**. Os dados vivem numa pasta de trabalho (`<RAIZ>/clientes/<slug>/`)
e as credenciais no cofre `~/.config/marketeer/<slug>.env` (chmod 600), nunca aqui.

## Instalação (1× por máquina)

Requer Node ≥ 22.

```bash
npm --prefix "<MKT>" ci
npx --prefix "<MKT>" playwright install --only-shell chromium   # auditoria de tracking e prova
```

## Variáveis

| Variável | O que é | Se faltar |
|---|---|---|
| `MARKETEER_HOME` | caminho deste diretório (`<MKT>`) | JOCA: `<JOCA_Brain>/.claude/marketeer`; autónomo: `~/.claude/marketeer` |
| `MARKETEER_RAIZ` | pasta de trabalho com `clientes/` (`<RAIZ>`) | os scripts usam a pasta atual |

Descobrir/gravar a raiz (ordem do CONTRATO §2: env → pasta atual com `clientes/` → `~/.config/marketeer/config.json`):

```bash
node "<MKT>/scripts/raiz.mjs"                     # imprime a raiz (saída 0) ou sai 2: perguntar ao operador
node "<MKT>/scripts/raiz.mjs" --definir ~/Marketeer
```

Depois, sempre com a raiz exportada:

```bash
export MARKETEER_RAIZ="<RAIZ>"
node "<MKT>/scripts/estado.mjs" ler <slug>
node "<MKT>/scripts/conectores.mjs" <slug>
```

## Scripts

- `raiz.mjs` · `estado.mjs` (estado do ciclo, CONTRATO §3) · `conectores.mjs` (rascunho da matriz, §4)
- `criar-dossier.mjs` · `validar-dossier.mjs` · `resumo.mjs` · `cofre.mjs` · `guardar-credencial.mjs` · `chaves.mjs`
- `auditoria/` · `ads/` · `campanha/` · `tracking/`

Modelos (`modelos/`) resolvem-se a partir do próprio script; os dados, a partir de `MARKETEER_RAIZ`.

## Testes

```bash
npm --prefix "<MKT>" test                              # node --test (sem rede: fetch e Google falsos)
MARKETEER_RAIZ="<RAIZ>" npm --prefix "<MKT>" run validar   # formato + ausência de segredos em <RAIZ>/clientes
```
As fixtures (`test/fixtures/clientes/`) são fictícias (`exemplo.invalid`, `GTM-XXXXXXX`).
