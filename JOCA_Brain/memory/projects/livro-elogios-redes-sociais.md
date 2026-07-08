---
name: livro-elogios-redes-sociais
description: Livro de Elogios — Redes Sociais 2026. Produção mensal de posts sociais (IG/FB) por geração AI de imagens finais. DISTINTO da plataforma SaaS (livro-de-elogios.md).
type: project
directorio: D:\Mega\Livro_De_Elogios\2026_Redes_Sociais
---

**Stack:** Design · geração AI de imagem (`agy`=Gemini · `codex`=OpenAI) · Pillow/rembg · HTML+Playwright export.
**Objectivo:** Produzir o conteúdo social mensal (Posts 1200×1500) a partir de copy (design+legenda), sem Photoshop manual. Marca: laranja `#FD5000` + roxo, fonte **Lato**, logo topo, URL rodapé, sem emojis/estrelas.
**NÃO confundir** com `livro-de-elogios.md` (plataforma SaaS, `2026_Nova_Plataforma`).

## Pipeline (resumo)
Copy → ilustração/foto AI (`agy`, ref `_material_global/_Ilustracoes/1.jpg`) → remove-bg/recolor → compor HTML (templates `_template/<tipo>/`) → export Playwright → `[mes]/_Final/` → galeria `leredes.rfdev.pt`.
4 templates: **bra-ilu** (fundo branco, ilustração laranja+roxo — principal) · **lar-ilu** (fundo laranja, ilustração roxo+lavanda) · **post-ent** (entidade do mês, logo+fundo laranja) · **post-foto** (foto real tingida + subject elevation via rembg).
Gotchas de produção completos no `CLAUDE.md` do projecto (secção "Aprendizagens de produção").

## Estado actual (2026-06-30)
- **Maio + Junho:** concluídos. **Julho: 8 posts finalizados** em `07_Julho/_Final` (01 modo-avião · 02 FOTO missão · 03 entidade Grupo Requinte · 04 lar-ilu spoiler-verão · 05 reservado · 06 produto-autocolante · 07 FOTO souvenir · 08 manual-verão). Feed intercalado: ilu→foto→ent→lar-ilu→ilu→ilu→foto→ilu.
- **Post 09 (Elogio do Mês): APAGADO** (era ignorado; removido local + galeria a pedido do Renato 2026-06-30).
- **⚠ Typo URL corrigido (2026-06-30):** rodapé estava `www.livrodelogios.com` (faltava 1 "e"), gravado em TODOS os posts (4 templates + sources Jun+Jul + CLAUDE.md). Correcto = `www.livrodeelogios.com`. Os 17 posts (Jun+Jul) foram **re-renderizados** (Playwright) e **re-deployados** à galeria + cache purgada. Maio NÃO tem `software/` HTML (imagens antigas do site PHP) → não re-renderizável.
- **⚠ Posição logo+URL NORMALIZADA (2026-06-30):** logo (topo) e URL (rodapé) divergiam por template (bra/lar=48px/168px/32px/22px · ent=80/200/48/24 · foto=60/180/48/22 · Jun01 antigo=36/—/24/17 Poppins). Renato exige **posição idêntica ao pixel em todos**. Canónico unificado = **logo `top:48px`/`width:168px` · url `bottom:32px`/`font-size:22px`/Lato**. Aplicado a TODOS os posts Jun+Jul + 4 templates (cor do logo/URL continua a variar por fundo: branco em laranja/foto, laranja em branco). Re-render+redeploy+purge.
- **⚠ GOTCHA Junho 01 Dia da Criança: o ficheiro canónico é `_v2`, NÃO o base.** O base (`01_Post_01_06_Dia_da_Crianca.html`) referencia `01_Dia_da_Crianca_illus.png` que NÃO existe → render partido (imagem partida + layout antigo Poppins/círculos). O `_v2` referencia `..._v2_nobg.png` (existe) e já está calibrado. Renderizar SEMPRE de `_v2` para o final `01_Post_01_06_Dia_da_Crianca.png`. (Erro vivido: render do base nos passos do typo deployou junho 01 partido.)
- Tudo live na galeria de review **`leredes.rfdev.pt`** (Julho + Junho + Maio, secções por mês).

## Pendente
- Julho: **Stories 9:16** (não feitos) — só posts até agora.
- Maio na galeria tem títulos genéricos (nomes de ficheiro pobres) — afinar se o Renato der os temas.

## Última sessão
2026-06-30 (b) — Limpeza/consistência: apagado post 09 Elogios (local+galeria); corrigido typo URL `livrodelogios`→`livrodeelogios` (estava gravado no rodapé de TODOS os posts); **posição logo+URL normalizada ao pixel** (canónico 48/168/32/22 em todos os posts+templates); corrigido bug do junho 01 (renderizava o base partido em vez do `_v2`). 17 posts re-renderizados + re-deployados + cache purgada.
2026-06-30 (a) — Produzido Julho (8 posts, 4 templates) + galeria `leredes.rfdev.pt` criada de raiz (VPS Datalix). Iterações: post-ent logo Grupo Requinte; post-foto souvenir com headroom + cover-fit+crop + recorte isnet/alpha-matting.
