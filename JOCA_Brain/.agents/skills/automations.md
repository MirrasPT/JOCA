---
name: automations
description: "Traduzir pedido em linguagem natural numa automacao cron estruturada (QUANDO + O-QUE + REPORTAR) e gerir automacoes.json. Invocar quando o utilizador disser: automacao, automatizar, cron, agendar tarefa, todos os dias as, a cada X horas, resumo automatico, agenda recorrente, tarefa repetitiva. Skill do agente automation-builder."
compatibility: "JOCA_Brain. Documenta o schema REAL do motor de automacoes do JOCA_OS (backend/src/automations/). Motor implementado — nao editar automacoes.json a mao com o JOCA_OS aberto."
---

# Automacoes — motor JOCA_OS

Traduzir um pedido NL numa automacao estruturada do motor real do JOCA_OS.
Skill do agente `automation-builder`. Estilo cron simples — nao e n8n/Zapier completo, mas o modelo e o mesmo: pipeline linear de nodes com um trigger.

**Motor real:** `JOCA_OS/backend/src/automations/` (source of truth do schema: `store.ts`).
**Ficheiro:** `JOCA_OS/data/automacoes.json` (DATA_DIR do backend; escrita atomica; nunca commitado).
**Regra:** criar/editar automacoes de preferencia via UI/API do JOCA_OS — o backend faz upsert atomico e re-agenda (`nextRunAt`). Edicao manual do JSON so com o JOCA_OS parado.

## Anatomia de uma automacao — 3 partes

Todo o pedido NL decompoe-se em tres partes. Extrair sempre as tres antes de construir o objecto.

1. **QUANDO** → `trigger`. Agendada (`schedule`: diaria/semanal/intervalo) ou manual (disparada pelo utilizador — uma "Accao").
2. **O-QUE** → `nodes`. Pipeline linear de passos; o output de cada node passa ao seguinte como `{{input}}`.
3. **REPORTAR** → node final `message` — entrega o resultado como notificacao na UI do JOCA_OS.

### Exemplo de traducao NL → estrutura

Pedido: *"Todos os dias as 9h verifica os meus emails e manda-me um resumo"*

| Parte | Valor |
|---|---|
| QUANDO | `trigger: { type: "schedule", schedule: { kind: "daily", time: "09:00" } }` |
| O-QUE | node `worker` com `objective: "Verificar emails nao lidos de todas as contas, fazer resumo"` |
| REPORTAR | node `message` com `text: "{{input}}"`, `title: "Resumo de emails"` |

Confirmar sempre as 3 partes com o utilizador antes de gravar.

## Schema — `Automation`

Lista de objectos em `automacoes.json`. Cada automacao:

```json
{
  "id": "uuid",
  "name": "Resumo de emails diario",
  "enabled": true,
  "model": "haiku",
  "skills": ["personal-comms"],
  "requireConfirm": false,
  "trigger": { "type": "schedule", "schedule": { "kind": "daily", "time": "09:00" } },
  "nodes": [
    { "id": "uuid", "type": "worker", "objective": "Verificar emails nao lidos, fazer resumo" },
    { "id": "uuid", "type": "message", "title": "Emails", "text": "{{input}}" }
  ],
  "nextRunAt": null,
  "lastRunAt": null,
  "lastStatus": null,
  "lastResult": "",
  "createdAt": 1750000000000
}
```

### Campos

| Campo | Tipo | Obrigatorio | Descricao |
|---|---|---|---|
| `id` | string | sim | UUID gerado pelo backend (`randomUUID`). Estavel — nao muda em edicoes |
| `name` | string | sim | nome legivel para a UI (max 120 chars) |
| `enabled` | bool | sim | `false` = desactivada (nao apagada; nao agenda `nextRunAt`) |
| `model` | string | nao | modelo dos nodes `llm` (ex: `sonnet` \| `opus` \| `haiku`); omitido = default |
| `skills` | string[] | nao | skills/agentes do JOCA_Brain a usar (injectados como directiva ao agente; max 20) |
| `requireConfirm` | bool | nao | PARA antes de accoes irreversiveis (envio/apagar/deploy) e pede OK |
| `trigger` | object | sim | `{ type: "schedule" \| "manual", schedule? }` — ver Trigger |
| `nodes` | array | sim | pipeline linear de nodes — ver Nodes |
| `nextRunAt` | number\|null | motor | epoch ms da proxima corrida (calculado pelo backend — nao preencher a mao) |
| `lastRunAt` | number\|null | motor | epoch ms da ultima corrida |
| `lastStatus` | enum\|null | motor | `ok` \| `error` \| `running` \| `null` (nunca correu) |
| `lastResult` | string | motor | resumo/output da ultima corrida |
| `createdAt` | number | sim | epoch ms de criacao |

**Accao** = automacao com `trigger.type: "manual"` + input em runtime — dispara-se da UI quando se quer, nao por horario.

