---
name: wp-plugin-directory-guidelines
description: "Reviewing WordPress plugins for GPL compliance, checking license headers or compatibility, evaluating upsell/freemium/trialware patterns, validating plugin naming or trademark. MUST be invoked when the user says: t mention ."
compatibility: "Targets WordPress 6.9+ (PHP 7.2.24+)."
---

## Overview

Reference for the 18 WordPress.org Plugin Directory guidelines. Covers GPL licensing, plugin naming/trademark rules, trialware restrictions, and submission requirements.

## When to use

- Review a plugin for WordPress.org Directory guideline compliance
- Check GPL license compatibility for a plugin or bundled libraries
- Verify license headers in plugin files
- Identify guideline violations before submission
- Evaluate premium/upsell flows, license checks, or freemium positioning
- Review "teaser" or "preview" UI for trialware violations

## Inputs required

- Plugin source code (or specific files to review)
- Optional: plugin readme and header metadata for naming/license checks

## Procedure

1. Check the plugin's license header against **Valid License Headers** below.
2. Walk through the **18 Guidelines** checklist, focusing on Guidelines 1, 4, 5, 7, 8, and 17.
3. Confirm trialware/freemium compliance via [guideline-review-checklist.md](references/guideline-review-checklist.md) (Guideline 5).
4. For bundled third-party code, verify license compatibility against **GPL-Compatible Licenses (Quick)** below.
5. Flag matches from **Common GPL Violations (Quick)** below.
6. For edge cases, consult detailed references and the [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html).

## 18-Guideline Review Checklist

Detailed per-guideline checklist in [guideline-review-checklist.md](references/guideline-review-checklist.md). Load only when a full audit is requested.

## GPL Compliance (Guideline 1)

Full license tables and compatibility nuances in [gpl-compliance.md](references/gpl-compliance.md). Inline section below is a quick decision aid.

### Verification (Licensing)

- Every issue must cite **Guideline 1** with file path and exact license string.
- Confirm claims against **GPL-Compatible Licenses (Quick)**; escalate ambiguous licenses.

### Failure modes (Licensing)

- If a license is not clearly GPL-compatible, do not guess. Check the [GNU license list](https://www.gnu.org/licenses/license-list.html).
- For dual-license packages, verify both licenses and redistribution terms.

### WordPress GPL Requirements

- WordPress is **GPLv2 or later**.
- Plugins on WordPress.org must be 100% GPL-compatible (code and assets).
- Include valid `License:` and `License URI:` headers in the main plugin file.
- No restrictions conflicting with GPL freedoms.

### Valid License Headers

## GPL Versions Summary

| Version | Year | Key Addition |
|---------|------|--------------|
| GPLv1 | 1989 | Base copyleft: share-alike for modifications |
| GPLv2 | 1991 | "Liberty or death" clause (Section 7), clearer distribution terms |
| GPLv3 | 2007 | Anti-tivoization, explicit patent grants, compatibility provisions |

WordPress uses **GPLv2 or later** -- plugins can use GPLv2, GPLv3, or "GPLv2 or later".

Full license texts:
- [GPLv1](https://www.gnu.org/licenses/gpl-1.0.html)
- [GPLv2](https://www.gnu.org/licenses/gpl-2.0.html)
- [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html)

## License Compliance Checklist

- [ ] Main plugin file has valid `License:` header (e.g., `GPL-2.0-or-later`, `GPL-2.0+`, `GPLv2 or later`)
- [ ] Main plugin file has `License URI:` pointing to GPL text
- [ ] Bundled libraries each have a GPL-compatible license
- [ ] No "split licensing" (code GPL but premium features proprietary)
- [ ] No restrictions beyond what GPL allows
- [ ] No clauses restricting commercial use, modification, or redistribution
- [ ] No obfuscated code (violates source availability spirit)

## Valid License Headers for WordPress Plugins

```
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
```

```text
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html
```

```text
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
```

### GPL-Compatible Licenses (Quick)

- Safe defaults: GPL-2.0-or-later, GPL-3.0-or-later.
- Accepted permissive: MIT/Expat, BSD, ISC, zlib, Boost.
- Conditional compatibility (verify context): Apache-2.0, MPL-2.0.
- Full accepted/rejected identifiers in [gpl-compliance.md](references/gpl-compliance.md).

### Common GPL Violations (Quick)

- Split licensing restricting distributed code.
- Obfuscated or non-corresponding source distribution.
- Restrictive clauses (non-commercial, no-resale, forced backlink).
- Bundling GPL-incompatible libraries or assets.

## Plugin Naming Rules (Guideline 17)

Full trademark lists, slug blocks, and examples in [naming-rules.md](references/naming-rules.md). Inline checklist for quick screening.

### Naming Checklist (Quick)

- Name is not a placeholder; at least 5 alphanumeric characters.
- Header name and readme name match.
- Name is specific and function-related; no keyword stuffing.
- Trademark/project names only after connectors (`for`, `with`, `using`, `and`).
- No banned/discouraged terms or trademark portmanteaus.
- Slug: lowercase, hyphenated, <= 50 chars, no blocked terms.
