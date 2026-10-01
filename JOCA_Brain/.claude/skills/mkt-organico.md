---
name: mkt-organico
description: "F4 do marketeer para publicações orgânicas (Facebook, Instagram, LinkedIn): calendário, formatos e legendas a partir das artes aprovadas, montados como rascunhos no TryPost (MCP) quando existe — nunca agendados nem publicados sem aprovação — ou exportados para publicação manual. MUST be invoked when the user says: publicações orgânicas, calendário de publicações da marca, F4 orgânico, agendar posts da campanha, organic social posts. SHOULD also invoke when: rascunhos no TryPost, legendas por plataforma, carrossel Instagram da campanha, posts LinkedIn da empresa, métricas dos posts para a review."
triggers: orgânico, publicações orgânicas, posts orgânicos, calendário de publicações, calendario editorial, rascunhos trypost, trypost, agendar posts, legendas, carrossel instagram, reels orgânicos, post linkedin empresa, facebook página, organic social, F4 orgânico
chain: mkt-revisor-agent, marketeer, marketeer-review
---
# mkt-organico

Fase F4 (e leitura na F5) para redes sociais orgânicas da marca. Transforma as peças aprovadas na F3
num calendário com legenda por plataforma e monta-as como **rascunhos** no TryPost (se o MCP estiver
presente) ou num ficheiro para publicação manual. Agendar no TryPost **é** publicar (sai sozinho à
hora marcada) → só com aprovação explícita.

## Recebe
- `ciclos/<ciclo>/02-proposta.md` aprovado — pilares, cadência, plataformas, temas.
- `ciclos/<ciclo>/03-artes/` aprovado — finais e briefs (formato, copy, CTA).
- Plano de medição: `02-proposta.md` §Medição (secção da `mkt-medicao`: folha de UTMs, conversões, gate de medição) + `<MKT>/referencias/utm.md`.
- `marca.md` (§Voz, §Público, §Zona — fuso) · `conectores.md` (canais `facebook`, `instagram`, `linkedin`, `trypost`).
- `<MKT>/referencias/plataformas.md` §Orgânico.

## Entrega
- Secção `## organico` em `ciclos/<ciclo>/04-implementacao.md`, com o calendário (tabela do passo 3).
- Rascunhos no TryPost (IDs registados) ou o mesmo calendário para publicação manual.
- Data de revisão **proposta** (canal `facebook`/`instagram`/`linkedin`/`trypost`, data, motivo) devolvida ao `marketeer`, que a regista na F4 (CONTRATO §3).

## Passos

### 1. Pré-condições
- Gate de medição de `02-proposta.md` §Medição: a G6 (UTMs da folha válidos) ✓ — é a que mede o orgânico; as outras aplicam-se se o post levar a uma conversão no site.
  **Modo agente:** aceitas a tabela de `ciclos/<ciclo>/04-implementacao.md` §Gate de medição que vem no brief (data deste
  ciclo, sem ✗) e repetes só a G6 (e G1, G2, G4 se o post levar a uma conversão no site); não perguntas os manuais.
  **Inline, sem tabela:** corres essas provas tu.
- Artes aprovadas (`estado.json` → `aprovacoes.artes`). Peça sem aprovação não entra.
- UTMs: links clicáveis (LinkedIn, Facebook) levam o URL da folha de UTMs (`utm_medium=social`; link da bio com `utm_content=bio` — `referencias/utm.md` §2). Validar com o comando de `utm.md` §5.
- Fuso: `Europe/Lisbon` salvo `marca.md` dizer outro.

### 2. Calendário
Se a skill JOCA `content-calendar` existir (`ls` antes), usa-a para a grelha (slots por plataforma, cadência, mapeamento peça → slot, fuso IANA). Sem ela, tabela simples. Cadência = a da proposta; horários = os que a marca já usa ou os que os próprios dados da conta mostram (insights), nunca «melhores horas» genéricas sem fonte.

### 3. Legenda e formato por plataforma
| Data/hora (Lisboa) | Rede | Formato | Peça (03-artes/finais) | Legenda (car.) | Hashtags | Link/CTA com UTM | Estado | ID TryPost |
Regras:
- Instagram: foto até 1080 px de largura, rácio entre 1,91:1 e 4:5 (fora disso corta — IG-IMG, verificado 2026-10-01); até 30 hashtags por publicação (IG-TAG) — usar poucas e relevantes; carrossel: a capa é a 1.ª média; legenda máx. `[por confirmar]`.
- LinkedIn: publicação até 3000 car. (LI-POST, verificado 2026-10-01); a primeira linha tem de valer sozinha.
- Facebook: limite de texto `[por confirmar]`; legenda curta + link com UTM.
- Reels/vídeo vertical: zonas seguras como nos anúncios (`plataformas.md`) — texto fora das bandas de UI.
- Uma ideia por publicação; voz da marca (`marca.md` §Voz); números só dos factos aprovados; texto por `stop-slop` → `pt-pt-translator` (JOCA, se existir).
- A mesma peça em várias redes → legenda adaptada a cada uma, não copiada.

