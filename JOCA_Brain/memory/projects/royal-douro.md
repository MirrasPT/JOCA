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
**How to apply:** Conteúdo SEMPRE fiel ao brand guide (`2026_Redes_Sociais/ROYAL_DOURO_BRAND_GUIDE.md`): preto+dourado, Art Déco, serifada, chiaroscuro. Rodapé legal obrigatório nos posts ("BEBA COM MODERAÇÃO"). Site é static — editar em `_Site_Final/Webiste_2026_01_10/`. graphify corre SÓ nessa pasta (raiz tem binários pesados). Paid ads de vinho = restrições Meta/Google + certificação por país (fase 2).

## Estado actual
Híbrido marketing + dev. Website entregue e estável (static, GA instalado). Trabalho activo: calendário social Jan–Abr, SEO do site, CRO do formulário de reservas, brand consistency.

## Decisões tomadas
- Natureza = "ambos a par" (marketing + dev) — confirmado pelo user.
- graphify só na subpasta do website (33 nodes/30 edges/3 comunidades); raiz não indexada (vídeo/.ai/.psd/.blend).
- Posicionamento: presença/brand (não venda em escala); venda por alocação via formulário, sem e-commerce.
- Ficha técnica `FICHA_TECNICA_Royal_Douro_Reserva_2019.md` adicionada — valores analíticos PROVISÓRIOS (a confirmar por laboratório).
- **Reorganização de ficheiros GD (2026-06-27):** 106 renames/moves, método colisão-check + manifest (nunca sobrescrever — lição da sessão anterior de perda no GD). Raiz limpa; nova pasta `_Referencias/` (refs externas: Saverglass, vídeo Pinea, mockup champagne). `Software/` renomeado (Mockup_*/Rotulo_*/Logo_*). `_Imagens_Finais/_material/` = biblioteca de 42 AI-gens nomeada por pilar (Produto/LifestyleM/LifestyleF/Settings), pastas WIP `_por verificar/_redo` achatadas. Caixa_Madeira + Trifold renomeados. Rollback: `_REORGANIZACAO_2026-06-27_manifest.csv` + `_UNDO.py` na raiz do projecto. **NÃO tocado:** `_Site_Final/` (código), `2026_Redes_Sociais/` (já organizado), `desktop.ini`.

## Pendente
- Baselines reais (GA, IG, reservas).
- Alvo de hosting/deploy do site (cPanel? — confirmar).
- Análise laboratorial oficial da ficha técnica → versão oficial para importadores/distribuidores.
