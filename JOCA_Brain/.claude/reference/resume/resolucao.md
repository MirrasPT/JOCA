# /resume — passo 1: detalhe da resolução por caminho

Lido a partir do `/resume` passo 1 (Prioridade 1). O `memoria-projecto.cjs resolver` já aplica isto; serve para os `grep` à mão e para diagnosticar.

## Família directorio* e realpath

⚠ Um `grep` só com a 1ª forma **não casa** entradas com `directorio: [a, b]` e manda a resolução para
o fallback por nome sem motivo — o campo é lista desde que há projectos em várias máquinas.

⚠ **O campo não é só `directorio:` — é uma família, e um matcher ancorado em `^directorio:` é cego a
quase metade das memórias.** Medido numa instalação real: `directorio:` 70 · `directorio_mac:` 66 ·
`directorio_win:` 58 · `directorio_codigo_mac:` 3 · `directorio_design:` 3 · `directorio_drive:` 3,
mais `_entrega_`, `_conteudo_`, `_arquivo_`. Um `/resume` num projecto activo
devolvia **zero** com o padrão antigo e caía para o fallback por nome sem motivo; com
`^directorio[a-z_]*:` resolve para a entrada certa. O `[a-z_]*` cobre a família toda de uma vez —
incluindo `directorio_codigo_*` para os projectos cujo código e cujo design vivem em pastas
diferentes. Nesse caso, **anunciar os DOIS caminhos** no resumo (código e design/conteúdo), e
ordenar candidatas de pasta-mãe pelo `mtime` do directório de **código**, não da pasta-mãe.
⚠ Excluir `directorio_anterior_*` de um match que decida a resolução — é histórico, não estado.
⚠ **Memória absorvida usa `absorvida_directorio*`** — o `^directorio` ancorado já não a casa, e é de
propósito: a absorvida não é candidata à resolução. Não alargar o padrão para `[a-z_]*directorio`.
Encontrada por nome → carregar a que a absorveu (2g).
⚠ **O grep compara strings, não destinos.** `~/Google Drive/…` (symlink) e `~/Library/CloudStorage/GoogleDrive-<conta>/…`
são a mesma pasta e não casam. Sem match exato, repetir com os dois lados normalizados por `realpath` antes de
descer à Prioridade 2 (forma de 1 path; uma lista compara-se elemento a elemento):
```bash
A=$(realpath "<path-alvo>" 2>/dev/null)
grep -HE '^directorio[a-z_]*:' memory/projects/*/index.md 2>/dev/null | grep -v ':directorio_[a-z_]*anterior' | while IFS= read -r l; do
  f=${l%%:*}; v=${l#*: }; v=${v#\"}; v=${v%%\"*}; v=${v%% #*}
  case "$v" in "~/"*) v="$HOME/${v#\~/}";; esac
  [ -n "$A" ] && [ "$(realpath "$v" 2>/dev/null)" = "$A" ] && echo "$f"
done
```

## directorio em lista

**`directorio:` aceita LISTA.** Um projecto pode viver legitimamente em mais do que um path — quem
alterna entre várias máquinas (ex.: macOS + Windows) tem projectos que existem em mais do que uma. O
frontmatter suporta as duas formas:

```yaml
directorio: /Users/<user>/Projectos/meu-projecto                  # 1 path
directorio: [/Users/<user>/Projectos/meu-projecto, C:\Users\<user>\Projetos\meu-projecto]
```

A Prioridade 1 casa contra **qualquer** elemento da lista. Só se nenhum casar é que se desce ao
fallback por nome — e é aí que o aviso faz sentido.
