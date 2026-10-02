---
name: credential-handling
description: "Mover, inspeccionar e rodar credenciais sem as fazer passar pelo modelo nem pelo transcript. MUST invoke when the user says: credencial, password, segredo, secret, API key, token, rodar password, mudar credencial, provisionar servidor, migrar ambiente. SHOULD also invoke when: inspeccionar formulário de login, ler ficheiro .env, colar chave no painel, guardar chave num serviço, rotação de credencial em produção."
triggers: colei um token, token colado, credencial, credential, password, palavra-passe, segredo, secret, api key, token de api, chave de api, rodar password, rotate credential, mudar credencial, provisionar servidor, migrar ambiente, .env, colar chave, inspeccionar formulario, secret manager
origin: local
chain: security
---

# Credential handling — a credencial não passa pelo modelo

Um segredo que entra no transcript está queimado: fica no histórico da sessão, nos ficheiros de
sessão em disco e em qualquer relatório de agente. **Rotação é o único remédio.** Logo o objectivo
não é "esconder bem" — é a credencial nunca chegar a passar por aqui.

Três coisas distintas, com regras próprias: **transportar** · **inspeccionar** · **rodar**.

---

## 1. Transportar (A → B) — 3 vias que funcionam

| Via | Quando | Forma |
|---|---|---|
| **Gerar no destino** | credencial nova (BD, app key, utilizador de serviço) | nasce onde é usada e nunca viaja: `openssl rand -base64 32 > /caminho/gitignored`, `php artisan key:generate`, ou o próprio painel gera e guarda |
| **Canal directo A→B** | migrar entre ambientes / máquinas | o valor passa pelo shell, não pelo modelo: `ssh A '<export>' \| ssh B '<import>'`, `gh secret set NOME < ficheiro`, `wrangler secret put NOME < ficheiro` — sempre por `stdin`/pipe, nunca como argumento (o argumento fica no histórico do shell e no `ps`) |
| **O utilizador cola no destino** | só existe UI/browser no meio | o modelo dá o passo-a-passo (URL, campo, botão) e o utilizador cola. O modelo **não pede o valor** e confirma pelo **efeito** (o serviço autentica), nunca por leitura |

**Comando que recebeu um segredo ainda a correr → nunca listar processos com a linha de comando**
(`ps aux`, `ps -eo args`, `pgrep -af`): o argumento aparece inteiro e entra no transcript — um
`ps aux | grep <script>` publicou um Client secret e obrigou a rodá-lo (2026-09-21). Verificar pelo
**efeito** (PID com `pgrep -x <nome>` sem `-a`/`-f`, ficheiro de saída, porta à escuta). Scripts
escritos pelo JOCA lêem o segredo por `stdin` (`read -rs VAR`), nunca por `argv`.

**Segredos entre sites/módulos do mesmo servidor** (ex.: dois sites Ploi): não há canal direto
válido — copiar por script de deploy é bloqueado e escrever no browser é proibido. Só as vias
«O utilizador cola no destino» e «Gerar no destino»; os valores a colar listam-se **à cabeça do plano
de deploy** (ver `deploy-ploi.md` §Site setup).

**Segredo descarregado pelo browser** (chave de conta de serviço, JSON de credenciais): com «perguntar
onde guardar», o diálogo nativo é invisível à extensão e o ficheiro grava na última pasta usada — uma
chave do Firebase caiu na raiz do repo (2026-09-28). **Antes** do download, dizer ao utilizador para
que pasta vai; **depois**, no mesmo turno, `find` dirigido (nome do ficheiro, pastas prováveis) e
mover para um destino fora do repo com `chmod 600`; confirmar com `git status` que não ficou nada.

**Depois de um segredo ser colado num campo de formulário no browser, não se tira screenshot nem se
lê a página** enquanto o valor estiver visível. Um `type="password"` mascara na UI mas o valor
continua no DOM (`read_page`, `get_page_text`, um dump de acessibilidade — todos o apanham), e um
`cmd+v` que caia no campo errado cai num campo **visível**: a captura de confirmação publica-o no
transcript. Aconteceu no painel Ploi (2026-09-18) e a password teve de ser regenerada.

