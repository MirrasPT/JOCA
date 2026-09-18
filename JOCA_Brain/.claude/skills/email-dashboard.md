---
name: email-dashboard
description: "Reads the Gmail inbox (read-only) and delivers a local HTML dashboard, opened in the browser, with the emails triaged into Action / Waiting on / FYI / Noise. MUST be invoked when the user says: email-dashboard, check my email, look at my mailbox, email dashboard, inbox dashboard, what's in my email. SHOULD also invoke when: the user asks for an email status checkpoint at the start of the day, or asks what is still unanswered and wants the result in a file rather than as text in the chat."
triggers: email-dashboard, check my email, email dashboard, inbox dashboard, what's in my email, email status checkpoint, what is still unanswered
chain: personal-comms, new-issue
allowed-tools: Bash, Read, Write, ToolSearch, mcp__claude_ai_Gmail__search_threads, mcp__claude_ai_Gmail__get_thread, mcp__claude_ai_Gmail__list_labels
metadata:
  category: productivity
  origin: user
---

# Email Dashboard

A closed cycle, always the same: **read the inbox (read-only) → triage → write a local `.html` → open it in the browser**. It never marks as read, never archives, never sends, never replies.

## When to use it

- "check my email" / "what's in my inbox" / morning status checkpoint.
- After a day without opening the mail, to find out what requires action.

Do not use it for: **sending/replying to email, creating events, managing the calendar, or a short summary as text in the chat only** → `personal-comms`. The signal that separates the two: if the request implies a file/visual dashboard to reopen later, it is this skill; if it is just "tell me quickly", it is `personal-comms`.

## Step 1 — The reading tool (never assume it is loaded)

The Gmail tools are **deferred** in this environment: load all of them in a single call before using any of them.

```
ToolSearch query="select:mcp__claude_ai_Gmail__search_threads,mcp__claude_ai_Gmail__get_thread,mcp__claude_ai_Gmail__list_labels" max_results=3
```

It did not return the 3 tools → run the `personal-comms` discovery (Step 1 of that skill: `claude mcp list`, config, CLIs). Still no reading tool → write `TODO: email tool not connected`, report it and **stop**. Never improvise IMAP/curl, never invent credentials.

## Step 2 — Window and state

Persistent state in `~/Relatorios/email-dashboard/estado.json` (`{"ultima_corrida":"ISO8601"}`).

1. Read the state. It exists and is valid JSON → window = since `ultima_corrida`. It does not exist, or the JSON does not parse → window = `newer_than:2d` (treat it as an initial run, do not stall).
2. The user gives an explicit window ("today", "this week") → that always overrides the state.
3. Translate it to Gmail syntax, never natural language: `in:inbox newer_than:2d -in:draft`.

## Step 3 — Fetch (cheap first)

```
search_threads(query="in:inbox newer_than:2d -in:draft", pageSize=50, view="THREAD_VIEW_MINIMAL")
```

- `THREAD_VIEW_MINIMAL` already brings `subject`, `snippet`, `sender`, `date`, `label_ids` — enough to triage. **Do not open bodies by default.**
- A `{}` response = **zero results, not an error** → render the empty state from Step 6, never invent rows.
- `label:` accepts **IDs**, not visible names → `list_labels()` first if the user filters by label.
- Need detail from the body (a proposal, a value, a deadline)? `get_thread(threadId, messageFormat="PLAIN_TEXT")` **only** for Action candidates, a maximum of **8 threads** per run. `FULL_CONTENT` exhausts the context — never use it.
- A **hard tool error** (expired auth, rate limit, 5xx) is different from `{}`: do not repeat the call more than once, write `TODO: email read failed (<error>)`, report it and **stop** — never render a partial dashboard that reads as an empty inbox.
- The real maximum `pageSize` = 50. More than 50 threads in the window → paginate with `pageToken`, a maximum of **2 extra pages**; after that the dashboard says "window truncated at N threads" instead of paginating further.

## Step 4 — Triage (4 buckets, one per thread)

