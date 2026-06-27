---
name: royal-douro
description: Marca de vinho DOC Douro ultra-premium — híbrido marketing + website static. Cliente Luís Gonçalo (Elite Cozinhas e Bracaris).
type: project
directorio: G:\O meu disco\Clientes\Luis Goncalo (Elite Cozinhas e Bracaris)\Royal Douro
---

**Stack:** Website static — Vanilla HTML/CSS/JS + Tailwind (CDN) + Montserrat. Sem backend/BD. Analytics GA `G-WVZPVW4DYG`. royaldouro.com.
**Objectivo:** Estabelecer presença digital premium e consistência de marca; North Star = reservas/leads via formulário do site.
**Directório:** `G:\O meu disco\Clientes\Luis Goncalo (Elite Cozinhas e Bracaris)\Royal Douro`
**Iniciado:** 2026-06-27
**PRD:** PRD.md existe — actualizar via skill `prd` no /save
**Why:** Vinho tinto DOC Douro ultra-premium (edição limitada por alocação) precisa de ecossistema digital coeso (site + IG @royaldouro.wine) à altura do posicionamento de luxo.
**How to apply:** Conteúdo SEMPRE fiel ao brand guide (`2026_Redes_Sociais/ROYAL_DOURO_BRAND_GUIDE.md`): preto+dourado, Art Déco, serifada, chiaroscuro. Rodapé legal obrigatório nos posts ("BEBA COM MODERAÇÃO"). Site é static — editar em `_Site_Final/Website_2026_01_10/`. graphify corre SÓ nessa pasta (raiz tem binários pesados). Paid ads de vinho = restrições Meta/Google + certificação por país (fase 2).

## Estado actual
Híbrido marketing + dev. Website entregue e estável (static, GA instalado). **Email cold-reach HORECA criado e enviado** (exemplo) ao cliente. Trabalho activo: calendário social Jan–Abr, SEO do site, CRO do formulário de reservas, brand consistency.

**Hosting confirmado:** royaldouro.com é **addon domain** da conta cPanel `renatoferreira@stableserver` (docroot `/home/renatoferreira/royaldouro.com`, atrás de **Cloudflare**). Acesso via skill `cpanel` (UAPI token + SFTP key `~/.ssh/cpanel_renatoferreira`). Outros addons da conta: alkimiawine.pt, bracaris.com, divinealvarinho.com, vinartis.pt.

**Contactos reais (do site/linktree + cPanel):** tel/WhatsApp **+351 911 156 080** · email **geral@vinartis.pt** (publicado no site) · existe também `geral@royaldouro.com` no cPanel · IG @royaldouro.wine. Signatário do email = **Luís Gonçalo**.

**`_Email/`** (pasta nova): `RoyalDouro_ColdReach_HORECA.html`/`.txt` (cold-reach PT-PT, design = clone do site bronze `#bd9168`/`#6f3c17`, hero lifestyle, 2 CTAs pill outline, factos sem caixa, contactos centrados) · `Ficha_Tecnica_Royal_Douro.pdf` (1 pág A4, 2 colunas: lounge à esquerda + specs bronze) · `assets/` (logo-site.png, garrafa-hero.jpg + fonte) · `opcoes_hero/` (4 ambientes AI: restaurante/lounge/pour/penthouse + comparações) · `README_Email.md` · `Preview_RoyalDouro_Email.png`. Assets hospedados em `royaldouro.com/email/` + `/ficha-tecnica.pdf`.

## Decisões tomadas
- Natureza = "ambos a par" (marketing + dev) — confirmado pelo user.
- graphify só na subpasta do website (33 nodes/30 edges/3 comunidades); raiz não indexada (vídeo/.ai/.psd/.blend).
- Posicionamento: presença/brand (não venda em escala); venda por alocação via formulário, sem e-commerce.
- Ficha técnica `FICHA_TECNICA_Royal_Douro_Reserva_2019.md` adicionada — valores analíticos PROVISÓRIOS (a confirmar por laboratório).
- **Reorganização de ficheiros GD (2026-06-27):** 106 renames/moves, método colisão-check + manifest (nunca sobrescrever — lição da sessão anterior de perda no GD). Raiz limpa; nova pasta `_Referencias/` (refs externas: Saverglass, vídeo Pinea, mockup champagne). `Software/` renomeado (Mockup_*/Rotulo_*/Logo_*). `_Imagens_Finais/_material/` = biblioteca de 42 AI-gens nomeada por pilar (Produto/LifestyleM/LifestyleF/Settings), pastas WIP `_por verificar/_redo` achatadas. Caixa_Madeira + Trifold renomeados. Rollback: `_REORGANIZACAO_2026-06-27_manifest.csv` + `_UNDO.py` na raiz do projecto. **NÃO tocado:** `_Site_Final/` (código), `2026_Redes_Sociais/` (já organizado), `desktop.ini`.
- **Email + ficha (2026-06-27):** design DEVE clonar royaldouro.com (li o `style.css`: bronze `#bd9168`/`#6f3c17`, ivory `#e9e3d3`, Montserrat uppercase, botões pill outline). Hero do email = imagem lifestyle gerada por agy/Gemini seguindo o workflow `_DB` (agente `royal-douro` + garrafa ref `_DB/Garrafas/RoyalDouro_Garrafa_v1.png`); restaurante v2 escolhido (rótulo legível). Ficha PDF gerada via Chrome headless (`--print-to-pdf`). Cold-reach: **sem unsubscribe** (decisão do user). Enviado via `gws gmail +send` (renatorff93@gmail.com) a luisgoncalo@hotmail.com + design@renatoferreira.org.

## Pendente
- Baselines reais (GA, IG, reservas).
- Deploy/actualizações do site: via cPanel `renatoferreira` (SFTP) — confirmado.
- Análise laboratorial oficial da ficha técnica → versão oficial para importadores/distribuidores.
- Preencher cargo do signatário (Luís Gonçalo) se quiser título; eventual versão EN do email + ficha.
- `?v=1` (no email já enviado) serve PDF antigo em cache CF ~4h; reenvio com `?v=2` feito.

## Última sessão
2026-06-27 — /init-project + reorganização GD (106 ficheiros) + email cold-reach HORECA (design clone do site, hero lifestyle AI, ficha PDF 2-col) + hospedagem no cPanel royaldouro.com + envio via gws ao cliente.
