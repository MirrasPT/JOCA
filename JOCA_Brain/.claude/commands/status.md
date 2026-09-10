# /status — Show Claude Code limits and resource usage

Presents JOCA's current state of rate limits, context and model in use.

## Steps

### 1. Locate the limits file
Read the `rate-limits.json` file located in the operating system's temporary directory:
- macOS/Linux: the `os.tmpdir()/joca-ui/rate-limits.json` directory (usually `/tmp/joca-ui/rate-limits.json` or under `/var/folders/`)
- Windows: `%TEMP%\joca-ui\rate-limits.json`

If the file does not exist or cannot be read, show the message:
"Error: Limits file not found. Make sure the statusline is active or run `/install`."

### 2. Format and present
Present a clean, compact table with 10-character progress bars (`█` and `░`):

```
STATUS JOCA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model: <model>
Context: in: <input_tokens> | out: <output_tokens>
  Bar: [<bar>] <used_pct>%

Message limits:
  5 hours:    [<bar>] <used_pct>%  (resets in: <time>)
  7 days:     [<bar>] <used_pct>%  (resets in: <time>)
  Sonnet 7d:  [<bar>] <used_pct>%  (resets in: <time>)

Updated: <local date/time or time elapsed since updated_at>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Calculate the time remaining until the reset based on `resets_at` (epoch timestamp in seconds) against the current time. If there is no `resets_at` or it is null, omit the `(resets in: ...)` section or show `(reset: ?)`.
