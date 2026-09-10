---
name: personal-comms
description: "Read, summarize and send email + manage the calendar via MCP/CLI ALREADY CONNECTED (no custom API). MUST be invoked when the user says: read email, summarize inbox, send email, reply to email, book a meeting, create event, agenda, calendar, upcoming events, reminder, personal-comms, personal communication assistant."
metadata:
  version: 1.0.0
  origin: local
---

# Personal Comms

Skill of the `personal-comms` agent (FUTUROS Phase 2/3). Reads, summarizes and sends email; reads and manages the calendar. ALWAYS uses tools that are already connected (MCP or CLI) — it never builds a custom API/client, never calls a provider over raw HTTP.

## Nuclear Principle — Discover, Do Not Assume

There is no guaranteed fixed email/calendar tool in this environment. Do NOT assume Gmail, Outlook, Google Calendar, nor a specific MCP name. First step of ANY task: discover what is effectively connected.

### Anti-fabrication (strong — inherits soul.md Hard Limits)
- NEVER invent credentials, endpoints, tokens, account IDs, MCP or tool names.
- No email/calendar tool connected -> do NOT improvise with curl/SMTP/IMAP nor ask for the key inline. Leave `TODO: email/calendar tool not connected` and REPORT to the supervisor/user.
- Uncertain detail (the tool's response format, date field, timezone) -> say so, do not guess.
- This brief also holds when this agent is spawned: sub-agents do not inherit soul.md, only the brief.

---

## Step 1 — Tool Discovery

Order of checks. Stop at the first one that matches.

1. **MCP tools loaded in the session** — look them up by name/keyword via `ToolSearch`:
   ```
   ToolSearch query="email send read inbox"     max_results=8
   ToolSearch query="calendar event schedule"   max_results=8
   ToolSearch query="gmail outlook imap smtp"    max_results=8
   ```
   MCP tools show up as `mcp__<server>__<action>`. They are only callable after the schema comes back from `ToolSearch` (deferred tools). Confirm the schema before invoking.

2. **Configured MCPs (even if not exposed to the loop)** — inspect the config without reading secrets:
   - User scope: `~/.claude.json` / `~/.claude/` (look for the `mcpServers` block).
   - Project: `.mcp.json` / `.claude/settings.json` at the project root.
   - List via CLI: `claude mcp list` (shows connected servers).
   If there is an email/calendar server configured but not exposed to the main loop, see "Browser/MCP outside the loop" below.

3. **CLI on the PATH** — check which communication binaries are installed, e.g.:
   ```bash
   for c in gam gcalcli himalaya mutt msmtp khal vdirsyncer; do command -v "$c" && echo "found: $c"; done
   ```
   (Illustrative list — confirm what exists, do not assume any of them is there.)

4. **Nothing found** -> `TODO: email/calendar tool not connected` + report. Do NOT continue.

> Windows: use `python` (not `python3` — the empty Microsoft Store stub). In PowerShell, `command -v` does not exist -> use `Get-Command <name> -ErrorAction SilentlyContinue`.

### Check the tool against a real response (api-design.md)
Before trusting the output parsing (dates, sender, event ID), make 1 real read-only call and inspect the effective shape. Do not infer the format — `tsc`/build do not catch a date field that is always `null`.

---

## Step 2 — Inbox Summary

When there is an email-reading tool connected.

### Pattern
1. Read-only fetch of the requested period (default: unread from the last 24h; confirm if ambiguous).
2. Group by: **Action required** / **FYI** / **Noise** (newsletters, automated).
3. Per actionable email, 1 line: `[sender] subject -> suggested action`.
4. Never paste the whole body — summarize. Critical identifiers (exact sender, message ID, link) verbatim.
5. Finish with a count: `N actionable, M FYI, K noise`.

### Output format
```
ACTIONABLE
- [Client X] Quote proposal  -> reply by Friday
- [Bank]     Payment failed  -> check the method

FYI
- [Newsletter Y] weekly digest

3 actionable, 1 FYI, 12 noise
```

### Reading guardrails
- Read-only by default. Mark as read / archive / delete = an action with effect -> confirm 1 line first (GUARD).
- Do not expose sensitive content (2FA codes, passwords in emails) in shareable summaries.

---

## Step 3 — Send / Reply to Email

An action with an external effect, frequently irreversible -> GUARD.

1. **Draft first.** Show the recipient(s), subject and body to the user.
2. Confirm 1 line before sending (`send? y/n`). Without confirmation -> do not send.
3. Only send via the discovered tool. No sending tool -> `TODO` + report; do NOT fall back to raw SMTP.
4. Replies: preserve the thread/`In-Reply-To` if the tool supports it; do not invent headers.
5. Default tone: aligned to the user (pt-pt, terse, professional) unless instructed otherwise.

---

## Step 4 — Event Detection

Extract appointments from email/text to suggest calendar entries.

- Signals: date + time + a meeting verb ("meeting", "call", "lunch", "deadline", "at 3pm", "on the 3rd").
- Structured output, NEVER create an event without confirming:
  ```
  Event detected:
    title:  Call with Client X
    when:   2026-06-25 15:00 Europe/Lisbon
    source: email [Client X] "Proposal"
  Create it in the calendar? y/n
  ```
- Timezone: assume `Europe/Lisbon` unless told otherwise; if the source is ambiguous, say so, do not guess.
- Relative dates ("tomorrow", "next Friday") -> resolve them against the environment's current date, show the resolved absolute date.

---

## Step 5 — Manage the Calendar

When there is a calendar tool connected.

- **Read the agenda**: "upcoming events" -> list the requested window (default: today + 7 days). 1 line per event: `date time - title (place/link)`.
- **Create an event**: draft -> confirm -> create via the tool. Minimum fields: title, start, end/duration, timezone. Guests/place only if asked for.
- **Conflicts**: when creating, check for overlap in the window; if there is one, warn before creating.
- **Edit/cancel**: an action with effect -> confirm; use the real event ID returned by the tool (never invent an ID).

---

## Reminders

JOCA has no guaranteed scheduler of its own. For reminders:
1. Prefer the calendar tool's native capability (the event's notification/alert) — it is the reliable path.
2. Recurring scheduling on the agent side -> only if a cron/schedule mechanism confirmed in the environment exists (e.g. `/schedule`, `/loop`). Confirm it exists before promising; otherwise `TODO` + report.
3. Never promise a reminder that no connected tool can fire.

