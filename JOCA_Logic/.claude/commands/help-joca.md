# /help-joca — Referência rápida do JOCA

Apresenta todos os comandos, agentes e skills do JOCA com descrição curta.

## Passos

1. Ler `JOCA/memory/INDEX.md` para obter a lista actualizada de agentes e skills.
2. Apresentar o output abaixo — substituindo as secções de Agentes e Skills com o conteúdo real do INDEX.md, resumido a ~10 palavras por item.

---

## Output a apresentar

```
JOCA — Referência rápida
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SESSÃO
/resume              Carrega contexto e knowledge graph do projecto
/save                Guarda estado da sessão e actualiza memory
/init-project        Inicializa entrada de projecto novo em JOCA/memory
/install             Setup ou reconfiguração do JOCA

WORKFLOW
/plan                Activa Plan Mode para arquitectura e decisões
/debug               Triage de erros com skill do stack detectado
/review-code         Code review via tester-code + Codex adversarial opcional
/review-design       Review UI/UX e acessibilidade em paralelo
/create-skill [desc] Cria nova skill via pipeline self-improving
/create-skill --upgrade [nome]  Melhora skill existente

FEEDBACK & MANUTENÇÃO
/feedback-joca       Captura gaps no workflow JOCA desta sessão
/feedback-projeto    Actualiza docs do projecto com aprendizagens da sessão
/upgrade-joca        Lê feedback acumulado → implementa melhorias ao JOCA
/update-joca         Verifica e aplica updates do repositório oficial GitHub

WORDPRESS
/wp-perf             Quick triage WordPress — issues críticos (rápido)
/wp-perf-review      Code review WP completo: Critical / Warning / Info

/help-joca           Esta página

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENTES
[ler do INDEX.md — secção ## Agents — e apresentar agrupado por categoria]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SKILLS
[ler do INDEX.md — secção ## Skills — e apresentar agrupado por categoria]
Nota: Skills Shopify e WordPress só activas nos projectos respectivos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Regras de formatação

- Descrições: máximo ~10 palavras, sem artigos quando possível
- Agrupar por categoria tal como no INDEX.md
- Sem markdown pesado — texto plano com `━` como separador
- Skills GSAP, Stitch, browser-use, ComfyUI, hyperframes: agrupar como bloco "GSAP (8)", "Stitch (8)", etc. com nota "(ver INDEX.md para lista completa)"
- Se o utilizador passar argumento (ex: `/help-joca design`): filtrar e mostrar só essa categoria