### 4. Via TryPost (MCP `mcp__trypost__*`, se presente)
Detalhe operacional e armadilhas: skill JOCA `social-scheduler` (ler antes, se existir).
1. `list-social-accounts-tool` → IDs reais das contas da **marca certa** (confirma o nome da conta com o operador; em modo agente, conta por confirmar → não crias rascunhos nessa rede e a pergunta vai para a lista `[por confirmar]`). Conta não ligada → `TODO: conta <rede> não ligada`, essa rede vai para a via manual.
2. `list-content-types-tool` → `content_type` válido por rede (nunca inventado).
3. `create-post-tool` cria **rascunho** (texto, contas, `content_type`, `meta.aspect_ratio` para IG/FB). Não passar estado agendado.
4. Média: `request-media-upload-tool` → `curl` do ficheiro para o URL devolvido → `attach-media-from-upload-tool` (ordem dos anexos = ordem do carrossel; capa primeiro).
5. `get-post-tool` / `preview-post-tool` → confirmar texto, média e redes.
6. Multi-rede: qualquer `update-post-tool` re-lista **todas** as redes (a que faltar fica desligada).
**Proibido sem gate**: `update-post-tool` com `status: "scheduled"` e `publish-post-tool`.

### 5. Ensaio, custo e aprovação
- Ensaio = calendário completo + pré-visualização de cada rascunho (ou das peças, na via manual).
- Custo: **0 €/dia · 0 €/mês** de media paga; custo da ferramenta (plano TryPost/outra), só se existir e com fonte, também em `<P ÷ 30,4> €/dia · <P> €/mês`.
- Em modo agente não perguntas nem crias rascunhos: devolves o calendário + o custo; o `marketeer` pergunta (F4.4) e reenvia a ordem de criar.
- `AskUserQuestion` Sim/Não «Sim, criar os rascunhos» (reversível: apagam-se).
- Agendar = publicar: gate separado, com a lista de publicações (data/hora, rede, texto inteiro, peça) e «Sim, agendar estas N publicações» / «Não». Um «sim» cobre só a lista mostrada.

### 6. Via manual
Sem TryPost: o calendário do passo 3 + pasta de finais é o entregável; o dono publica. Registar depois a data real e o link de cada publicação.

### 7. Checklist
- [ ] Só peças aprovadas; legenda revista (voz, factos, PT-PT).
- [ ] Rácios e zonas seguras confirmados no ficheiro medido.
- [ ] Links com UTM e a responder 200.
- [ ] Contas certas (marca certa) e `content_type` válidos.
- [ ] Rascunhos confirmados por `get-post-tool`; nada agendado sem o segundo «sim».

### 8. Registo e data de revisão
Secção para `ciclos/<ciclo>/04-implementacao.md` (inline escreves; em modo agente devolve-la ao `marketeer`, que junta):
```markdown
## organico
<tabela do passo 3, com Estado = rascunho | agendado (com aprovação de <data>) | publicado + link>
Custo: 0 €/dia · 0 €/mês de media paga (+ ferramenta: <€/dia · €/mês, fonte> ou «nenhuma»)
Revisão: <data> — <motivo> · O que tornaria isto um erro: <ex.: alcance abaixo da mediana das últimas 10 publicações da conta>
```
Data de revisão **proposta**: última publicação do calendário + 7 dias (ou fim do mês do ciclo).
Esta skill **não** corre `estado.mjs revisao` nem propõe eventos de calendário: devolve `<facebook|instagram|linkedin|trypost>
· <AAAA-MM-DD> · <motivo>` (um canal por linha) e o `marketeer` regista-a (F4.6) e oferece o lembrete (F4.7) — CONTRATO §3.

### 9. Modo leitura (F5)
- TryPost: `get-post-metrics-tool` por publicação (gravar a resposta em ficheiro se for grande; ler com `jq`).
- Sem TryPost: insights nativos (Meta Business Suite, LinkedIn Página → Análise) exportados pelo dono, com período.
- Métricas: alcance, impressões, interações (gostos, comentários, partilhas, guardados), cliques no link, visualizações de vídeo; comparar com a mediana das publicações anteriores da própria conta, não com médias externas. Cliques e conversões do site pelo UTM no GA4. Sem dado → «sem dado», nunca 0.

## Próximo passo (chain)
- Calendário e legendas → `mkt-revisor-agent`.
- Rascunhos criados e registados → `marketeer`.
- Data de revisão → `marketeer-review`.

## Créditos
Adaptado (MIT) de:
- coreyhaines31/marketingskills — `skills/social/SKILL.md` (uma ideia por post, adaptação por rede, rever com dados da própria conta) e `skills/ad-creative/references/short-form-video-specs.md` (zonas seguras).
- anthropics/knowledge-work-plugins — `small-business/skills/social-content-engine` via relatório A (staging, nunca publicar sem aprovação).
