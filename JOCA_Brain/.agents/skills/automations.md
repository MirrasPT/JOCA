---
name: automations
description: "Traduzir pedido em linguagem natural numa automacao cron estruturada (QUANDO + O-QUE + REPORTAR) e gerir automacoes.json. Invocar quando o utilizador disser: automacao, automatizar, cron, agendar tarefa, todos os dias as, a cada X horas, resumo automatico, agenda recorrente, tarefa repetitiva. Skill do agente automation-builder (FUTUROS Fase 3)."
compatibility: "JOCA_Brain. Define contrato de dados — NAO implementa o daemon/scheduler (Fase 3 pendente)."
---

# Automacoes — JOCA Fase 3

Traduzir um pedido NL numa automacao estruturada e gerir o ficheiro `automacoes.json`.
Skill do agente `automation-builder`. Estilo cron simples — nao e n8n/Zapier.

**Escopo desta skill:** definir o CONTRATO (schema, gestao, falhas) + traduzir NL → JSON.
**Fora de escopo:** o motor/daemon que dispara no horario nao existe ainda (FUTUROS Fase 3, pendente). Esta skill nao o implementa nem assume que existe.

## Anatomia de uma automacao — 3 partes

Toda a automacao decompoe-se em tres campos. Extrair sempre os tres do pedido NL.

1. **QUANDO** — horario/trigger. Cron OU intervalo. Opcionalmente uma **condicao** ("se X entao reporta").
2. **O-QUE** — a tarefa, em linguagem natural. Passada ao Master para executar.
3. **REPORTAR** — canal de entrega do resultado (`whatsapp`, `joca_ui`, `email`, `sms`, `push`).

### Exemplo de traducao NL → estrutura

Pedido: *"Todos os dias as 9h verifica os meus emails e manda-me um resumo por WhatsApp"*

| Parte | Valor extraido |
|---|---|
| QUANDO | `0 9 * * *` |
| O-QUE | "Verificar emails nao lidos de todas as contas, fazer resumo" |
| REPORTAR | `whatsapp` |

Confirmar sempre os 3 campos ao utilizador antes de gravar.

## Schema — `automacoes.json`

Lista de objectos. Cada automacao:

```json
{
  "id": "auto_resumo_emails",
  "nome": "Resumo de emails diario",
  "schedule": "0 9 * * *",
  "intervalo_min": null,
  "condicao": null,
  "tarefa": "Verificar emails nao lidos de todas as contas, fazer resumo",
  "canal": "whatsapp",
  "enabled": true,
  "report_policy": "sempre",
  "retries": { "max": 2, "backoff_min": 5 },
  "on_failure": "notify",
  "criado_em": "2026-06-21T09:00:00Z",
  "ultima_execucao": null,
  "historico": []
}
```

### Campos

| Campo | Tipo | Obrigatorio | Descricao |
|---|---|---|---|
| `id` | string | sim | identificador unico, slug (`auto_<assunto>`). Estavel — nao muda em edicoes |
| `nome` | string | sim | nome legivel para a UI |
| `schedule` | string\|null | sim* | expressao cron 5 campos (`min hora dom mes dow`). `null` se usar intervalo |
| `intervalo_min` | int\|null | sim* | intervalo em minutos (ex: `240` = a cada 4h). `null` se usar cron |
| `condicao` | string\|null | nao | logica condicional NL ("verificar Y; se Z entao..."). `null` = sem condicao |
| `tarefa` | string | sim | a tarefa NL (parte O-QUE) |
| `canal` | enum | sim | `whatsapp` \| `joca_ui` \| `email` \| `sms` \| `push` |
| `enabled` | bool | sim | `false` = desactivada (nao apagada) |
| `report_policy` | enum | sim | `sempre` \| `so_se_problema` \| `so_se_mudou` |
| `retries` | object | sim | `{ max: int, backoff_min: int }` |
| `on_failure` | enum | sim | `notify` \| `silent` \| `disable` (ver Falhas) |
| `criado_em` | ISO8601 | sim | timestamp UTC de criacao |
| `ultima_execucao` | ISO8601\|null | sim | timestamp UTC da ultima corrida; `null` se nunca correu |
| `historico` | array | sim | entradas de execucao (ver abaixo) |

