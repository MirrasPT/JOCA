# Deploy VPS — ramo macOS/Linux e retirar um site (referência do `deploy-vps`)

> Movido de `skills/deploy-vps.md`. Os «§N» citados abaixo (§0, §3b, §4c, 6b, 6c, 6e…) são secções desse ficheiro.

## Índice
- [Ramo macOS/Linux](#ramo-macoslinux-equivalente-ao-fluxo-windows-acima) — chave + bootstrap, rsync, Caddyfile por append, assets por symlink, problemas
- [Retirar um site do ar ⛔](#retirar-um-site-do-ar--irreversível) — 4 camadas, inventário, ordem canónica, gate, verificação

## Ramo macOS/Linux (equivalente ao fluxo Windows acima)

Windows é a plataforma principal (secções 1-7). A partir de macOS/Linux o fluxo é o mesmo com
OpenSSH nativo — sem `plink`, sem PuTTY.

**Chave + bootstrap** (`ssh-copy-id` substitui todo o passo 2):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/<name>_id -N "" -C "joca@<host>"
ssh-copy-id -i ~/.ssh/<name>_id.pub root@<ip>          # pede a password uma vez
ssh-keygen -R <ip>                                      # se houver chave antiga em known_hosts
ssh -i ~/.ssh/<name>_id root@<ip> "whoami"              # deve responder: root
```

**Upload — `rsync -az` (não `-a` puro como root; ver 6b):**
```bash
rsync -az --delete --no-owner --no-group \
  -e "ssh -i ~/.ssh/<name>_id" \
  --exclude '.DS_Store' --exclude '.git' \
  dist/ root@<ip>:/var/www/mysite/
```
`--dry-run --itemize-changes` **sempre** antes do disparo real. Depois, correr a verificação de
integridade da 6c (tamanhos + `content-length`) — o exit 0 do `rsync` não prova nada.

**Caddyfile — append + validar ANTES de recarregar.** Esta ordem não é cosmética: um Caddyfile
inválido recarregado deita abaixo **todos** os vhosts do servidor, não só o novo.
```bash
ssh -i ~/.ssh/<name>_id root@<ip> "cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak"
cat >> /tmp/vhost <<'EOF'

subdomain.example.com {
    root * /var/www/mysite
    file_server
    encode gzip
}
EOF
scp -i ~/.ssh/<name>_id /tmp/vhost root@<ip>:/tmp/vhost
ssh -i ~/.ssh/<name>_id root@<ip> '
  cat /tmp/vhost >> /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile \
    || { echo "ABORTAR: Caddyfile inválido — a repor backup"; cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile; exit 1; }
  systemctl reload caddy
  systemctl is-active caddy
'
```
`caddy validate` → `systemctl reload caddy` → `systemctl is-active caddy`. Nunca reload sem validate.
`caddy fmt --overwrite /etc/caddy/Caddyfile` antes do validate mantém o ficheiro legível após appends.

**Assets partilhados por symlink** (vários vhosts servem o mesmo pack de fontes/imagens: sobe-se
uma vez, cada site aponta lá):
```bash
rsync -az --no-owner --no-group -e "ssh -i ~/.ssh/<name>_id" \
  shared-assets/ root@<ip>:/var/www/_shared/
ssh -i ~/.ssh/<name>_id root@<ip> '
  ln -sfn /var/www/_shared /var/www/mysite/shared     # -n: não escrever DENTRO de um symlink já existente
  chown -h caddy:caddy /var/www/mysite/shared
'
```
No vhost, o Caddy só segue o symlink se o alvo for legível pelo `caddy`
(`chown -R caddy:caddy /var/www/_shared`). Releases atómicas seguem o mesmo padrão: `current` é um
symlink e a troca é `ln -sfn <release> current`.

| Problema (macOS/Linux) | Causa | Fix |
|----------|-------|-----|
| `Permission denied (publickey)` após `ssh-copy-id` | permissões da `~/.ssh` no servidor | `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys` |
| `rsync` copia a pasta em vez do conteúdo | falta a `/` final na origem | `dist/` não `dist` |
| CMS não grava depois do rsync | `-a` carimbou uid da origem | `--no-owner --no-group` + `chown` no destino (6b) |
| Caddy morto após editar vhost | reload sem validate | `caddy validate` primeiro; repor `Caddyfile.bak` |
| Symlink aninhado dentro de si próprio | `ln -sf` sem `-n` sobre symlink existente | `ln -sfn` |


---

## Retirar um site do ar ⛔ (irreversível)

Um site na VPS vive em **4 sistemas independentes** e não há nada no toolkit que encapsule a
remoção. Feito à mão e por qualquer ordem, deixa órfãos: um monitor do Uptime Kuma a apitar sobre um
site que já não existe, um registo DNS a apontar para um 404.

| # | Camada | Comando | Porquê nesta ordem |
|---|---|---|---|
| 1 | Monitor (Uptime Kuma / equivalente) | apagar o monitor | senão apita durante o resto do processo |
| 2 | DNS (Cloudflare) | `DELETE .../dns_records/<id>` | tira o tráfego antes de o servidor deixar de responder |
| 3 | Bloco no Caddyfile | backup → remover bloco → `caddy validate` → `reload` | §0 aplica-se: os outros sites estão neste ficheiro |
| 4 | Ficheiros | `rm -rf /var/www/<site>` | último; é o que não se desfaz |

**Inventário primeiro — "o que cai com isto":** listar, e mostrar ao utilizador, (a) o docroot
(`/var/www/<site>` — tamanho e se há dados só ali), (b) o bloco no `/etc/caddy/Caddyfile` e todos os
domínios que o encabeçam, (c) os registos DNS no Cloudflare que apontam para o IP/subdomínio, (d) os
monitores do Uptime Kuma, (e) BD associada, cron, container e certificado. Um bloco de Caddy pode
servir mais do que um domínio — apagá-lo derruba todos. Um pedido tipo "apaga estes 5 URLs" é
**operação destrutiva de infra em 4 camadas**, não uma tarefa de frontend — confirmar 1 linha antes
de começar. Já se levou à frente, com decisão consciente, uma galeria de 366 MB que estava debaixo de
um docroot a apagar.

**Ordem canónica (não é arbitrária — cada passo evita o erro do seguinte):**

1. **Monitor (Uptime Kuma)** — pausar/apagar primeiro. Enquanto o site estiver a cair, o monitor
   dispara alertas falsos e polui o histórico.
2. **DNS (Cloudflare)** — remover o registo. Enquanto resolver, o tráfego continua a chegar; depois
   do Caddy sair, resolveria para o 404 do servidor (e a Cloudflare guarda 404 em cache ~4 h, ver 6e).
3. **Caddy** — remover o bloco do vhost, `caddy validate` **antes** do reload, `systemctl reload
   caddy`. Guardar `Caddyfile.bak` — é o único passo que se desfaz em segundos.
4. **Ficheiros** — só no fim, `rm -rf /var/www/<site>`. Irrecuperável: fazer `tar` para fora antes
   se houver uploads/BD/`.env` que só existam ali.
   **Arquivar sempre o docroot para `~/Old/` antes do `rm`**, haja ou não cópia local: comparar o
   publicado com as pastas locais por md5 não encontrou nenhuma correspondência (os deploys reescrevem
   caminhos) e custou ~20 min (2026-09-28). A comparação local é só informativa, nunca a prova.

**Gate obrigatório:** apagar ficheiros e registos DNS é irreversível → 1 linha de confirmação com o
inventário à frente, antes do passo 2. Passos 1 e 3 são reversíveis e correm sem perguntar.

**Verificar no fim:** `curl -sSI https://<dominio>` não resolve (ou devolve o 404 do servidor), o
`caddy validate` passa, e o monitor não existe. Não fica órfão nenhum. Verificar também que os
**sites vizinhos** que ficaram no Caddyfile continuam a responder 200.
