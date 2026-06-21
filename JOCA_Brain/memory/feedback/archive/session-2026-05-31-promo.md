---
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-05-31
project: bracaris-brasil-2026
---

**Categoria:** skill-improvement | **Severidade:** high | **Descrição:** A skill `wix-cli` assume Wix CLI/headless, mas em sites **Wix Editor clássico** o CLI não aplica — o caminho real para editar catálogo (descrição, SEO, ribbon, brand) é a **Wix Stores REST API V1** (`PATCH stores/v1/products/{id}`), e stock só pela **Inventory API V2**. A skill não documenta isto, o que leva a tentar o CLI primeiro. | **Componente afectado:** `.claude/skills/wix-cli.md` | **Fix sugerido:** Adicionar secção "Editor clássico → REST API": endpoints V1 produtos, headers (`Authorization` + `wix-site-id` só), CATALOG_V1 vs V3 (428), Inventory V2 para stock, e ler creds de ficheiro (env vars não propagam entre tool-calls).

**Categoria:** doc-gap | **Severidade:** high | **Descrição:** O HTML guardado na descrição de produto Wix **não rende `<p>&nbsp;</p>`** (parágrafos vazios colapsam a altura zero) — custou 4 iterações até acertar o espaçamento. `<br><br>` dentro de `<p>` com conteúdo é o único mecanismo fiável de linha em branco. | **Componente afectado:** `.claude/skills/wix-cli.md` (ou nova nota) | **Fix sugerido:** Documentar regras de render de rich-text Wix: `<br>` fiável, `</p><p>` entre texto = nova linha, `<p>&nbsp;</p>` = invisível; usar `<br><br>` para gaps.

**Categoria:** skill-improvement | **Severidade:** medium | **Descrição:** Com gpt-image-2, passar **garrafas individuais** como refs faz o modelo inventar composição e cor (Rosé saiu coral/pêssego, cápsula Loureiro saiu azul, Branco↔Rosé trocados). Passar a **imagem composta/cena oficial como referência única** resolve. Também: 1ª geração sai com aspecto "mockup" plano → 2ª passada com ênfase "real photographed glass" corrige. | **Componente afectado:** `.claude/skills/img-gen.md` / agente `img-gen-openai` | **Fix sugerido:** Adicionar dica "para produtos com layout/cor fixos, usar a foto composta como ref única, não componentes soltos" + truque "real glass vs mockup".

**Categoria:** tool-reliability | **Severidade:** medium | **Descrição:** ffmpeg converte JPGs **CMYK** (com perfil ICC) com **desvio de cor** (trata o 4º canal como YUV/alfa). Pedido era "webp sem alterar cores" → falhou com ffmpeg. **Pillow** (`ImageCms.profileToProfile` CMYK→sRGB, save WEBP `lossless=True, exact=True`) preserva. | **Componente afectado:** workflow de conversão de imagem (img-gen / assets) | **Fix sugerido:** Nota: para conversão color-faithful, detectar CMYK/ICC e usar Pillow, não ffmpeg.
