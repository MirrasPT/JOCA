---
name: pacote-entrega
origin: local
description: "Preparar um pacote de código executável para uma pessoa de fora (testadora externa, colega, cliente) instalar e correr sozinha, sem acesso a esta máquina nem ao ambiente actual. MUST be invoked when the user says: pacote de testes, preparar entrega para terceiro, enviar o projecto para alguém testar, zip para o cliente instalar, pacote executável, mandar o código para fora. SHOULD also invoke when: vai sair um ZIP/tarball de um repo para quem não tem o ambiente de dev montado, ou é preciso escrever instruções de instalação para quem não programa. MUST NOT: publicar/empurrar um repo para outro remoto (isso é `public-release-audit`)."
triggers: pacote de testes, pacote executável, preparar entrega para terceiro, enviar projecto para testar, zip para o cliente, mandar código para fora, instalação de prova, pasta limpa antes de enviar, LEIA-ME instalação
chain: public-release-audit
---

# pacote-entrega — o gate é instalar de raiz numa pasta limpa

Montar isto à mão (escolher o que entra, cortar segredos, escrever instruções) é fazível; o que falha
é saltar a **instalação de prova**. Sem ela só se sabe que os ficheiros foram copiados — não que o
pacote arranca. Da última vez que se saltou, a testadora ficava logo bloqueada por dois defeitos que
só a instalação a frio apanhou: emails presos numa fila sem worker, e dados de teste velhos na base a
confundir o que era para testar.

## Passo 1 — Inventário e exclusões

Copiar o repo de trabalho, cortando:
- `node_modules/`, `vendor/`, `.git/`, `dist*/` — regeram-se na instalação.
- Backups (`*.bak*`, cópias `-antes-*`) e symlinks locais (ex.: `public/storage` apontado para a
  máquina de origem — a testadora não tem o mesmo caminho).
- Qualquer ficheiro com caminho absoluto da máquina de origem em texto (`grep -rl "/Users/\|C:\\\\Users\\\\" .` —
  ficheiros de `docs/` já apareceram assim e não servem a quem instala noutra máquina).
- `.env` real — nunca vai; ver Passo 2.

## Passo 2 — `.env` de exemplo por lista branca

Nunca copiar o `.env` real e apagar valores à mão — falta sempre uma variável. Construir de raiz, uma
linha por variável **conhecida como necessária** (lista branca), com placeholder óbvio
(`MAIL_PASSWORD=`, `STRIPE_SECRET_KEY=<a-tua-chave>`). Confirmar onde o projecto lê o `.env` antes de
decidir a estrutura de pastas do pacote — projecto com múltiplos sub-serviços (`backend/`+`frontend/`)
pode ter um único `.env` na raiz que serve os dois; pô-lo no sítio errado falha tudo sem dizer porquê.

## Passo 3 — Varredura de segredos

Mesmos padrões do `public-release-audit` (`Read(".claude/skills/public-release-audit.md")` passo
"Checklist dura" #7/#7b) — mas aqui o alvo é a **pasta do pacote**, não o índice git:
```bash
grep -rnE '/Users/[a-z]|C:\\Users\\|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY' pacote/
```
Zero hits antes de zipar. Um hit num ficheiro de `docs/` não é aceitável só porque "é interno".

## Passo 4 — Os 4 documentos (escritos de raiz, não copiados)

| Ficheiro | Conteúdo |
|---|---|
| `LEIA-ME.md` | Instalação passo a passo para quem **não programa** — comandos literais, sem jargão |
| `ESTADO.md` | O que funciona / o que já se sabe que está mal (poupa à testadora reportar o que já é conhecido) |
| `PROMPT-CLAUDE-CODE.md` | Se a testadora tiver Claude Code do lado dela: o texto exacto para colar, com o contexto que precisa |
| `.env.exemplo` | Do Passo 2 |

## Passo 5 — Instalação de prova numa pasta limpa (GATE OBRIGATÓRIO)

Não avança sem isto. Copiar o pacote para uma pasta nova (fora do repo de trabalho) e instalar do
zero, como se fosse a testadora:

1. Instalar dependências (`composer install` / `npm install` / equivalente da stack).
2. Gerar o que falta (`key:generate`, `storage:link`, migrações + seed de configuração — nunca seed
   de dados de teste).
3. Arrancar e confirmar **sem erros de consola nem pedidos ≥400** na home.
4. **Fazer o percurso real da testadora, não só abrir a página**: login com credencial do pacote,
   registo de conta nova, e — se o fluxo tiver confirmação por email — extrair o link do log e
   confirmar a conta de verdade. Um 200 na página de login não prova que o login funciona.
5. Se algo travar aqui, o pacote NÃO sai — corrige-se e repete-se o Passo 5, não se avisa a
   testadora do defeito conhecido.

**Verificar a base de dados antes de empacotar, não depois:** uma BD "limpa" pode ainda ter sessões,
tokens ou jobs de fila antigos — contar linhas nas tabelas de utilizadores/sessões/jobs e confirmar
que só sobra o mínimo (1 utilizador admin, 0 dados de teste). Se o fluxo depende de fila
(`QUEUE_CONNECTION=database`/similar) e não há worker a correr no ambiente da testadora, o email
nunca chega nem ao log — para pacote de teste, mudar para modo síncrono (`QUEUE_CONNECTION=sync`) e
o mail para log, e dizê-lo no `ESTADO.md`.

## Passo 6 — zip + verificação do zip

Zipar a pasta já validada (não a original) e confirmar o conteúdo do zip em si — abrir e listar,
não confiar no comando de compressão:
```bash
unzip -l pacote.zip | grep -E 'node_modules|vendor|\.git/|\.bak'   # tem de dar vazio
```

## Gotchas medidos

- Ligação de confirmação extraída de um log pode aparecer **duas vezes** (uma com `&amp;`, que não
  funciona) e com um carácter colado a mais no fim — conferir a ligação limpa antes de a testar.
- Botão/funcionalidade visível na UI mas sem a chave configurada (ex.: login social) falha em
  **qualquer** ambiente, não só no da testadora — documentar em `ESTADO.md` em vez de deixar
  descobrir sozinha.
- Ferramenta de envio de ficheiro por chat pode não anexar por comando simples de alto nível; a via
  que funciona é por API em 3 passos (canal → upload → post).

## Relatório

```
PACOTE-ENTREGA — <projecto> → <destinatário anonimizado>
Exclusões: node_modules/vendor/.git/backups/symlinks — cortados ✓
.env.exemplo: N variáveis, por lista branca ✓
Varredura de segredos: 0 hits ✓ | N hits — CORRIGIR antes de zipar
Documentos: LEIA-ME · ESTADO · PROMPT-CLAUDE-CODE · .env.exemplo ✓
Instalação de prova (pasta limpa): arranca ✓ | login real ✓ | registo+confirmação ✓
BD: sem dados de teste residuais ✓
Zip verificado (sem node_modules/vendor/.git) ✓
VEREDICTO: pronto a enviar | NÃO enviar — <razão>
```

## Próximo passo (chain)
- Antes do Passo 3, reler a checklist de PII do `public-release-audit` se o pacote incluir também
  histórico git (o `.git/` normalmente fica de fora — se por algum motivo tiver de entrar, correr a
  auditoria completa, não só o grep local).
- Hit de credencial real na varredura → `credential-handling` (rodar antes de enviar, nunca só
  ocultar no pacote).