### Trigger / Schedule

`trigger.type: "schedule"` exige `trigger.schedule`:

| Campo | Tipo | Usado em | Descricao |
|---|---|---|---|
| `kind` | enum | sempre | `daily` \| `weekly` \| `interval` |
| `time` | string | daily/weekly | `"HH:MM"` hora LOCAL (default `09:00`) |
| `weekday` | int | weekly | `0`=Dom … `6`=Sab (default `1`=Seg) |
| `everyMinutes` | int | interval | intervalo em minutos (ex: `240` = a cada 4h; min 1) |

| NL | schedule |
|---|---|
| Todos os dias as 9h | `{ "kind": "daily", "time": "09:00" }` |
| Segunda as 8h | `{ "kind": "weekly", "weekday": 1, "time": "08:00" }` |
| Sexta as 17h | `{ "kind": "weekly", "weekday": 5, "time": "17:00" }` |
| A cada 4 horas | `{ "kind": "interval", "everyMinutes": 240 }` |

Nao ha expressao cron nem agenda mensal — pedido de "inicio do mes" nao e representavel hoje; dizer isso ao utilizador em vez de aproximar em silencio.

### Nodes

Pipeline LINEAR — corre por ordem; `{{input}}` referencia o output do node anterior.

| `type` | Campos | O que faz |
|---|---|---|
| `worker` | `objective` | passo agentico — abre um worker Claude Code dedicado (terminal real, sem projecto) com este objectivo |
| `llm` | `prompt` | passo de texto barato — prompt directo ao brain (sem terminal); pode usar `{{input}}` |
| `shell` | `command`, `cwd?` | corre comando local, captura stdout (local-first, maquina do utilizador) |
| `http` | `url` | GET ao URL, captura o body (truncado) |
| `message` | `text`, `title?` | OUTPUT — entrega texto como notificacao na UI; pode usar `{{input}}` |

Cada node tem `id` proprio (UUID; o backend gera se faltar).

Escolha de node para O-QUE: tarefa agentica/multi-passo → `worker` · transformacao/resumo de texto → `llm` · comando conhecido → `shell` · verificar endpoint → `http`. REPORTAR → terminar com `message`.

## Gestao

Preferir a UI/API do JOCA_OS (upsert atomico + re-agendamento + broadcast WS `automations_changed`).

| Operacao | Accao |
|---|---|
| **Listar** | mostrar `name`, trigger (kind/time/intervalo), `enabled`, `lastStatus`, `lastRunAt` |
| **Activar/Desactivar** | toggle `enabled` (desactivar para temporariamente sem apagar) |
| **Editar** | alterar trigger/nodes/skills/model/requireConfirm. Manter `id` |
| **Executar ja** | trigger manual da UI (qualquer automacao pode ser disparada a mao) |
| **Criar** | extrair 3 partes do NL → construir objecto → confirmar → POST /automations |
| **Apagar** | remover por `id` (destrutivo — confirmar 1 linha) |

## Validacao antes de gravar

- [ ] `name` nao vazio
- [ ] `trigger.type: "schedule"` → `schedule.kind` valido + campos do kind (`time` HH:MM / `weekday` 0-6 / `everyMinutes` >= 1)
- [ ] `nodes` nao vazio; cada node tem o campo do seu `type` (`objective`/`prompt`/`command`/`url`/`text`)
- [ ] REPORTAR coberto — em regra o ultimo node e `message`
- [ ] Accao irreversivel na tarefa (envios, deletes, deploy) → `requireConfirm: true`
- [ ] 3 partes (QUANDO/O-QUE/REPORTAR) confirmadas com o utilizador
- [ ] Campos do motor (`nextRunAt`, `lastRunAt`, `lastStatus`, `lastResult`) — nao preencher a mao

## Em desenvolvimento (nao assumir que existe)

O motor esta a ganhar `retries`/`catchUp` por automacao e um heartbeat do scheduler. Ate estarem no `store.ts`, nao gerar esses campos nem prometer o comportamento — confirmar primeiro no codigo.

## Futuro (nao implementado)

Ideias da fase de design antigo que NAO existem no motor — nao gerar, nao prometer:

- **Canais externos** de reporte (`whatsapp`, `email`, `sms`, `push`) — hoje o output e so notificacao na UI (`message`).
- **Cron 5 campos** e agendas mensais — hoje so `daily`/`weekly`/`interval`.
- **`condicao` NL + `report_policy`** (`sempre`/`so_se_problema`/`so_se_mudou`) — logica condicional de reporte.
- **`historico[]` de execucoes** — hoje guarda-se apenas a ultima corrida (`lastRunAt`/`lastStatus`/`lastResult`).

Se o utilizador pedir um destes: dizer que nao existe ainda e propor o equivalente real (ex: condicao dentro do `objective` do worker + `message` final).
