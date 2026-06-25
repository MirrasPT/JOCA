---
processed: true
processed_date: 2026-06-23
type: feedback-joca
source: auto-extracted-by-save
session_date: 2026-06-23
project: datalix-vps
---
processed: true
processed_date: 2026-06-23

**Categoria:** `doc-gap` | **Severidade:** high | **Descrição:** O comando da documentação oficial Cloudflare (`/plugin marketplace add cloudflare/skills/plugin`) usa um slug inválido — o repositório não existe em `github.com/cloudflare/skills/plugin`. O slug correcto é `cloudflare/skills` (repositório `https://github.com/cloudflare/skills`). Além disso, estes são slash commands do REPL interactivo do Claude Code; a versão CLI equivalente é `claude plugin marketplace add cloudflare/skills`. | **Componente afectado:** `deploy-*` skills, qualquer skill que documente instalação de plugins Cloudflare | **Fix sugerido:** Se criar skill `cloudflare-deploy` ou similar, documentar o slug correcto `cloudflare/skills` e o comando CLI `claude plugin marketplace add cloudflare/skills`.

**Categoria:** `discovery-gap` | **Severidade:** medium | **Descrição:** Quando user diz "conecta a minha VPN no datalix", a intenção pode ser (a) SSH à VPS, (b) VPN real (WireGuard/OpenVPN), ou (c) publicar algo no servidor. Foram precisas 2 perguntas de clarificação. | **Componente afectado:** Task intake, interpretação de pedidos de infra | **Fix sugerido:** Na primeira menção de "VPN/servidor/VPS + IP", perguntar upfront: "SSH para gerir o servidor, ou VPN tunnel para ligar o teu PC à rede remota?"

**Categoria:** `missing-skill` | **Severidade:** medium | **Descrição:** Não existe skill para setup e gestão de VPS (SSH key bootstrap, Caddy, SCP, deploy estático). O workflow teve de ser improvisado no main loop. Padrão repetível: gerar chave ED25519 → plink bootstrap → OpenSSH key-auth → Caddy vhost → SCP assets → DNS Cloudflare via API. | **Componente afectado:** Nenhum (ausência) | **Fix sugerido:** Criar skill `deploy-vps` ou `vps-setup` que documente o padrão plink-bootstrap + Caddy + DNS Cloudflare.

**Categoria:** `tool-reliability` | **Severidade:** low | **Descrição:** `claude plugin marketplace add` usa SSH por defeito para clonar do GitHub, o que falhou (sem chave SSH para GitHub). Foi necessário adicionar `git config --global url."https://github.com/".insteadOf "git@github.com:"` para forçar HTTPS. Este config global pode afectar outros workflows git do utilizador. | **Componente afectado:** Plugin marketplace, `/update-joca`, qualquer comando que clone do GitHub | **Fix sugerido:** Documentar em `workflows-and-tooling.md` que no Windows sem GitHub SSH configurado, o marketplace usa HTTPS se configurado via `git config --global`.
