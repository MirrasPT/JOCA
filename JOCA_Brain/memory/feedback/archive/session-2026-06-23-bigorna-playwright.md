---
processed: true
processed_date: 2026-06-23
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-23
project: bigorna-2026
---
processed: true
processed_date: 2026-06-23

**Categoria:** tool-reliability | **Severidade:** high | **Descrição:** O MCP Playwright (`browser_*`) NÃO estava disponível nesta sessão — nem ao main loop, nem a um sub-agente `general-purpose` despachado com Step 0 a fazer `ToolSearch` por `select:browser_navigate,...` e por keywords. O agente reportou correctamente o bloqueio (sem fabricar) e devolveu só reachability via curl. Isto contradiz a gotcha actual em `rules/workflows-and-tooling.md` ("Browser (Playwright) no main loop ... só aos sub-agentes") — aqui não estava exposto a NENHUM dos dois. Resultado: pedido explícito do user ("abre no browser, verifica") só pôde ser cumprido a meias (abri o browser do SO via `Start-Process`, mas sem screenshots/console/DOM automáticos; verificação caiu em `tsc` + transform do vite + olho do user). | **Componente afectado:** MCP playwright (config global) + `rules/workflows-and-tooling.md` (secção "Browser (Playwright) no main loop") + `CLAUDE.md` (lista "MCPs globais: playwright") | **Fix sugerido:** (1) Confirmar se o playwright MCP arranca de facto em sessões headless/normais — pode precisar de `npx playwright install` ou estar a falhar silenciosamente no boot do MCP; (2) corrigir a gotcha para reflectir que o playwright pode estar **totalmente ausente** (não só "só sub-agentes") e dar um fallback canónico: abrir no browser do SO (`Start-Process <url>` em Windows) + verificação por `tsc`/transform, e pedir confirmação visual ao user; (3) considerar um skill/agente "browser-verify" que detecta a ausência do MCP e degrada com elegância em vez de cada agente redescobrir o bloqueio.

**Categoria:** doc-gap | **Severidade:** low | **Descrição:** A gotcha de ambiente "FRONTEND DEV (Vite) no host vs container" (binários nativos Windows no `node_modules` → vite não corre no container Linux; docker-proxy segura :5173 → host usa :5174) é específica de projectos Sail/Docker em Windows com frontend Vite e não estava documentada em lado nenhum do JOCA. Foi gravada na memória do projecto Bigorna, mas é um padrão genérico (qualquer projecto Laravel Sail + Vite no Windows do Renato). | **Componente afectado:** `rules/workflows-and-tooling.md` (secção "Ambiente local Windows-first") ou skill `laravel-react`/`deploy-docker` | **Fix sugerido:** considerar promover a regra "Vite corre no HOST, não no container Sail; node_modules tem binários da plataforma do `npm install`; docker-proxy segura a porta mapeada mesmo sem processo dentro" para `workflows-and-tooling.md` como gotcha de ambiente reutilizável.
