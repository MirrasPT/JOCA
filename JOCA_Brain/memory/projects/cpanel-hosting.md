---
project: cpanel-hosting
host: s4835.lux1.stableserver.net
account: renatoferreira
ip: 194.42.98.200
panel: cPanel 130/134 (stableserver shared hosting)
---

# cPanel Hosting — conta renatoferreira (stableserver)

Conta cPanel partilhada que aloja vários sites/landing-pages do Renato + clientes.
Acesso via **token UAPI** (`~/.cpanel/renatoferreira.org.json`, fora do git) + **SFTP** por chave `~/.ssh/cpanel_renatoferreira` (porta 22). **Shell interactivo OFF** (ticket ao host se preciso). Driver: `.claude/scripts/cpanel.mjs` (skill `cpanel`).

## Estado actual (2026-06-27)

**Domínio primário:** renatoferreira.org (portfolio).

**Addon domains:**
| Domínio | Docroot | Notas |
|---|---|---|
| `alkimiawine.pt` | `/home/renatoferreira/alkimiawine.pt` | Landing/linktree Alkimia Wine. **Migrado de .com → .pt nesta sessão.** SSL Let's Encrypt OK. DNS na Cloudflare (conta Renatorff93). |
| `royaldouro.com` | `/home/.../royaldouro.com` | Site + linktree + termos/cookies. Live. |
| `vinartis.pt` | `/home/.../vinartis.pt` | Site + linktree. Live. ⚠ `vinartis_deploy.zip` esquecido no docroot. ⚠ **2026-07-08: `webmail.vinartis.pt` estava PROXIED (orange) na Cloudflare → HTTP 503** (webmail cPanel não funciona atrás do proxy). Fix pendente: grey-cloud → `194.42.98.200` (= IP do `mail`). Origem cPanel real = **`194.42.98.200`**. |
| `bracaris.com` | `/home/.../bracaris.com` | |
| `divinealvarinho.com` | `/home/.../divinealvarinho.com` | |

**Subdomínios:** luz / borntobyhype / baby (.renatoferreira.org).

**Removido (2026-06-27):** `rateitplus.pt` (addon) + `app.rateitplus.pt` (subdomínio, app PWA PHP+MySQL) + email `no-reply@` + BD `renatoferreira_rateitplus` + user. Backup completo (ficheiros + dump SQL 18 tabelas) em `C:\Users\renat\Desktop\rateitplus_backup_2026-06-27.zip`.

## Decisões tomadas
- **2026-06-27** — Alkimia: nova pasta `.pt` (cópia do conteúdo, não reutilizar pasta `.com`); removido o addon `.com` antigo (o `.com` público vive noutro host AWS/Squarespace — o cPanel só tinha uma cópia). Link interno `.com`→`.pt` reescrito (`links.html`).
- **2026-06-27** — Rateitplus: apagar TUDO mas com backup primeiro (ficheiros via SFTP + dump BD via Remote MySQL temporário). DNS Cloudflare: não havia zona `rateitplus.pt` na conta → nada a limpar.

## Gotchas operacionais (também na skill `cpanel`)
- **Criar/apagar addon domain:** módulos UAPI `AddonDomain`/`Domains`/`Park` **não carregam** neste host → usar **API2** (`/json-api/cpanel?...apiversion=2&module=AddonDomain&func=addaddondomain/deladdondomain`).
- **Apagar ficheiros:** `Fileman/trash` não existe; `fileop unlink` só apaga ficheiros (no-op em dir não-vazia, devolve `result:1`). Recursivo = **SFTP** `-rm`/`-rmdir` (bottom-up; **quoting** obrigatório p/ nomes com espaços; gerar batch do `ls` remoto).
- **Dump BD sem shell:** `getsqlbackup` dá Forbidden c/ token → Remote MySQL `Mysql/add_host` + `mysql2` (node) + `Mysql/delete_host` no fim.
- DNS dos `.pt` desta conta vive na **Cloudflare** (não na zona cPanel). Ver [[datalix-vps]] (máquina diferente — VPS 194.62.248.50, não confundir).
- **cPanel + Cloudflare — regra de proxy:** `webmail`/`cpanel`/`mail` (e `whm`) têm de ser **DNS-only (grey cloud)**, NUNCA proxied. O proxy (orange) intercepta e o serviço cPanel (portas 2096/2083/2087) devolve 503/502. Sintoma: A record aponta para IP Cloudflare (172.67.x/104.21.x) + `server: cloudflare`. Fix = desligar proxy no registo. (Fonte: vinartis.pt 2026-07-08.)
- ⚠ **Token Cloudflare em falta no Mac** (migração 2026-07-08 não trouxe `~/.cloudflare/datalix.json`) → operações Cloudflare bloqueadas até restaurar o token/dar novo. Ver [[datalix-vps]].

## Última sessão
2026-07-08 — Diagnóstico `webmail.vinartis.pt` HTTP 503: registo `webmail` proxied (orange) na Cloudflare; fix = grey-cloud → 194.42.98.200. Não aplicado (token CF em falta no Mac).
