# Workflows encadeados — contrato «Entrega → Recebe»

Como um workflow passa o trabalho ao seguinte num projecto com vários tipos (aplicação, website,
branding, marketing). O estado de cada um vive no `PROGRESSO.md ## Workflows`
(formato e regra de retoma: `progresso-formato.md`). As fases de cada workflow estão no catálogo de
pipelines («Website» W1–W7, «Identidade/branding» B1–B7) e no `executar-projeto` (S/E).

Não há workflow de redes sociais: as redes vão sempre pelo `/marketeer`.

## Ordem

```
branding ──B4──► website / app (consomem os tokens, não os recriam)
                     └──W7 (website) · E4 (app)──► marketing (site e lead já medidos)
```

- **Passagem entre workflows** = 1 gate Sim/Não («Avanço para o próximo workflow: <nome>?»).
- **Dentro do workflow** as fases encadeiam sozinhas (`chain:`), com os gates ⛔/⏸ de cada fase.
- Um workflow sem predecessor no projecto começa já (`Começa quando: —`). Ex.: website sem branding
  mede a identidade do que existir (W2 corre `brand-guidelines`/`design-system` só nesse caso).

## Contrato

| De | Entrega | Quem recebe e como |
|---|---|---|
| **branding** | `docs/BRAND.md` · `docs/DESIGN.md` · tokens · `assets/brand/` | **website/app**: W2/E2 medem do `DESIGN.md` (não recriam a identidade) · **marketing**: `marca.md ## Identidade visual` com o caminho dos assets; `## Voz` com o tom do `BRAND.md` |
| **website** | URL publicado · GA4/GTM · eventos `generate_lead` + `formulario` · landings | **marketing**: `conectores.md` do marketeer com site/ga4/gtm já verificados |
| **/start** | núcleo do produto (PRD) + `marca.md` parcial | todos os workflows |

## Regras

- **Quem recebe lê a entrega, não a refaz.** Se a entrega falta ou não passa a prova, o workflow
  anterior não está ✅ — volta-se a ele, não se improvisa no seguinte.
- **Marketing não se espelha no `PROGRESSO.md`:** só o slug (`marketeer: slug=<slug>`). Estado no
  `estado.json` do pack; a RAIZ vai para o frontmatter de `memory/projects/<nome>/index.md`
  (`marketeer_raiz`/`marketeer_slug`). O pack marketeer não se toca.
- **`.joca/loop`** guarda só as fases do workflow activo e um passo de passagem
  `aguarda_utilizador` com `depende_de`; o estado entre sessões é o `PROGRESSO.md ## Workflows`.
