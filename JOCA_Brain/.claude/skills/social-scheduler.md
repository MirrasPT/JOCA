---
name: social-scheduler
description: Schedule and publish social media posts via TryPost (self-hosted MCP, mcp__trypost__*). Executor of the create→upload→attach→privacy→publish flow, with the per-platform gotchas (TikTok privacy_level, joint-post re-list, carousel order). Distinct from content-calendar (planning) — this skill EXECUTES. Triggers schedule post, publish to social, schedule social, TryPost, Instagram carousel, publish TikTok, schedule social campaign.
triggers:
  - schedule post
  - publish to social
  - schedule social post
  - trypost
  - instagram carousel
  - publish tiktok
  - schedule social campaign
chain: content-calendar
origin: local
---

# Social Scheduler — TryPost (MCP)

Executor for social scheduling/publishing via self-hosted **TryPost** (e.g. `trypost.<YOUR_DOMAIN>`, MCP `mcp__trypost__*`, OAuth, user scope). The `content-calendar` skill does the *planning* (calendar, captions, rollout); this one does the *execution*. See `memory/projects/<your-vps>.md` (TryPost stack/creds).

## Prerequisites
- Connected social accounts: `mcp__trypost__list-social-accounts-tool` (confirm each platform's `id` + state before publishing).
- Workspace: `mcp__trypost__get-workspace-tool`.

## Canonical flow (post with media)

1. **Create draft** — `create-post-tool` (text + platforms + `scheduled_at` if scheduled).
2. **Request upload** — `request-media-upload-tool` → returns the upload URL/credentials.
3. **Upload the file** — `curl` to the returned URL (the MCP does not upload the binary).
4. **Attach** — `attach-media-from-upload-tool` (or `attach-media-from-url-tool` if the media is already at a public URL).
5. **Privacy/meta** — `update-post-tool` with the per-platform fields (see gotchas).
6. **Publish/confirm** — `publish-post-tool` (immediate) or leave it scheduled; `get-post-tool` for state, `get-post-metrics-tool` for metrics.

## Gotchas (lived — do not infer)
- **TikTok requires `meta.privacy_level`** in `update-post`/`create-post` or publishing fails. (Sandbox: it schedules but may **not actually publish** — check with `get-post`.)
- **Joint post (multi-platform):** `update-post-tool` must **re-list ALL platforms** every time — omitting one **deactivates it** (it is not a merge, it is a replace).
- **Carousel (Instagram):** attach several media to the SAME post; the **cover** goes in an isolated attach step first (attach order = carousel order).
- **A large `list-posts-tool` blows up tokens** → write the response to a file and read it with `jq`, not inline.
- **Anti-fabrication:** never invent an `account_id`/`media_id` — always get them from `list-social-accounts`/`request-media-upload`. No account connected for a platform → report `TODO: <plat> account not connected`, do not publish blindly.

## Other ops
- Labels: `list-labels-tool`, `create-label-tool`, `update-label-tool`, `delete-label-tool`.
- Signatures: `list-signatures-tool`, `create-signature-tool`.
- Content types: `list-content-types-tool`.
- API keys: `list-api-keys-tool`, `create-api-key-tool`.

## Chain
`content-calendar` — the planning that feeds this execution. To generate the creative before scheduling: `social-content` / `img-gen` → this skill publishes.
