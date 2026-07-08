---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-07-06
project: bodegas-do-campo
---

**Categoria:** command-improvement | **Severidade:** medium | **Descrição:** `/init-project` não tem branch explícito para projectos JÁ inicializados. Corri o comando em cima do Bodegas do Campo (já ligado: memória rica, tabela `~/CLAUDE.md`, GitHub, site quase completo) e o fluxo assume sempre projecto novo/existente-a-detectar — tive de improvisar via `AskUserQuestion` (refrescar / re-init / pasta-mãe). | **Componente afectado:** `.claude/commands/init-project.md` | **Fix sugerido:** Adicionar cheque cedo (antes da Fase 1): se já existe `memory/projects/<nome>.md` OU entrada na tabela `~/CLAUDE.md` → oferecer modo **Refrescar** (re-detectar stack + graphify + actualizar CLAUDE.md/memória sem sobrescrever) vs re-init completo. Evita correr o questionário todo às cegas sobre config existente.

**Categoria:** discovery-gap | **Severidade:** low | **Descrição:** O argumento do `/init-project` apontou para a pasta-mãe (`D:\Mega\Bodegas do Campo (Espanhol)`) mas o projecto de código real vive na subpasta `website_wordpress/` (é o que a memória regista em `directorio:`). O comando não distingue pasta-mãe (design+logo+backups+WP) de subpasta-de-código. | **Componente afectado:** `.claude/commands/init-project.md` (Branch [A] scan) | **Fix sugerido:** Quando o alvo contém subpasta(s) com sinal de código (`.git`, `package.json`, `docker-compose.yml`, tema WP) e a raiz não, propor a subpasta como raiz do projecto.