- Confirmar o preenchimento pelo **efeito** — o formulário aceitou, o pedido passou, o serviço
  autentica — **nunca por imagem do ecrã**, nem screenshot, nem zoom da zona, nem releitura da página.
- Precisas mesmo de ver o ecrã? **Limpa o campo ou navega para fora antes** de capturar.
- Clicar por coordenadas antes de colar → confirmar primeiro o **foco**, e só o nome:
  `document.activeElement.name || document.activeElement.id` (nunca `.value`).

Verificação depois de escrever: `git check-ignore -v <ficheiro>` tem de acertar, e
`git log -S'<fragmento>' --oneline` (fragmento não-secreto, ex.: o **nome** da variável) tem de dar
vazio. Se o destino é um `.env`/`ini`/`toml`, imitar a forma de uma linha já existente — aspas e
escape variam por parser.

## 2. Duas vias que NÃO funcionam

- **Área de transferência do sistema** (`pbcopy`, `clip.exe`, `xclip`) — é a **mesma** do utilizador.
  Ele copia uma mensagem a meio do fluxo e é essa que vai parar ao campo da password. Já aconteceu.
- **`navigator.clipboard.readText()`** em browser automatizado — pendura à espera do prompt de
  permissão e congela o renderer; a sessão fica presa sem erro.

## 3. Inspeccionar sem despejar

Enumerar campos de um formulário, chaves de um JSON ou linhas de um `.env` devolve **só o nome e se
está preenchido**:

```js
[...document.querySelectorAll('input')].map(i => ({ nome: i.name || i.id, presente: i.value.length > 0 }))
```

```bash
grep -oE '^[A-Z0-9_]+=' .env        # só os nomes das variáveis
```

**Segredo estruturado (JSON aninhado)** — a lista branca é o **caminho**, nunca o valor. `keys[]` só vê o
1.º nível; `paths(scalars)` desce aos blocos aninhados e aos arrays:

```bash
jq -r 'paths(scalars) as $p | "\($p|map(tostring)|join(".")): \(if (getpath($p)|tostring|length) > 0 then "presente" else "vazio" end)"' "$F"
# → identity.pubkey: presente · agents.0.key: presente   (o `length` fica dentro do jq — não se imprime)
```

**Keychain do macOS guarda um JSON inteiro num só item** (caso 2026-09-09: `identity` + N chaves
`agent:<pubkey>` no mesmo segredo). `security find-generic-password -s <serviço>` **sem** `-w`/`-g`
mostra só os atributos do item; com `-w` imprime o segredo. Inspeccionar a forma sem o ecoar:
`security find-generic-password -s <serviço> -w | jq -r 'paths(scalars) | map(tostring) | join(".")'`
— o valor passa pelo pipe e nunca chega ao stdout.

Regras:
- **Nunca** o `value`. **Nunca** propriedade derivada dele — comprimento, prefixo, primeiros/últimos
  caracteres, entropia, hash: descrevem o formato e ajudam a reconstruir a chave.
- **Lista branca de campos a mostrar, nunca lista negra do que ocultar.** Uma lista negra por nome
  (`/pass|token|key|secret/i`) falha em dois casos garantidos: blocos **aninhados** (o filtro só
  varre o 1.º nível) e campos com **nome aleatório** (`input-z3qg3ub`, `type="text"`). Ambos já
  imprimiram credenciais vivas.
- Precisas mesmo do valor? Não precisas — precisas do **efeito**. Testa a autenticação em vez de ler
  a chave.
- Exemplos em documentação são obviamente falsos e curtos: `sk-EXEMPLO`, `AKIAEXEMPLO`.
- **Proibido `cat`/`head`/`tail`/`less`/`Read` a um ficheiro de segredo** (`.env`, `*.key`, `token`,
  `credentials*.json`), mesmo "só para ver a forma". O `grep -oE '^[A-Z0-9_]+='` acima só é seguro
  porque o padrão pára no `=`.
