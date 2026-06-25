---
processed: true
processed_date: 2026-06-23
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-22
project: bigorna-2026
---
processed: true
processed_date: 2026-06-23

**Categoria:** workflow-gap | **Severidade:** high | **Descrição:** A memória do projecto (`bigorna-2026.md`) estava ~3 semanas atrasada — dizia "frontend por montar / fases backend 3/5/6/7 pendentes" quando o site estava completo e finalizado para produção no GitHub. Causa: o trabalho foi feito noutra máquina (graph antigo tem path macOS `/Users/renatoferreira/...`) e nunca foi `/save`'d/sincronizado. A memória JOCA vive em `JOCA_Brain/memory/` local, sem sync entre máquinas → cada máquina tem uma visão divergente do estado do projecto. | **Componente afectado:** `memory/projects/*`, fluxo `/save` e `/resume` | **Fix sugerido:** (a) `/resume` deve comparar o estado da memória com o git real (último commit vs "Última sessão" da memória) e ALERTAR quando divergem muito — não confiar cegamente na memória; (b) considerar sincronizar `JOCA_Brain/memory/projects/` via o próprio repo do projecto ou um remote partilhado, para projectos trabalhados em multi-máquina; (c) `/save` podia stampar o SHA do último commit na "Última sessão" para detecção de drift na próxima `/resume`.

**Categoria:** command-improvement | **Severidade:** low | **Descrição:** `/resume` foi invocado com um 2º argumento (URL do GitHub) — `/resume "<path>" <github-url>`. O comando não documenta nem trata um URL de remote; funcionou só porque foi interpretado ad-hoc (religar `origin`, fetch, reset). | **Componente afectado:** `.claude/commands/resume.md` | **Fix sugerido:** documentar no `/resume` o 2º arg opcional `<git-remote-url>` → se passado e o repo local não tiver esse remote, religar (`remote add` + `fetch` + comparar working tree vs `origin/<default>`), de forma não-destrutiva, e reportar a divergência. Padrão de reconciliação não-destrutivo já validado nesta sessão (ver `bigorna-2026.md` decisão 2026-06-22 e gotcha Git+MEGAsync no CLAUDE.md do projecto).
