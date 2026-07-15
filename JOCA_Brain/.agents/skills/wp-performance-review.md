---
name: wp-performance-review
description: "WordPress performance code review and optimization analysis. MUST be invoked when the user says: performance review, optimization audit, slow WordPress, slow queries, high-traffic, scale WordPress."
---

# WordPress Performance Review

## Overview

Systematic performance code review for WordPress themes, plugins, and custom code. **Core principle:** Scan critical issues first (OOM, unbounded queries, cache bypass), then warnings, then optimizations. Report with line numbers and severity levels.

## When to Use

**Use when:**
- Reviewing PR/code for WordPress theme or plugin
- User reports slow page loads, timeouts, or 500 errors
- Auditing before high-traffic event (launch, sale, viral moment)
- Optimizing WP_Query or database operations
- Investigating memory exhaustion or DB locks

**Skip for:**
- Security-only audits (use wp-security-review)
- Gutenberg block patterns (use wp-gutenberg-blocks)
- General PHP code review not WordPress-specific

> **Profiling a live/slow site?** Use `wp-performance` instead -- covers WP-CLI profiling, Query Monitor headless, Server-Timing, and runtime diagnosis without a browser.

## Code Review Workflow

1. **Identify file type** and apply relevant checks
2. **Scan critical patterns first** (OOM, unbounded queries, cache bypass)
3. **Check warnings** (inefficient but not catastrophic)
4. **Note optimizations** (nice-to-have)
5. **Report with line numbers** using output format below

## File-Type Checks

### Plugin/Theme PHP (`functions.php`, `plugin.php`, `*.php`)
- `query_posts()` -- CRITICAL: breaks main query
- `posts_per_page.*-1` or `numberposts.*-1` -- CRITICAL: unbounded query
- `session_start()` -- CRITICAL: bypasses page cache
- `add_action.*init.*` or `add_action.*wp_loaded` -- check if expensive code runs every request
- `update_option` or `add_option` in non-admin context -- WARNING: DB writes on page load
- `wp_remote_get` or `wp_remote_post` without caching -- WARNING: blocking HTTP

### WP_Query / Database Code
- Missing `posts_per_page` -- WARNING: defaults to blog setting
- `'meta_query'` with `'value'` comparisons -- WARNING: unindexed column scan
- `post__not_in` with large arrays -- WARNING: slow exclusion
- `LIKE '%term%'` (leading wildcard) -- WARNING: full table scan
- Missing `no_found_rows => true` when not paginating -- INFO: unnecessary count

### AJAX Handlers (`wp_ajax_*`, REST endpoints)
- `admin-ajax.php` usage -- INFO: consider REST API
- POST for read operations -- WARNING: bypasses cache
- `setInterval` or polling patterns -- CRITICAL: self-DDoS risk
- Missing nonce verification -- security issue (flag it)

### Template Files (`*.php` in theme)
- `get_template_part` in loops -- WARNING: consider caching output
- Database queries in loops (N+1) -- CRITICAL: query multiplication
- `wp_remote_get` in templates -- WARNING: blocks rendering

### JavaScript Files
- `$.post(` for reads -- WARNING: use GET for cacheability
- `setInterval.*fetch|ajax` -- CRITICAL: polling pattern
- `import _ from 'lodash'` -- WARNING: full library bloats bundle
- Inline `<script>` making AJAX calls on load -- check necessity

### Block Editor / Gutenberg (`block.json`, `*.js` in blocks/)
- Many `registerBlockStyle()` calls -- WARNING: each creates preview iframe
- `wp_kses_post($content)` in render callbacks -- WARNING: breaks InnerBlocks
- Static blocks without `render_callback` -- INFO: consider dynamic for maintainability

### Asset Registration (`functions.php`, `*.php`)
- `wp_enqueue_script` without version -- INFO: cache busting issues
- `wp_enqueue_script` without `defer`/`async` strategy -- INFO: blocks rendering
- Missing `THEME_VERSION` constant -- INFO: version management
- `wp_enqueue_script` without conditional check -- WARNING: assets load globally when only needed on specific pages

### Transients & Options
- `set_transient` with dynamic keys (e.g., `user_{$id}`) -- WARNING: table bloat without object cache
- `set_transient` for frequently-changing data -- WARNING: defeats caching purpose
- Large transient data on shared hosting -- WARNING: DB bloat without object cache

