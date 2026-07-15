---
name: personal-comms
description: "Ler, resumir e enviar email + gerir calendario via MCP/CLI JA LIGADOS (sem API custom). MUST be invoked when the user says: ler email, resumir inbox, enviar email, responder email, marcar reuniao, criar evento, agenda, calendario, proximos eventos, lembrete, personal-comms, assistente pessoal de comunicacao."
metadata:
  version: 1.0.0
  origin: local
---

# Personal Comms

Skill do agente `personal-comms` (FUTUROS Fase 2/3). Le, resume e envia email; le e gere calendario. Usa SEMPRE tools ja ligadas (MCP ou CLI) — nunca constroi API/cliente custom, nunca chama provider via HTTP cru.

## Principio Nuclear — Descobrir, Nao Assumir

Nao existe tool fixa garantida para email/calendario neste ambiente. NAO assumir Gmail, Outlook, Google Calendar, nem nome de MCP especifico. Primeiro passo de QUALQUER tarefa: descobrir o que esta efectivamente ligado.

### Anti-fabricacao (forte — herda soul.md Hard Limits)
- NUNCA inventar credenciais, endpoints, tokens, IDs de conta, nomes de MCP ou de tool.
- Sem tool de email/calendario ligada -> NAO improvisar com curl/SMTP/IMAP nem pedir a key inline. Deixar `TODO: tool de email/calendario nao ligada` e REPORTAR ao supervisor/user.
- Detalhe incerto (formato de resposta da tool, campo de data, fuso) -> dize-lo, nao adivinhar.
- Este brief vale tambem quando este agente e spawned: sub-agentes nao herdam soul.md, so o brief.

---

## Passo 1 — Descoberta de Tool

Ordem de verificacao. Parar no primeiro que der match.

1. **Tools MCP carregadas na sessao** — procurar por nome/keyword via `ToolSearch`:
   ```
   ToolSearch query="email send read inbox"     max_results=8
   ToolSearch query="calendar event schedule"   max_results=8
   ToolSearch query="gmail outlook imap smtp"    max_results=8
   ```
   Tools MCP aparecem como `mcp__<servidor>__<accao>`. So sao chamaveis depois do schema vir do `ToolSearch` (deferred tools). Confirmar o schema antes de invocar.

2. **MCP configurados (mesmo que nao expostos ao loop)** — inspeccionar config sem ler segredos:
   - User scope: `~/.claude.json` / `~/.claude/` (procurar bloco `mcpServers`).
   - Projecto: `.mcp.json` / `.claude/settings.json` na raiz do projecto.
   - Listar via CLI: `claude mcp list` (mostra servidores ligados).
   Se houver servidor de email/calendario configurado mas nao exposto ao main loop, ver "Browser/MCP fora do loop" abaixo.

3. **CLI no PATH** — verificar binarios de comunicacao instalados, ex.:
   ```bash
   for c in gam gcalcli himalaya mutt msmtp khal vdirsyncer; do command -v "$c" && echo "found: $c"; done
   ```
   (Lista ilustrativa — confirmar o que existe, nao assumir que algum esta la.)

4. **Nada encontrado** -> `TODO: tool de email/calendario nao ligada` + reportar. NAO continuar.

> Windows: usar `python` (nao `python3` — stub vazio da Microsoft Store). Em PowerShell, `command -v` nao existe -> usar `Get-Command <nome> -ErrorAction SilentlyContinue`.

### Verificar a tool contra resposta real (api-design.md)
Antes de confiar no parsing de output (datas, remetente, ID de evento), fazer 1 chamada real read-only e inspeccionar o shape efectivo. Nao inferir o formato — `tsc`/build nao apanham um campo de data sempre `null`.

---

## Passo 2 — Resumo de Inbox

Quando ha tool de leitura de email ligada.

### Padrao
1. Fetch read-only do periodo pedido (default: nao-lidos das ultimas 24h; confirmar se ambiguo).
2. Agrupar por: **Accao requerida** / **FYI** / **Ruido** (newsletters, automaticos).
3. Por email accionavel, 1 linha: `[remetente] assunto -> accao sugerida`.
4. Nunca colar corpo inteiro — resumir. Identificadores criticos (remetente exacto, ID da mensagem, link) verbatim.
5. Terminar com contagem: `N accionaveis, M FYI, K ruido`.

### Formato de saida
```
ACCIONAVEIS
- [Cliente X] Proposta orcamento -> responder ate sexta
- [Banco]    Pagamento falhado  -> verificar metodo

FYI
- [Newsletter Y] resumo semanal

3 accionaveis, 1 FYI, 12 ruido
```