- **Também são ficheiros de credenciais:** `.htaccess` (bloco `# CLOUDLINUX ENV VARS`, linhas
  `SetEnv` — no CloudLinux/Passenger guarda o ambiente da app), `wp-config.php`, `Caddyfile` e unit
  files `systemd` (`Environment=`). Um `cat` ao `.htaccess` do cPanel pôs um `JWT_SECRET` de produção
  no transcript (2026-09-22). Inspecionar só as linhas-alvo (`grep -n 'RewriteRule' .htaccess`) ou
  só os **nomes**, com um padrão que pára antes do valor (lista branca, como o `^[A-Z0-9_]+=` acima):
  `grep -noE '^[[:space:]]*(SetEnv[[:space:]]+[A-Za-z0-9_]+|Environment="?[A-Za-z0-9_]+=|define\([[:space:]]*.[A-Za-z0-9_]+.)' <ficheiro>`.
  Nunca `grep -v` com palavras a esconder: deixa passar `DATABASE_URL=…:<pass>@…` e o hash do
  `basicauth` do Caddy (o bloco do `basicauth` não tem nome a listar — é opaco, ver abaixo).
- **Ficheiro de segredo sem `NOME=` é opaco.** Um ficheiro de 1 linha só com o valor (token solto,
  chave PEM) não tem nomes para listar: um agente mandado «listar os nomes» imprimiu o valor
  (2026-09-14). Devolve-se só `{nome do ficheiro, presente}`:
  ```bash
  test -s "$F" && echo "$(basename "$F"): presente" || echo "$(basename "$F"): vazio/ausente"
  ```
- **Mascarar um `.env` nunca por `sed`/`grep` com regex de dialecto duvidoso.** Um `sed` com `\+`
  (GNU) falhou calado no `sed` BSD do macOS e imprimiu uma chave de API inteira (2026-09-18): o
  comando parecia defensivo e não era. Usar `node`/`python`, que se comportam igual nas duas
  máquinas, e imprimir **só nomes de chave** — nunca a linha mascarada, cujo resultado não se
  confirmou antes de o olhar.
- **Nunca imprimir o ambiente**: `env`, `printenv`, `set`, `export -p`, `console.log(process.env)`,
  `os.environ`, nem em teste de depuração. Um subagente de testes despejou `process.env` inteiro e
  quatro chaves de API ficaram no transcript. Precisas de saber se existe? `node -e
  "console.log('NOME:', !!process.env.NOME)"` — o nome e um booleano, nada mais.

## 4. Rodar uma credencial de serviço vivo — é derrubá-lo

Mudar a password que um processo em execução usa **corta-lhe o acesso no instante em que é aceite**,
mesmo que o comando pareça higiene. É irreversível para efeitos de gate: **confirmar com o
utilizador antes** (`AskUserQuestion` Sim/Não).

Ordem obrigatória, e a via de recuperação confirmada **antes** de mexer:

1. Escrever o novo valor no destino (`.env`, secret manager) — sem reiniciar nada.
2. **Invalidar a cache de config à mão**: Laravel → `rm bootstrap/cache/config.php`.
   ⚠ Nesta altura o `php artisan config:clear` **já não arranca** — o bootstrap precisa da BD e a
   credencial antiga já não serve. É por isso que se apaga o ficheiro, não se corre o comando.
3. Só depois `php artisan optimize` / reiniciar o serviço.
4. Verificar pelo **efeito**: um pedido real ao endpoint, não o build verde nem o 200 da página de
   login.

Fora do Laravel a forma é a mesma: primeiro o valor novo, depois a invalidação da cache que o
processo lê, depois o restart, depois a prova ao vivo. Uma loja esteve ~5 min em baixo por se ter
feito o restart antes do passo 2.

## 5. Se o segredo chegou ao transcript

1. Escrever no destino gitignored (o valor está queimado, mas o serviço tem de continuar a funcionar).
2. `git log -S`/`git status` — confirmar que não entrou no histórico do repo.
3. Dizer ao utilizador que ficou no transcript e **rodar a credencial**. Não é opcional; ver §4 para
   a ordem.
4. Nunca repetir o valor em texto visível nem em relatório de agente.

## Próximo passo (chain)
- Revisão de código que toca auth/segredos → `security` (skill) → `security-review` (agente).
- Repo a caminho de público → `public-release-audit`.