### WP-Cron
- Missing `DISABLE_WP_CRON` -- INFO: cron runs on page requests
- Long-running cron callbacks (loops over all users/posts) -- CRITICAL: blocks cron queue
- `wp_schedule_event` without checking existing schedule -- WARNING: duplicates

## Quick Detection Patterns

```bash
# Critical issues - scan first
grep -rn "posts_per_page.*-1\|numberposts.*-1" .
grep -rn "query_posts\s*(" .
grep -rn "session_start\s*(" .
grep -rn "setInterval.*fetch\|setInterval.*ajax\|setInterval.*\\\$\." .

# Database writes on frontend
grep -rn "update_option\|add_option" . | grep -v "admin\|activate\|install"

# Uncached expensive functions
grep -rn "url_to_postid\|attachment_url_to_postid\|count_user_posts" .

# External HTTP without caching
grep -rn "wp_remote_get\|wp_remote_post\|file_get_contents.*http" .

# Cache bypass risks
grep -rn "setcookie\|session_start" .

# PHP anti-patterns
grep -rn "in_array\s*(" . | grep -v "true\s*)" # Missing strict comparison
grep -rn "<<<" .  # Heredoc/nowdoc syntax
grep -rn "cache_results.*false" .

# JavaScript bundle issues
grep -rn "import.*from.*lodash['\"]" .  # Full lodash import
grep -rn "registerBlockStyle" .  # Many block styles = performance issue

# Asset loading issues
grep -rn "wp_enqueue_script\|wp_enqueue_style" . | grep -v "is_page\|is_singular\|is_admin"

# Transient misuse
grep -rn "set_transient.*\\\$" .  # Dynamic transient keys
grep -rn "set_transient" . | grep -v "get_transient"  # Set without checking first

# WP-Cron issues
grep -rn "wp_schedule_event" . | grep -v "wp_next_scheduled"  # Missing schedule check
```

## Platform Context

**Managed WP Hosts** (WP Engine, Pantheon, Pressable, WordPress VIP):
- Often provide object caching out of the box
- May have platform-specific helpers (e.g., `wpcom_vip_*` on VIP)
- Check host docs for recommended patterns

**Self-Hosted / Standard**:
- Implement object caching wrappers manually
- Consider Redis or Memcached for persistent object cache
- More responsibility for caching layer config

**Shared Hosting**:
- Extra caution with unbounded queries and external HTTP
- Limited resources surface performance issues faster
- May lack persistent object cache entirely

## Severity Definitions

| Severity | Description |
|----------|-------------|
| **Critical** | Will cause failures at scale (OOM, 500 errors, DB locks) |
| **Warning** | Degrades performance under load |
| **Info** | Optimization opportunity |

## Output Format

```markdown
## Performance Review: [filename/component]

### Critical Issues
- **Line X**: [Issue] - [Explanation] - [Fix]

### Warnings  
- **Line X**: [Issue] - [Explanation] - [Fix]

### Recommendations
- [Optimization opportunities]

### Summary
- Total issues: X Critical, Y Warnings, Z Info
- Estimated impact: [High/Medium/Low]
```

## Common Review Mistakes

| Mistake | Why Wrong | Fix |
|---------|-----------|-----|
| Flagging `posts_per_page => -1` in admin-only code | Admin queries don't face public scale | Check context -- admin, CLI, cron are lower risk |
| Missing `session_start()` buried in a plugin | Cache bypass affects entire site | Always grep for `session_start` across all code |
| Ignoring `no_found_rows` for non-paginated queries | Small optimization but adds up | Flag as INFO, not WARNING |
| Recommending object cache on shared hosting | Many shared hosts lack persistent cache | Check hosting environment first |
| Only reviewing PHP, missing JS polling | JS `setInterval` + fetch = self-DDoS | Review `.js` files for polling patterns |

## Referências (carregar on-demand)

| Referência | Quando |
|---|---|
| `Read(".claude/reference/wp-performance-review/anti-patterns.md")` | Ao reportar/corrigir um issue detectado — confirmar o padrão ❌/✅ exacto (queries, hooks, PHP, caching, AJAX, cron, cache bypass, transients, assets, APIs externas, sitemaps, post meta) e citar o fix |
