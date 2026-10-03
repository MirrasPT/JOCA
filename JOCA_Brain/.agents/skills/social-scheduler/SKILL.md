---
name: social-scheduler
description: Agendar e publicar posts em redes sociais via TryPost (MCP self-hosted, mcp__trypost__*). Executor do flow create→upload→attach→privacy→publish, com os gotchas por plataforma (TikTok privacy_level, joint-post re-list, ordem do carrossel). Distinto de content-calendar (planeamento) — esta skill EXECUTA. Triggers agendar post, publicar nas redes, schedule social, TryPost, carrossel Instagram, publicar TikTok, agendar campanha social.
triggers:
  - agendar post
  - publicar nas redes
  - schedule social post
  - trypost
  - carrossel instagram
  - publicar tiktok
  - agendar campanha social
chain: content-calendar
origin: local
---

# Social Scheduler — TryPost (MCP)

Executor de agendamento/publicação social via **TryPost** self-hosted (ex.: `trypost.<YOUR_DOMAIN>`, MCP `mcp__trypost__*`, OAuth, user scope). A skill `content-calendar` faz o *planeamento* (calendário, captions, rollout); esta faz a *execução*. Ver `memory/projects/<your-vps>/` (stack/creds TryPost).

## Pré-requisitos
- Lote de um mês: só se agenda depois de passar o gate de variedade da skill `content-calendar` (§Gate de variedade).
- Contas sociais ligadas: `mcp__trypost__list-social-accounts-tool` (confirmar `id` + estado de cada plataforma antes de publicar).
- Workspace: `mcp__trypost__get-workspace-tool`.

## Multi-marca / multi-tenant — o MCP é **workspace-scoped**

O MCP do TryPost vê **um** workspace de cada vez (o activo). Cada marca/cliente tem o seu, com as
**suas** contas sociais. **Não existe tool para trocar de workspace** — nem no `list-*` nem no
`update-*`.

1. **`get-workspace-tool` primeiro, sempre** — e **reconfirmar antes de CADA operação de escrita**
   (`create-post`, `update-post`, `publish-post`, `attach-media`), não só no arranque da sessão. Já
   se mediu o `current_workspace_id` a **mudar sozinho entre chamadas MCP** (de uma marca de cliente
   para outra, sem ninguém pedir). Com contas de clientes diferentes por workspace, um post pode aterrar **na
   marca errada** — irreversível assim que publica.
2. **Lista de contas vazia = tenant errado até prova em contrário.** Nunca reportar "as contas
   não estão ligadas" a partir de um `list-social-accounts` vazio ou com contas de outro projecto.
   Esta inversão já custou uma sessão inteira: o JOCA afirmou ao utilizador que as contas do cliente
   não estavam ligadas — estavam, noutro workspace — e só desbloqueou quando o utilizador disse "o
   mês passado foste tu que publicaste". Antes de declarar qualquer conta em falta: `get-workspace`,
   comparar com a marca pedida, e só depois concluir.
3. **A troca de workspace é operação de SERVIDOR, fora do MCP** — faz-se por tinker no backend do
   TryPost, na VPS (ver `memory/projects/<your-vps>/`). Não há caminho pelo MCP; procurar uma tool
   para isso é perder tempo. Sem acesso ao servidor → parar e reportar `TODO: workspace errado
   (<actual> ≠ <pretendido>), troca precisa de tinker na VPS`.
4. **`scheduled_at` é UTC.** Não assumir o fuso local (PT tem UTC+0/+1 conforme a época). Derivar o
   offset de posts anteriores **do mesmo workspace** (`list-posts` → comparar `scheduled_at` com a
   hora que aquele post realmente saiu) e só depois calcular.
5. **Verificar o resultado na BD, não só pela resposta da API.** Um `200` do MCP não prova estado
   persistido nem plataforma correcta — confirmar por `get-post` e, em caso de dúvida, na base de
   dados do TryPost na VPS.
6. **`Post not found` num `update-post` lê-se PRIMEIRO como scope errado**, só depois como post
   inexistente. A mensagem aponta para a segunda hipótese e leva ao diagnóstico errado: o post
   existe, está noutro workspace. Reflexo correcto → `get-workspace` antes de investigar o `id`.

## Flow canónico (post com média)

1. **Criar draft** — `create-post-tool` (texto + plataformas + `scheduled_at` se agendado).
2. **Pedir upload** — `request-media-upload-tool` → devolve URL/credenciais de upload.
3. **Upload do ficheiro** — `curl` para a URL devolvida (o MCP não faz o upload do binário).
4. **Anexar** — `attach-media-from-upload-tool` (ou `attach-media-from-url-tool` se a média já está num URL público).
5. **Privacy/meta** — `update-post-tool` com os campos por plataforma (ver gotchas).
6. **Publicar/confirmar** — `publish-post-tool` (imediato) ou deixar agendado; `get-post-tool` p/ estado, `get-post-metrics-tool` p/ métricas.

## Gotchas (vividos — não inferir)
- **TikTok exige `meta.privacy_level`** no `update-post`/`create-post` senão a publicação falha. (Sandbox: agenda mas pode **não publicar realmente** — verificar com `get-post`.)
- **Integração com aprovação da plataforma (TikTok e afins): listar TODAS as aprovações do caminho até ao efeito final (post público) a partir da doc oficial, antes de dizer «falta só X».** No TikTok faltavam 2 passos que a memória não tinha: os scopes pedidos pelo cliente (TryPost) têm de casar com os aprovados, e há uma **2.ª aprovação** (auditoria do Direct Post) depois da primeira (2026-09-21). Um plano montado sem ler a doc do «depois da aprovação» promete uma data que não existe.
- **Joint post (multi-plataforma):** o `update-post-tool` tem de **re-listar TODAS as plataformas** sempre — omitir uma **desactiva-a** (não é merge, é replace).
- **Carrossel (Instagram):** anexar múltiplas médias ao MESMO post; a **capa** vai num passo de attach isolado primeiro (a ordem do attach = ordem do carrossel).
- **`list-posts-tool` grande estoura tokens** → escrever a resposta para ficheiro e ler com `jq`, não inline.
- **Anti-fabricação:** nunca inventar `account_id`/`media_id` — obter sempre de `list-social-accounts`/`request-media-upload`. Sem conta ligada para uma plataforma → reportar `TODO: conta <plat> não ligada`, não publicar às cegas.

## Outras ops
- Labels: `list-labels-tool`, `create-label-tool`, `update-label-tool`, `delete-label-tool`.
- Assinaturas: `list-signatures-tool`, `create-signature-tool`.
- Tipos de conteúdo: `list-content-types-tool`.
- API keys: `list-api-keys-tool`, `create-api-key-tool`.

## Chain
`content-calendar` — planeamento que alimenta esta execução. Para gerar a criatividade antes de agendar: `social-content` / `img-gen` → esta skill publica.
