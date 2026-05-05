# JOCA Optimized

JOCA_Optimized é a versão compactada do [JOCA](https://github.com/MirrasPT/JOCA). Mesma funcionalidade, menos tokens por skill.

**Problema resolvido:** Skills originais tinham 150-800 linhas de descrição verbosa. JOCA_Optimized reduz para 20-60 linhas por skill sem perder activação.

---

## O que mudou

### Skills consolidadas (40+ → 20)

| Original | → | Optimizado |
|---|---|---|
| `caveman` + `karpathy-guidelines` + `agent-context` | → | Absorvidos no `CLAUDE.md` |
| `php-pro` + `laravel-specialist` + `postgres-pro` | → | `php-stack` |
| `devops-engineer` | → | `platform` (compact) |
| `api-designer` + `test-master` | → | `quality` |
| `google-analytics` + `microsoft-clarity` | → | `analytics` |
| `frontend-design` + `huashu-design` | → | `ui` |
| `brand-guidelines` + `canvas-design` + `img-gen` | → | `visual` |
| `lottie-animator` + `slides` | → | `motion` |
| `seo` + `seo-local` | → | `seo` |
| `content-strategy` + `social-content` + `copywriting` | → | `content` |
| `ads-creation` + `email-sequence` | → | `performance` |
| `video` | → | `video` (compact: 397 → 120 linhas) |

WordPress · Shopify · Flutter · Blender · ComfyUI: mantidos, SKILL.md compactados.

### Redução de tokens

| Métrica | Original | Optimizado |
|---|---|---|
| Total linhas SKILL.md | ~14 000 | ~5 000 |
| Linhas por skill (média) | ~200 | ~35 |
| Skills num projecto PHP | 3 separadas | 1 (`php-stack`) |
| Skills num projecto de conteúdo | 3 separadas | 1 (`content`) |

---

## Estrutura

```
JOCA_Optimized/
├── CLAUDE.md          ← comportamento base (inclui caveman + karpathy + agent-context)
├── .mcp.json          ← Playwright, Firecrawl, Lunar Docs
├── memory/INDEX.md    ← catálogo skills/agentes
└── .claude/
    ├── commands/      ← commands originais (inalterados)
    ├── agents/        ← agentes originais (inalterados)
    └── skills/
        ├── base/create-skill/
        ├── dev/       ← php-stack · platform · quality · flutter · analytics · web-tester · blender · wordpress/ · shopify/
        ├── design/    ← ui · visual · motion · comfyui/
        ├── marketing/ ← seo · content · performance
        └── video/     ← video · hyperframes/
```

---

## Início rápido

```
/resume
```

---

## Créditos

Fork de [MirrasPT/JOCA](https://github.com/MirrasPT/JOCA). Skills construídas sobre trabalho de: Anthropic, Corey Haines, Jeffallan, VoltAgent, WordPress Foundation, HeyGen, alchaincyf, e outros. Lista completa em [`READ.md`](READ.md).

> MIT (sistema de integração). Licença dos componentes individuais pertence aos autores originais.
