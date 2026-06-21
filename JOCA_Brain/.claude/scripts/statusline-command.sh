#!/usr/bin/env bash
# Claude Code status line — token usage, model, context %, rate limits, last user message time

input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Unknown"')

used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
remaining_pct=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
input_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
output_tokens=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')

five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
week_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

make_bar() {
  local pct="${1:-0}"
  local filled=$(echo "$pct" | awk '{printf "%d", ($1 / 10 + 0.5)}')
  [ "$filled" -gt 10 ] && filled=10
  local empty=$((10 - filled))
  local bar=""
  for i in $(seq 1 "$filled"); do bar="${bar}█"; done
  for i in $(seq 1 "$empty");  do bar="${bar}░"; done
  printf "%s" "$bar"
}

fmt_time() {
  local epoch="$1"
  [ -z "$epoch" ] && echo "?" && return
  date -r "$epoch" "+%H:%M" 2>/dev/null || date -d "@$epoch" "+%H:%M" 2>/dev/null || echo "?"
}

time_remaining() {
  local epoch="$1"
  [ -z "$epoch" ] && echo "?" && return
  local now=$(date +%s)
  local diff=$(( epoch - now ))
  [ "$diff" -le 0 ] && echo "now" && return
  local d=$(( diff / 86400 ))
  local h=$(( (diff % 86400) / 3600 ))
  local m=$(( (diff % 3600) / 60 ))
  if [ "$d" -gt 0 ]; then
    printf "%dd%dh%02dm" "$d" "$h" "$m"
  else
    printf "%dh%02dm" "$h" "$m"
  fi
}

fmt_k() {
  echo "$1" | awk '{if($1>=1000) printf "%.1fk", $1/1000; else printf "%d", $1}'
}

last_user_msg_time() {
  local f="/tmp/claude_last_user_msg.txt"
  [ -f "$f" ] || return
  local hhmm=$(cat "$f" | tr -d '[:space:]')
  [ -z "$hhmm" ] && return
  printf '\033[0;32m🕐 %s\033[0m' "$hhmm"
}

out=""
out="${out}$(printf '\033[0;36m%s\033[0m' "$model")"

in_k=$(fmt_k "$input_tokens")
out_k=$(fmt_k "$output_tokens")
out="${out}  $(printf '\033[0;37min:%s out:%s\033[0m' "$in_k" "$out_k")"

if [ -n "$used_pct" ]; then
  bar=$(make_bar "$used_pct")
  used_int=$(printf "%.0f" "$used_pct")
  out="${out}  $(printf '\033[0;33mctx %s %s%%\033[0m' "$bar" "$used_int")"
fi

if [ -n "$five_pct" ]; then
  bar=$(make_bar "$five_pct")
  five_int=$(printf "%.0f" "$five_pct")
  reset_time=$(fmt_time "$five_reset")
  out="${out}  $(printf '\033[0;35m5h %s %s%% ↺%s\033[0m' "$bar" "$five_int" "$reset_time")"
fi

if [ -n "$week_pct" ]; then
  bar=$(make_bar "$week_pct")
  week_int=$(printf "%.0f" "$week_pct")
  remaining=$(time_remaining "$week_reset")
  out="${out}  $(printf '\033[0;34m7d %s %s%% ⏱ %s\033[0m' "$bar" "$week_int" "$remaining")"
fi

timer=$(last_user_msg_time)
[ -n "$timer" ] && out="${out}  ${timer}"

printf "%s" "$out"