| Bucket | Rule |
|---|---|
| **Action** | A direct question to the user, a request, a deadline, an invoice/payment, a client waiting |
| **Waiting on** | The last message in the thread is the user's own **and it asked for a reply** → the ball is in the other person's court. A forward or a copy to himself with no question → **FYI**, not here |
| **FYI** | Genuinely informative (team, platform, deliveries) with no action requested |
| **Noise** | Newsletters, marketing, `category:promotions`/`social`, automatic notifications |

Per thread, store: `sender`, `subject`, `date`, `threadId`, `snippet` (max. 160 characters), bucket, and a **suggested action in 1 line** (Action only).

Mark the project on the card when the sender/subject matches a project in the inventory — the canonical list is `memory/INDEX.md` §Projects (`~/CLAUDE.md` holds names only); **never** keep a copy of clients inside this skill, which rots silently. No match → no label, **never guess the project**.

## Step 5 — Content rules (non-negotiable)

- **Zero fabrication**: every card comes from a real tool response — no estimated count, no plausible sender.
- **Secrets do not go into the HTML**: 2FA/OTP codes, passwords, tokens, reset links → the card writes `[code omitted]`. The file sits on disk and can be reopened by anyone.
- **Absolutely read-only**: `label_*`, `trash_*`, `mark_*`, `send_*`, `reply`, `create_draft` are forbidden. The user asks for an action from a card → `personal-comms`, with confirmation if it is a send.

## Step 6 — HTML dashboard

File: `~/Relatorios/email-dashboard/YYYY-MM-DD-HHMM.html` (`mkdir -p` first). **Timestamp in the name — never write over a previous dashboard.**

Minimum content:
- Header: date/time of the run + the window covered in words ("since 2026-09-02 09:14") + 4 counters.
- 4 sections in the order **Action → Waiting on → FYI → Noise** (Noise collapsed into a `<details>`, count + senders only).
- Card: sender · subject · relative date · project (if any) · snippet · suggested action · link `https://mail.google.com/mail/u/0/#inbox/<threadId>` with `target="_blank"`.
- Explicit empty state: "Nothing new in window X" — never a blank page.

Build rules:
- **Self-contained HTML**: CSS inline in `<style>`, zero CDN, zero fetch. It opens offline and a year from now.
- Light/dark via `prefers-color-scheme`, both with an explicit background and color.
- English throughout the interface.
- No `Artifact()` — the output is always local.

Verification before reporting: `test -f <path>` returns success. Only then:
```bash
open ~/Relatorios/email-dashboard/<file>.html      # macOS
# Windows: start "" "%USERPROFILE%\Relatorios\email-dashboard\<file>.html"
```
Write `estado.json` with the time of this run **only after** the file exists on disk — if the dashboard fails halfway, the next run repeats the window instead of losing emails.

## Step 7 — Reply in the terminal

Maximum 4 lines: the counts of the 4 buckets, the 2-3 most urgent actionable items, the path to the file. The detail is in the dashboard — do not repeat the whole list in the chat.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Context exhausted halfway | `get_thread` with `FULL_CONTENT` or across too many threads | `PLAIN_TEXT`, maximum 8 threads |
| `label:Clientes` returns nothing | `label:` wants the **ID**, not the name | `list_labels()` and use the `id` |
| Already-triaged threads come back | `estado.json` was not written at the end of the previous run | Always write the state, even on an empty window |
| `estado.json` exists but does not open | Corrupted JSON (the previous run was interrupted) | Treat it as non-existent, `newer_than:2d`, overwrite it at the end |
| An archived thread appears in the inbox | Gmail returns the whole thread if **one** message matches | Filter by `label_ids` containing `INBOX` |
| The card's link opens the wrong account | `u/0` is the index of the Google profile in the browser, not fixed | Swap it for `u/?authuser=<email>` |
| The previous dashboard vanished | File written with a fixed name | Timestamp in the name, always |

## Next step (chain)

- `personal-comms` — the user wants to reply/send/book a meeting from a card. **Sending is irreversible** → draft + 1 line of confirmation first.
- `new-issue` — an actionable email is work for a project with a known repo. Reversible → open the issue without asking, and say which one.
