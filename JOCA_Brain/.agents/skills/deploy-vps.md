---
name: deploy-vps
description: "Deploy static sites or apps to a fresh Linux VPS using Caddy reverse proxy and Cloudflare DNS. MUST invoke when the user says: deploy VPS, VPS setup, Caddy server, SSH key setup VPS, Cloudflare DNS API, scp upload site, static site VPS. SHOULD invoke when: fresh Ubuntu server, bootstrap SSH, plink fingerprint, ED25519 key, /var/www, site no ar, publicar no VPS, configurar servidor."
triggers: deploy VPS, VPS setup, Caddy, Caddy server, SSH key VPS, Cloudflare DNS API, scp site, static site VPS, fresh Ubuntu server, bootstrap SSH, plink fingerprint, ED25519 key, /var/www, publicar VPS, configurar servidor, Datalix, caddy vhost, static hosting
origin: local
chain: deploy-executor
---
# Deploy VPS — Caddy + Cloudflare

Padrão validado: Ubuntu VPS (Datalix) + Caddy v2 + Cloudflare DNS via API. Windows-first.

---

## 1. Gerar chave SSH ED25519

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\<name>_id" -N "" -C "joca@<host>"
# Guarda: ~/.ssh/<name>_id  (privada) e ~/.ssh/<name>_id.pub (pública)
$pubkey = Get-Content "$env:USERPROFILE\.ssh\<name>_id.pub"
```

---

## 2. Bootstrap via plink (sem interactive password)

Requer PuTTY instalado:
```powershell
winget install PuTTY.PuTTY
```

**Passo 2a — obter fingerprint** (plink falha mas mostra SHA256):
```powershell
plink -pw "<pass>" root@<ip> "echo test"
# Copiar "SHA256:xxxx..." do erro
```

**Passo 2b — injectar chave pública** (batch, sem interacção):
```powershell
plink -pw "<pass>" -batch -hostkey "SHA256:<fingerprint>" root@<ip> `
  "mkdir -p ~/.ssh && echo '$pubkey' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
# ✓ PowerShell expande $pubkey (double-quoted string) antes de passar ao plink — comportamento correcto
```

---

## 3. Limpar known_hosts e testar chave

```powershell
ssh-keygen -R <ip>
ssh -i "$env:USERPROFILE\.ssh\<name>_id" -o StrictHostKeyChecking=accept-new root@<ip> "whoami"
# Deve responder: root
```

Se falhar com "ECDSA vs ED25519 mismatch" — `ssh-keygen -R <ip>` resolve sempre.

---

## 4. Instalar Caddy (Ubuntu)

```bash
# Via cloudsmith (método oficial)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
sudo systemctl enable caddy
```

---

## 5. Caddyfile — vhost estático

Editar `/etc/caddy/Caddyfile`:

```caddyfile
subdomain.example.com {
    root * /var/www/mysite
    file_server
    encode gzip
}
```

```bash
sudo mkdir -p /var/www/mysite
sudo caddy reload --config /etc/caddy/Caddyfile
# Caddy obtém TLS via Let's Encrypt automaticamente
```

Múltiplos sites: blocos separados no mesmo ficheiro. Caddy gere TLS por todos.

---

## 5b. Caddyfile — app Docker atrás do Caddy do sistema

Padrão recorrente (TryPost, *arr): a app corre em **Docker, privada em `127.0.0.1:<porta>`**, e o **Caddy do sistema** (não o embutido no compose — colidiria na 80/443) faz reverse-proxy + TLS. Páginas estáticas (legal/verificação de domínio) coexistem com o proxy via `handle`:

```caddyfile
app.example.com {
    encode gzip
    handle /privacy* {
        root * /var/www/app-static
        file_server
    }
    handle {
        reverse_proxy 127.0.0.1:8000   # app Docker bind a localhost
    }
}
```

No `compose.prod.yaml`: publicar a app só em `127.0.0.1:8000:8000` (nunca `0.0.0.0`) e **não** activar o Caddy embutido. Ver `memory/projects/datalix-vps.md` (TryPost).

> **Gotcha — HTTP 525 transitório com Cloudflare orange + on-demand cert:** o 1º pedido enquanto o Caddy ainda está a emitir o cert Let's Encrypt devolve **525** (ou 502) por alguns segundos. **Não é erro** — resolve sozinho assim que o cert é emitido. Confirmar passados ~10-30s antes de debugar.

---

## 6. Upload de assets via SCP

```powershell
# Do Windows para o VPS
scp -i "$env:USERPROFILE\.ssh\<name>_id" -r local\path\ root@<ip>:/var/www/mysite/
```

Verificar:
```bash
ssh -i ~/.ssh/<name>_id root@<ip> "ls /var/www/mysite"
```

---

## 7. DNS via Cloudflare API

```powershell
$headers = @{ Authorization = "Bearer <CF_API_TOKEN>"; "Content-Type" = "application/json" }
$body = @{ type="A"; name="<subdomain>"; content="<ip>"; ttl=1; proxied=$true } | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" `
  -Method POST -Headers $headers -Body $body
```

Obter `ZONE_ID`: Cloudflare dashboard → domínio → Overview → API section (direita).
Criar token: My Profile → API Tokens → Create Token → "Edit zone DNS".

Proxied = true → Cloudflare CDN + DDoS. Proxied = false → DNS puro (IP exposto).

---

## Gotchas Windows

| Problema | Causa | Fix |
|----------|-------|-----|
| plink recusa sem hostkey | TOFU não-interactivo | Obter SHA256 do 1º erro e passar `-hostkey` |
| SSH falha após bootstrap | known_hosts com chave ECDSA antiga | `ssh-keygen -R <ip>` antes de reconectar |
| plink pede .ppk | plink usa formato PuTTY | Usar `ssh`/`scp` (OpenSSH) após bootstrap |
| SCP sem -r não sobe pasta | `-r` obrigatório para directórios | `scp -r local\ root@ip:/remote/` |
| Caddy não serve após upload | Permissões em /var/www | `sudo chown -R caddy:caddy /var/www/mysite` |

---

## Checklist deploy VPS

- [ ] Chave ED25519 gerada (`~/.ssh/<name>_id`)
- [ ] Chave pública em `~/.ssh/authorized_keys` no VPS
- [ ] `ssh-keygen -R <ip>` corrido após bootstrap
- [ ] Login SSH com chave testado (`whoami` = root)
- [ ] Caddy instalado e activo (`systemctl status caddy`)
- [ ] `/etc/caddy/Caddyfile` com vhost correcto
- [ ] `/var/www/mysite/` criado com assets
- [ ] `caddy reload` corrido após editar Caddyfile
- [ ] Registo DNS A criado no Cloudflare
- [ ] Site acessível via HTTPS (Caddy + Let's Encrypt automático)
