# /status — Mostrar limites e uso de recursos do Claude Code

Apresenta o estado actual de rate limits, contexto e modelo em uso do JOCA.

## Passos

### 1. Localizar ficheiro de limites
Ler o ficheiro `rate-limits.json` localizado no directório temporário do sistema operativo:
- macOS/Linux: directório de `os.tmpdir()/joca-ui/rate-limits.json` (geralmente `/tmp/joca-ui/rate-limits.json` ou sob `/var/folders/`)
- Windows: `%TEMP%\joca-ui\rate-limits.json`

Se o ficheiro não existir ou não puder ser lido, mostrar a mensagem:
"Erro: Ficheiro de limites não encontrado. Garanta que o statusline está activo ou corre `/install`."

### 2. Formatar e apresentar
Apresentar uma tabela limpa e compacta com barras de progresso de 10 caracteres (`█` e `░`):

```
STATUS JOCA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Modelo: <model>
Contexto: in: <input_tokens> | out: <output_tokens>
  Barra: [<barra>] <used_pct>%

Limites de Mensagens:
  5 horas:    [<barra>] <used_pct>%  (reseta em: <tempo>)
  7 dias:     [<barra>] <used_pct>%  (reseta em: <tempo>)
  Sonnet 7d:  [<barra>] <used_pct>%  (reseta em: <tempo>)

Actualizado: <data/hora local ou tempo decorrido desde updated_at>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Calcular o tempo restante para o reset com base em `resets_at` (epoch timestamp em segundos) face à hora actual. Se não houver `resets_at` ou se for nulo, omitir a secção `(reseta em: ...)` ou mostrar `(reset: ?)`.