\* **Exactamente um** de `schedule` / `intervalo_min` deve estar preenchido; o outro `null`. Validar — nunca ambos, nunca nenhum.

### Entrada de `historico`

```json
{
  "ts": "2026-06-21T09:00:12Z",
  "estado": "ok",
  "duracao_s": 8,
  "resumo": "12 emails nao lidos, resumo enviado por WhatsApp",
  "erro": null,
  "tentativa": 1
}
```

| Campo | Valores |
|---|---|
| `estado` | `ok` \| `falha` \| `saltada` (condicao nao cumprida → nao reportou) |
| `erro` | mensagem de erro ou `null` |
| `tentativa` | numero da tentativa (1 = primeira; >1 = retry) |

Guardar resultado de cada execucao para consulta. Logs longos NAO vao para `historico` (so o `resumo`) — o output completo vai para um log a parte (path a definir pelo motor; nao inventar aqui).

## Cron — convencao

5 campos: `minuto hora dia-do-mes mes dia-da-semana`.

| NL | schedule |
|---|---|
| Todos os dias as 9h | `0 9 * * *` |
| Todos os dias as 8h | `0 8 * * *` |
| Todos os dias as 18h | `0 18 * * *` |
| Segunda as 8h | `0 8 * * 1` |
| Sexta as 17h | `0 17 * * 5` |
| Inicio de cada mes | `0 9 1 * *` |

Intervalos curtos/regulares → preferir `intervalo_min` (ex: a cada 4h → `intervalo_min: 240`, `schedule: null`).

## Gestao

Operacoes sobre `automacoes.json`. Edicao surgical — tocar so o objecto certo, preservar o resto.

| Operacao | Accao |
|---|---|
| **Listar** | ler todas; mostrar `nome`, `schedule`/`intervalo_min`, `canal`, `enabled`, `ultima_execucao` |
| **Activar** | set `enabled: true` no objecto por `id` |
| **Desactivar** | set `enabled: false` (para temporariamente sem apagar) |
| **Editar** | alterar `schedule`/`intervalo_min`/`condicao`/`tarefa`/`canal`/`report_policy`. Manter `id` e `historico` |
| **Historico** | ler `historico` do objecto por `id`; quando correu, o que fez, erros |
| **Criar** | extrair 3 partes do NL → construir objecto → confirmar → append a lista |
| **Apagar** | remover objecto por `id` (accao destrutiva — confirmar 1 linha) |

## Retries e tratamento de falha

Quando a tarefa falha (erro do Master, timeout, ferramenta indisponivel):

1. **Retry** — repetir ate `retries.max`, com espera `retries.backoff_min` minutos entre tentativas. Registar cada tentativa no `historico` (`tentativa: N`).
2. **Apos esgotar retries** — aplicar `on_failure`:
   - `notify` — registar `estado: falha` + alertar o utilizador pelo `canal` (default).
   - `silent` — registar `estado: falha` no historico, sem alertar.
   - `disable` — registar falha + set `enabled: false` (parar uma automacao que falha em loop).
3. **Condicao nao cumprida** ≠ falha → `estado: saltada`, sem retry, sem alerta.

`report_policy` controla o reporte em SUCESSO:
- `sempre` — entrega o resultado todas as vezes.
- `so_se_problema` — so reporta se detectar problema (ex: site offline). Sucesso silencioso.
- `so_se_mudou` — so reporta se houver mudanca face a corrida anterior.

## Exemplos completos (FUTUROS Fase 3)

### Resumo de emails — todos os dias as 9h, WhatsApp

