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

Executor de agendamento/publicação social via **TryPost** self-hosted (LIVE no teu domínio configurado, MCP `mcp__trypost__*`, OAuth, user scope). A skill `content-calendar` faz o *planeamento* (calendário, captions, rollout); esta faz a *execução*. Ver o teu ficheiro de projecto VPS (`/init-project`) para stack/credenciais.

## Pré-requisitos
- Contas sociais ligadas: `mcp__trypost__list-social-accounts-tool` (confirmar `id` + estado de cada plataforma antes de publicar).
- Workspace: `mcp__trypost__get-workspace-tool`.

## Flow canónico (post com média)

1. **Criar draft** — `create-post-tool` (texto + plataformas + `scheduled_at` se agendado).
2. **Pedir upload** — `request-media-upload-tool` → devolve URL/credenciais de upload.
3. **Upload do ficheiro** — `curl` para a URL devolvida (o MCP não faz o upload do binário).
4. **Anexar** — `attach-media-from-upload-tool` (ou `attach-media-from-url-tool` se a média já está num URL público).
5. **Privacy/meta** — `update-post-tool` com os campos por plataforma (ver gotchas).
6. **Publicar/confirmar** — `publish-post-tool` (imediato) ou deixar agendado; `get-post-tool` p/ estado, `get-post-metrics-tool` p/ métricas.

## Gotchas (vividos — não inferir)
- **TikTok exige `meta.privacy_level`** no `update-post`/`create-post` senão a publicação falha. (Sandbox: agenda mas pode **não publicar realmente** — verificar com `get-post`.)
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
