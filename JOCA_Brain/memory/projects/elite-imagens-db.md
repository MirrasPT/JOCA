---
name: elite-imagens-db
description: Geração mensal de assets AI (imagens + copy social) para marcas de vinho Royal Douro / Alkimia / Bracaris / Divine — cliente Luis Gonçalo (Elite Cozinhas e Bracaris)
type: project
directorio: G:\O meu disco\Clientes\Luis Goncalo (Elite Cozinhas e Bracaris)\_DB
---

**Tipo:** Design — geração AI de assets (PNG) + copy social media, ciclo mensal.
**Cliente:** Luis Gonçalo — Elite Cozinhas e Bracaris.
**Motor por defeito:** Gemini (`img-gen-google` / agy). gpt-image-2 (`img-gen-openai`) só se pedido — melhor para fidelidade de padrão de packaging.
**Fonte de verdade:** `Branding.md` no directório do projecto (guia visual por marca + glossário + template JSON + limitações). Ler sempre no início de sessão.
**Iniciado:** 2026-05-08.

## Estrutura mensal
- `Garrafas/` — referências de produto (ÚNICA fonte de referência para prompts; nunca usar `Imagens_Geradas/`).
- `Imagens_Geradas/[Alkimia|Royal|Bracaris]/` — outputs; versões antigas/rejeitadas em `_old/`.
- `Redes/[MM_Mes]/_Final/` — PNGs+PSDs aceites + `posts_[MM-AAAA].html`.
- `Redes/{Alkimia,Royal,Bracaris}RS.md` — tom/pilares de copy por marca (têm emojis legados — NÃO replicar).

## Ciclo mensal (8 imagens)
- Alkimia 4 (2 dark + 2 light, mix produto+lifestyle), Royal 3 (lifestyle luxo, ambientes diferentes), Bracaris 1 (color, lifestyle).
- Copy: zero emojis, sem excepção.

## Estado actual
**Ciclo Junho 2026 — imagens geradas, agentes validados.** 8/8 deliverables em `Imagens_Geradas/[Marca]/`:
- Alkimia: Tinto (dark produto), Alvarinho (light produto), Latas (light lifestyle, Branco+Sidra+Rosé), Rosé (dark lifestyle, regenerado).
- Royal: Michelin, Penthouse, Paddock F1 (lifestyle luxo).
- Bracaris: Branco (mesa minhota).
- Extras de teste do agente: `RoyalDouro_TESTE` (vernissage), `Bracaris_TESTE` (festival jardim).

Maio 2026 entregue (`Redes/05_Maio/_Final/`, 8 posts + posts_maio_2026.html).

## Decisões tomadas
- 2026-06-07: Ciclo Junho gerado via workflow (8 agentes Gemini em paralelo). 7/8 aprovados à primeira; Rosé regenerado (padrão), Latas regenerada (continha lata de Tinto inexistente).
- 2026-06-07: Confirmado — **memória do projecto fica no projecto** (`Branding.md`), não na pasta base do JOCA.
- 2026-06-07: Teste dos agentes `img-gen-google` validado nas 3 marcas (1 imagem/marca).

## Pendente
- `Redes/06_Junho/_Final/posts_junho_2026.html` — copy social (zero emojis, ler RS.md por marca).
- Fechar formatos finais no PSD (agy exporta 1:1; crop para 3:4/2:3 no Photoshop).
- Divine — marca ainda sem assets nem garrafa de referência.
- Limpar `Imagens_Geradas/Bracaris/1.png` (ficheiro perdido de Maio).

## Última sessão
2026-06-07 — Ciclo Junho gerado + agentes img-gen validados; regra "sem lata de Tinto" e limitações do agy (1:1, fidelidade de padrão) adicionadas ao Branding.md.
