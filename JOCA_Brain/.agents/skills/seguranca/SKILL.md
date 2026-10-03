---
name: seguranca
description: "Ciclo completo de auditoria de segurança de um projeto (/seguranca): âmbito com autorização para testes ativos, reconhecimento da stack, frentes em paralelo (código, segredos no histórico, dependências com CVE, API e rate limit, RGPD), revisor adversarial que reproduz cada achado, relatório priorizado e uma issue por achado confirmado. Não corrige código. MUST be invoked when the user says: /seguranca, auditoria de segurança, security audit, security review completo, pentest ao meu projeto, modelo de ameaças, threat model, STRIDE, cso. SHOULD also invoke when: o projeto está seguro para lançar, procurar segredos no histórico, ciclo de segurança antes de produção."
triggers: /seguranca, auditoria de seguranca, auditoria de segurança, security audit, security review completo, pentest ao meu projeto, pentest projeto, ciclo de seguranca, ciclo de segurança, modelo de ameacas, modelo de ameaças, threat model, STRIDE, cso, segredos no historico, segredos no histórico, projeto esta seguro, auditoria completa de seguranca, security scan do repo
chain: novo-issue, security-review, dependency-auditor
---
# seguranca → comando `/seguranca`

O ciclo vive no comando: `Read(".claude/commands/seguranca.md")` e segue-o com o pedido do utilizador
como `$ARGUMENTS` (caminho ou URL do repo; vazio = pasta atual).

Quando **não** é este ciclo:
- pergunta pontual ou padrão de uma stack («isto tem SQL injection?», «como protejo o upload?») →
  skill `security`;
- rever só o diff ou 1-3 ficheiros → agente `security-review` diretamente;
- segredo colado no chat ou rodar uma credencial → skill `credential-handling`;
- só consentimento/cookies → skill `gdpr-compliance`.

A antiga skill `cso` passou a ponteiro para aqui (2026-10-02): o STRIDE está na F1, o gate de confiança
na F3 (confirmado / não confirmado / rejeitado) e a tendência entre auditorias na F4.

## Próximo passo (chain)
- Achados confirmados → issues (`novo-issue`, F4 do comando) → correção numa onda própria.
- Dependências com CVE → `dependency-auditor` para o plano de atualização.