```json
{
  "id": "auto_resumo_emails",
  "nome": "Resumo de emails diario",
  "schedule": "0 9 * * *",
  "intervalo_min": null,
  "condicao": null,
  "tarefa": "Verificar emails nao lidos de todas as contas, fazer resumo",
  "canal": "whatsapp",
  "enabled": true,
  "report_policy": "sempre",
  "retries": { "max": 2, "backoff_min": 5 },
  "on_failure": "notify",
  "criado_em": "2026-06-21T09:00:00Z",
  "ultima_execucao": null,
  "historico": []
}
```

### Uptime de sites — a cada 4h, WhatsApp so se houver problema

```json
{
  "id": "auto_uptime_sites",
  "nome": "Verificar sites online",
  "schedule": null,
  "intervalo_min": 240,
  "condicao": "Verificar se os sites configurados respondem 200. Reportar so se algum estiver offline.",
  "tarefa": "Fazer pedido HTTP a cada site monitorizado e validar uptime",
  "canal": "whatsapp",
  "enabled": true,
  "report_policy": "so_se_problema",
  "retries": { "max": 3, "backoff_min": 2 },
  "on_failure": "notify",
  "criado_em": "2026-06-21T09:00:00Z",
  "ultima_execucao": null,
  "historico": []
}
```

### Resumo do dia — todos os dias as 18h, JOCA_OS

```json
{
  "id": "auto_resumo_dia",
  "nome": "Resumo do que foi feito hoje",
  "schedule": "0 18 * * *",
  "intervalo_min": null,
  "condicao": null,
  "tarefa": "Resumir o que foi feito hoje nos terminais",
  "canal": "joca_ui",
  "enabled": true,
  "report_policy": "sempre",
  "retries": { "max": 1, "backoff_min": 5 },
  "on_failure": "silent",
  "criado_em": "2026-06-21T09:00:00Z",
  "ultima_execucao": null,
  "historico": []
}
```

### Cabeleireiro — inicio do mes, condicional, WhatsApp

```json
{
  "id": "auto_cabeleireiro",
  "nome": "Lembrete de corte de cabelo",
  "schedule": "0 9 1 * *",
  "intervalo_min": null,
  "condicao": "Consultar calendario. Se nao ha marcacao de cabeleireiro E o ultimo corte foi ha >=60 dias, perguntar se quer marcar.",
  "tarefa": "Verificar calendario e historico de cortes; sugerir marcacao se aplicavel",
  "canal": "whatsapp",
  "enabled": true,
  "report_policy": "so_se_problema",
  "retries": { "max": 1, "backoff_min": 5 },
  "on_failure": "silent",
  "criado_em": "2026-06-21T09:00:00Z",
  "ultima_execucao": null,
  "historico": []
}
```

## Validacao antes de gravar

- [ ] `id` unico e em formato slug (`auto_*`)
- [ ] Exactamente um de `schedule` / `intervalo_min` preenchido (o outro `null`)
- [ ] `schedule` valido (5 campos cron) se usado
- [ ] `canal` num valor do enum
- [ ] `tarefa` nao vazia
- [ ] `retries.max >= 0`, `backoff_min >= 0`
- [ ] 3 partes (QUANDO/O-QUE/REPORTAR) confirmadas com o utilizador

## Limites e incertezas (nao fabricar)

- **Path de `automacoes.json`** — nao definido na FUTUROS. Confirmar com o utilizador / motor antes de assumir um path. Nao inventar.
- **Daemon/scheduler** — corre em background com JOCA_OS fechado? Servico? PENDENTE na FUTUROS Fase 3. Esta skill nao decide isso.
- **Limites de execucao paralela** (saturacao da quota Claude) — PENDENTE. Nao assumir um valor.
- **Path do log completo** de cada execucao — definido pelo motor, nao por esta skill.

Quando qualquer destes for relevante e nao estiver resolvido: dize-lo explicitamente, nao assumir.