### Guardrails de leitura
- Read-only por defeito. Marcar como lido / arquivar / apagar = accao com efeito -> confirmar 1 linha antes (GUARD).
- Nao expor conteudo sensivel (codigos 2FA, passwords em emails) em resumos partilhaveis.

---

## Passo 3 — Enviar / Responder Email

Accao com efeito externo, frequentemente irreversivel -> GUARD.

1. **Draft primeiro.** Mostrar destinatario(s), assunto e corpo ao user.
2. Confirmar 1 linha antes de enviar (`enviar? s/n`). Sem confirmacao -> nao enviar.
3. So enviar via a tool descoberta. Sem tool de envio -> `TODO` + reportar; NAO cair para SMTP cru.
4. Replies: preservar thread/`In-Reply-To` se a tool o suportar; nao inventar headers.
5. Tom default: alinhado ao user (pt-pt, terso, profissional) salvo instrucao.

---

## Passo 4 — Deteccao de Eventos

Extrair compromissos de email/texto para sugerir entradas de calendario.

- Sinais: data + hora + verbo de encontro ("reuniao", "call", "almoco", "deadline", "as 15h", "dia 3").
- Output estruturado, NUNCA criar evento sem confirmar:
  ```
  Evento detectado:
    titulo: Call com Cliente X
    quando: 2026-06-25 15:00 Europe/Lisbon
    fonte:  email [Cliente X] "Proposta"
  Criar no calendario? s/n
  ```
- Fuso: assumir `Europe/Lisbon` salvo indicacao; se a fonte for ambigua, dize-lo, nao adivinhar.
- Datas relativas ("amanha", "proxima sexta") -> resolver contra a data actual do ambiente, mostrar a data absoluta resolvida.

---

## Passo 5 — Gerir Calendario

Quando ha tool de calendario ligada.

- **Ler agenda**: "proximos eventos" -> listar janela pedida (default: hoje + 7 dias). 1 linha por evento: `data hora - titulo (local/link)`.
- **Criar evento**: draft -> confirmar -> criar via tool. Campos minimos: titulo, inicio, fim/duracao, fuso. Convidados/local so se pedidos.
- **Conflitos**: ao criar, verificar sobreposicao na janela; se houver, avisar antes de criar.
- **Editar/cancelar**: accao com efeito -> confirmar; usar o ID real do evento devolvido pela tool (nunca inventar ID).

---

## Lembretes

JOCA nao tem scheduler proprio garantido. Para lembretes:
1. Preferir a capacidade nativa da tool de calendario (notificacao/alerta do evento) — e o caminho fiavel.
2. Agendamento recorrente do lado do agente -> so se existir mecanismo de cron/schedule confirmado no ambiente (ex.: `/schedule`, `/loop`). Confirmar que existe antes de prometer; senao `TODO` + reportar.
3. Nunca prometer um lembrete que nenhuma tool ligada consegue disparar.

---

## Browser/MCP fora do loop principal (workflows-and-tooling.md)
Um MCP configurado pode nao estar exposto ao loop principal — so a sub-agentes. Se a config mostra servidor de email/calendario mas nenhuma tool aparece no `ToolSearch` do loop, delegar a accao a um sub-agente que tenha o MCP, com brief que carrega: objectivo, anti-fabricacao, confirmar antes de accoes com efeito. Nao assumir a tool disponivel inline.

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| Assumir Gmail/Outlook/Google Calendar ligado | Descobrir via `ToolSearch` + `claude mcp list` + config |
| Construir cliente IMAP/SMTP/REST custom | So tool MCP/CLI ja ligada |
| Inventar key/endpoint/account ID em falta | `TODO: tool nao ligada` + reportar |
| Enviar email sem confirmar | Draft -> confirmar 1 linha -> enviar |
| Criar evento direto do email | Detectar -> mostrar -> confirmar -> criar |
| Inferir shape do output da tool | 1 chamada real read-only + validar campos |
| Inventar ID de evento para editar | Usar ID real devolvido pela tool |
| Prometer lembrete sem mecanismo | Usar alerta do calendario ou `TODO` + reportar |
| `python3` no Windows | `python` |

---

## Checklist pre-accao
- [ ] Tool de email/calendario CONFIRMADA ligada (ToolSearch / `claude mcp list` / config)
- [ ] Schema da tool MCP carregado antes de invocar
- [ ] Parsing validado contra 1 resposta real
- [ ] Accoes com efeito (enviar/criar/editar/apagar) -> draft + confirmacao
- [ ] Zero credenciais/endpoints/IDs inventados
- [ ] Fuso explicito (Europe/Lisbon default) e datas relativas resolvidas
- [ ] Sem tool -> `TODO` + reportado, NAO improvisado
