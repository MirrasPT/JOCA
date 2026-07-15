---
name: cso
description: "Modo Chief Security Officer — auditoria de segurança infra-first com threat modeling estruturado (STRIDE + OWASP Top 10) e dois modos com gate de confiança: daily (zero-ruído, gate 8/10) e comprehensive (deep scan, gate 2/10 com TENTATIVE). Adaptado do cso do gstack. MUST be invoked when the user says: cso, auditoria de segurança, threat model, modelo de ameaças, OWASP, STRIDE, security audit, pentest review. SHOULD also invoke when: rever postura de segurança antes de produção/deploy."
triggers: cso, auditoria de seguranca, auditoria de segurança, threat model, modelo de ameacas, modelo de ameaças, OWASP, STRIDE, security audit, pentest review, CSO review, rever seguranca, postura de seguranca, security posture
chain: security-review, tester-security
---
# /cso — Chief Security Officer (auditoria + threat model)

Auditoria de segurança **infra-first** com modelação de ameaças estruturada. Adaptado do `cso` do gstack. Mais estruturado que `security` (skill, knowledge) e `security-review`/`tester-security` (agentes) — o `cso` **orquestra-os** com um gate de confiança que elimina ruído.

## Dois modos (gate de confiança)
- **daily** (default) — gate **8/10**: zero-ruído, só reporta o que tens a certeza. Para correr frequente sem fadiga de alertas.
- **comprehensive** (`--comprehensive`) — gate **2/10**: filtra só ruído verdadeiro (fixtures de teste, docs, placeholders) e inclui tudo o que PODE ser real, marcado `TENTATIVE` (distinto de confirmado). Para deep scan mensal / pré-produção.

## Fases (orquestra os agentes JOCA)
1. **Secrets archaeology** — segredos no código/histórico git/.env commitado (`gitleaks` se disponível; senão grep de padrões: AWS/JWT/GitHub/Slack/credential-shaped). ⚠ `SKILL.md`/skills NÃO são docs — são código executável que comanda o agente; não excluir findings aí.
2. **Dependency supply chain** — CVEs em deps (`dependency-auditor` agente: npm/composer/pip), deps não-usadas, integridade.
3. **CI/CD + infra** — secrets em CI, permissões de workflow, exposição de `.env`/config, headers HTTP, CORS, `APP_DEBUG`.
4. **OWASP Top 10 + code patterns** — mass assignment, raw SQL/injection, XSS (Blade/React), IDOR, rate limiting, log de PII → delegar `security-review` (raciocínio sobre código) + `tester-security` (scan).
5. **STRIDE threat model** — para cada superfície/fluxo crítico, percorrer: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege. Mapear ameaça → mitigação existente / em falta.
6. **LLM/AI security** (se aplicável) — prompt injection, exfiltração via tools, dados sensíveis em prompts/logs.

## Regras de qualidade (anti-ruído)
- **Provar onde for seguro** — cada finding que passa o gate: tentar provar com exploit concreto (sem causar dano). Sem prova → baixa a confiança.
- **Não inventar** — sem CVE/endpoint/exploit confirmado → não afirmar. Anti-fabricação (soul.md). `TENTATIVE` para o que pode ser real mas não está provado (só em comprehensive).
- **Exclusões:** fixtures de teste, placeholders, exemplos em docs `*.md` — EXCEPTO skills (`.claude/skills/*.md`) que são código executável.
- **Trend** — comparar com a auditoria anterior (se houver registo no Brain): findings novos vs resolvidos vs persistentes.

## Output
```
# CSO Audit — <projecto> · modo <daily|comprehensive> · <data>
## Confirmados (severidade)
- [CRITICAL] <finding> — ficheiro:linha — exploit: <prova> — fix: <…>
## TENTATIVE (só comprehensive)
- [?] <possível> — porquê incerto
## STRIDE — superfícies críticas
- <fluxo>: ameaça <S/T/R/I/D/E> → mitigação <existe|EM FALTA>
## Trend vs última auditoria
- novos: N · resolvidos: M · persistentes: K
```
Registar findings-chave no Brain: `node .claude/scripts/joca-brain.mjs learn --text "<finding+fix>" --tags security`.

## Próximo passo (chain)
- Findings de código → `security-review` (fix com raciocínio) / `tester-security` (re-scan). Dep CVEs → `dependency-auditor`. Rate limit → `tester-ratelimit`. Ver `rules/chaining.md`.