---

## Browser/MCP outside the main loop (workflows-and-tooling.md)
A configured MCP may not be exposed to the main loop — only to sub-agents. If the config shows an email/calendar server but no tool shows up in the loop's `ToolSearch`, delegate the action to a sub-agent that has the MCP, with a brief that carries: objective, anti-fabrication, confirm before actions with effect. Do not assume the tool is available inline.

---

## Anti-patterns

| Wrong | Right |
|--------|----------|
| Assuming Gmail/Outlook/Google Calendar is connected | Discover via `ToolSearch` + `claude mcp list` + config |
| Building a custom IMAP/SMTP/REST client | Only an MCP/CLI tool already connected |
| Inventing a missing key/endpoint/account ID | `TODO: tool not connected` + report |
| Sending email without confirming | Draft -> confirm 1 line -> send |
| Creating an event straight from the email | Detect -> show -> confirm -> create |
| Inferring the shape of the tool's output | 1 real read-only call + validate the fields |
| Inventing an event ID to edit | Use the real ID returned by the tool |
| Promising a reminder with no mechanism | Use the calendar alert or `TODO` + report |
| `python3` on Windows | `python` |

---

## Downloading email ATTACHMENTS (the Gmail MCP does not download them)

`mcp__claude_ai_Gmail__*` **reads** attachment metadata (`filename`, `mimeType`, `attachmentIds`)
but **has no tool to save them to disk**. Do not improvise nor ask the user to download
them by hand — the way is the `gws` CLI, and the payload comes in **base64url**, not in bytes:

```bash
# 1. get messageId + attachment id  -> mcp__claude_ai_Gmail__get_thread (messageFormat: PLAIN_TEXT)
# 2. pull the attachment (the attachment id is ~700 chars; use a variable, never inline)
gws gmail users messages attachments get \
  --params "{\"userId\":\"me\",\"messageId\":\"$MSG\",\"id\":\"$ATT\"}" > att.json
# 3. decode base64url (macOS's `base64 -d` does NOT accept -_ nor missing padding)
python3 -c "import json,base64,pathlib;d=json.load(open('att.json'))['data'];\
pathlib.Path('output.pdf').write_bytes(base64.urlsafe_b64decode(d+'='*(-len(d)%4)))"
```

Always verify by **effect**: `head -c4` of the file has to give `%PDF` (or the magic of the type),
it is not enough that the JSON came back with bytes. `gws` writes `Using keyring backend: keyring` to **stderr**
— it is not an error; redirect stderr or the file gets corrupted if you capture `2>&1`.

⚠ A bank/finance PDF usually comes **encrypted** (`pdftotext` returns `Incorrect password`).
The password is a convention of the issuer (at Cetelem: year of birth + last 4 digits of the NIF) and
lives in the project's memory, never here.

---

## Pre-action checklist
- [ ] Email/calendar tool CONFIRMED connected (ToolSearch / `claude mcp list` / config)
- [ ] MCP tool schema loaded before invoking
- [ ] Parsing validated against 1 real response
- [ ] Actions with effect (send/create/edit/delete) -> draft + confirmation
- [ ] Zero invented credentials/endpoints/IDs
- [ ] Explicit timezone (Europe/Lisbon default) and relative dates resolved
- [ ] No tool -> `TODO` + reported, NOT improvised
- [ ] Attachments: downloaded via `gws` + base64url, and verified by the file's magic
