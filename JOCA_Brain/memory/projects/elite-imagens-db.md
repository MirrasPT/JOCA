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
**Ciclo Junho 2026 — COMPLETO.** 8/8 imagens + `Redes/06_Junho/_Final/posts_06-2026.html` (memória anterior dizia "pendente" — estava desactualizada, o ficheiro já existia).

**Ciclo Julho 2026 — COMPLETO (8/8), publicado em `luisplanoredes.rfdev.pt`.** Gerado via agentes paralelos seguindo `.claude/agents/{alkimia,royal-douro,bracaris}.md`, com 1 bloqueio de quota Gemini (429 `gemini-3.1-flash-image`, reset 2026-07-03T14:31:00Z) e 1 ronda de redo pedida pelo Renato:
- Royal Douro: 3/3 — Editorial, Pour, Jantar. **Editorial e Jantar foram refeitos** (1ª versão tinha rótulo com texto errado "COPRA FOSCO" e visual demasiado CGI — Renato pediu redo). Versão final: Editorial limpo; **Jantar tem 2 micro-defeitos de texto aceites** (medalhão redondo "garbled", possível "VIRHO" em vez de "VINHO" no rótulo pequeno) — sinalizado para correcção no PSD, não bloqueou publicação.
- Alkimia: 4/4 — Alvarinho (Produto, Dark), Branco (Produto, Light), Loureiro (Lifestyle, Dark), Rosé (Lifestyle, Light — gerado após reset de quota). **Rosé tem typos no label** ("VCRDE"/"POOTUGAL" em vez de VERDE/PORTUGAL) — sinalizado para correcção no PSD.
- Bracaris: 1/1 — Rosé (picnic/vinhedo à beira-rio, balde de vime com flores/gelo). **1ª versão aceite pelo agente tinha o rótulo estruturalmente errado** (fundo branco + "B" em contorno + flores em ovais soltos) — invertido face à garrafa real (painel rosa SÓLIDO em forma de B com medalhões florais brancos lá dentro). Renato apanhou o erro ("a imagem não tem nada a ver"). Regenerado com descrição literal da referência real (não só o texto vago do Branding.md) — versão final bate certo, só falta acento em "ROSÉ" (saiu "ROSE") a corrigir no PSD.
- **Lição:** o texto do Branding.md/bracaris.md ("giant stylised B with floral emblems") é vago demais para o Gemini acertar a estrutura de cor do rótulo — descrever literalmente a partir da imagem de referência (painel sólido vs. outline) é obrigatório, não opcional. Actualizar `bracaris.md` com esta descrição precisa.
- `Redes/07_Julho/_Final/posts_07-2026.html` com 8 posts, **reorganizado por secções de marca** (Alkimia → Royal Douro → Bracaris, a pedido do Renato) em vez de ordem cronológica intercalada. Deploy final + health-check 200 OK em todos os PNGs.

Maio 2026 entregue (`Redes/05_Maio/_Final/`, 8 posts + posts_maio_2026.html).

## Infra web das marcas (cPanel renatoferreira.org)
Descoberto 2026-07-06. As marcas do cliente vivem como **addon domains na conta cPanel `renatoferreira.org`** (stableserver) — geridas via `.claude/skills/cpanel.md`:
- Addon domains: `alkimiawine.pt`, `bracaris.com`, `divinealvarinho.com`, `royaldouro.com`, `vinartis.pt` (vinartis = empresa produtora; email geral do cliente = `geral@vinartis.pt`).
- **Alkimia** (`alkimiawine.pt`, docroot home-relative `alkimiawine.pt/`): `index.html` (coming-soon, captura email, tagline *"A transformação da natureza em elegância líquida"*), **`links.html`** = link-in-bio em `alkimiawine.pt/links` (Website · Instagram @alkimia.wine · Facebook · email; Montserrat + Font Awesome; NÃO liga às páginas de produto), e 7 páginas de produto `{alvarinho,branco,branco-lata,loureiro,rose,rose-lata,tinto}-info.html` + `img/`.
- **NÃO existe** subdomínio `link.alkimiawine.pt` (nem `links.`) — o hub é a subpágina `/links`. Os únicos subdomínios da conta são `luz/borntobyhype/baby.renatoferreira.org` (não relacionados).
- Handle Instagram Alkimia = **@alkimia.wine** (IG + FB).

