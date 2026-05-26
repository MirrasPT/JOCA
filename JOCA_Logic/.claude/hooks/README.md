# JOCA Hooks — Autonomous Test Pipeline

Three-layer architecture for automatic test triggering after code changes.

## Layer 1: PostToolUse → Track Changes
`track-changes.sh` appends modified files to `.joca/test-queue.jsonl` with domain classification.

## Layer 2: Stop → Dispatch Tests  
`auto-test-dispatch.sh` reads the queue and outputs test recommendations before Claude stops.

## Layer 3: Git Pre-commit (optional)
Fast lint/type-check only. Feeds errors back to Claude's feedback loop for auto-fix.

## Installation

Add to your project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": { "tool_name": "Write|Edit" },
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/track-changes.sh \"$TOOL_INPUT_FILE_PATH\"" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/auto-test-dispatch.sh" }]
      }
    ]
  }
}
```

## How It Works

1. Every Write/Edit → file path logged to `.joca/test-queue.jsonl`
2. When Claude is about to stop → queue is read, tests recommended
3. Claude reads the recommendation and dispatches tester agents autonomously
4. Queue is cleared after each Stop event

No user input required. Zero confirmations.