## Decisões tomadas
- 2026-06-07: Ciclo Junho gerado via workflow (8 agentes Gemini em paralelo). 7/8 aprovados à primeira; Rosé regenerado (padrão), Latas regenerada (continha lata de Tinto inexistente).
- 2026-06-07: Confirmado — **memória do projecto fica no projecto** (`Branding.md`), não na pasta base do JOCA.
- 2026-06-07: Teste dos agentes `img-gen-google` validado nas 3 marcas (1 imagem/marca).
- 2026-06-13: **Royal Douro — briefing corrigido** (`CLAUDE.md`, secção "Estilo Royal Douro"): editorial photography/film grain/35mm candid substitui a lista antiga de 7 ambientes de luxo CGI (iate, jato, F1, penthouse, Michelin, galeria, lounge charutos) do Branding.md/royal-douro.md — essa lista foi testada e abandonada (dezenas de tentativas em `Imagens_Geradas/Royal/_old/`). Rotação real = 3 conceitos: Pour, Jantar, Editorial. **royal-douro.md ainda não foi actualizado para reflectir isto** — quem gera Royal Douro tem de ler CLAUDE.md, não só o agente.
- 2026-07-03: **Discrepância Alkimia Rosé identificada** — a garrafa real (`Garrafas/Alkimia_Rose_Garrafa.png`) e a imagem já aprovada em produção (Junho) usam **estrelas de 5 pontas** no rótulo, não o padrão de "triângulos invertidos" que o Branding.md/alkimia.md descreve como universal. Não corrigido ainda — precedente aprovado (estrelas) tem prioridade sobre o texto até o Branding.md ser actualizado.
- 2026-07-03: **luisplanoredes.rfdev.pt criado** (1º site deste cliente na VPS Datalix) — DNS A via API Cloudflare + vhost Caddy estático, mesmo padrão de `leredes.rfdev.pt`/`cartastcg.rfdev.pt`. Ver `datalix-vps.md`.
- 2026-07-06: **Bio Instagram Alkimia** — entregues 3 opções de texto (tom AlkimiaRS.md, zero emojis; recomendada: "Alkimia Wine · Vinho Verde DOC / A transformação da natureza em elegância líquida. / Garrafa e lata, para cada momento."). Link recomendado = `alkimiawine.pt/links` (hub já existe). Renato ainda NÃO escolheu opção nem confirmou enriquecer o `links.html`.

## Pendente
- **Bio IG Alkimia:** Renato escolher opção de texto + decidir se enriquecer `links.html` (add Loja + páginas de produto ao hub, mantendo IG/FB/email). Se sim → editar `links.html` na cPanel (backup do original primeiro).
- Corrigir no PSD: Alkimia Rosé label ("VCRDE"→VERDE, "POOTUGAL"→PORTUGAL), Royal Douro Jantar (medalhão redondo garbled, "VIRHO"→VINHO no rótulo pequeno), Bracaris Rosé ("ROSE"→ROSÉ, falta acento).
- Fechar formatos finais no PSD (agy exporta abaixo de 1792×2400 nalguns casos; crop/upscale no Photoshop).
- Divine — marca ainda sem assets nem garrafa de referência.
- Limpar `Imagens_Geradas/Bracaris/1.png` (ficheiro perdido de Maio).

**Corrigido nesta sessão (2026-07-03), já não pendente:**
- `alkimia.md` — excepção Rosé (estrelas, não triângulos) documentada.
- `bracaris.md` — descrição literal da estrutura de cor do rótulo (painel sólido vs. outline) documentada, com a negativa explícita para o prompt.
- `royal-douro.md` — fundida a correcção de estilo do CLAUDE.md directamente no agente (editorial/3 conceitos Pour-Jantar-Editorial substitui a lista antiga de 7 ambientes de luxo CGI); secção "Rotação de ambientes" corrigida (o ciclo reinicia por design, não há esgotamento a gerir).

## Última sessão
2026-07-06 — Foco Alkimia. Verificado o "linktree": não há subdomínio `link.alkimiawine.pt`; o hub é a subpágina `alkimiawine.pt/links` (`links.html` na cPanel). Mapeada a infra web das marcas na conta cPanel `renatoferreira.org` (addon domains). Entregues 3 opções de bio IG (zero emojis) — pendente escolha do Renato + eventual enriquecimento do `links.html`.

2026-07-03 — Ciclo Julho 2026 gerado e publicado COMPLETO (8/8) em `luisplanoredes.rfdev.pt` (site novo, DNS+Caddy criados). Bloqueio de quota Gemini (429) travou Alkimia Rosé e Bracaris Rosé a meio da sessão — retomado após reset (14:31 UTC). Renato pediu redo do Royal Douro Editorial+Jantar (1ª versão com rótulo errado + visual CGI) — refeitas com mais realismo fotográfico. Micro-typos de label aceites em 2 imagens (Alkimia Rosé, Royal Jantar), sinalizados para correcção em PSD em vez de queimar mais quota a regenerar.
