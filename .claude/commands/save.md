# /save — Guardar estado da sessão

Corre no fim de cada sessão de trabalho. Actualiza a memória do projecto e os knowledge graphs.

## Passos

### 1. Identificar projecto actual
Verificar em que pasta estamos. Encontrar `JOCA/memory/projects/<nome>.md`.

### 2. Perguntar ao utilizador (se não for óbvio)
- O que foi feito nesta sessão?
- Alguma decisão importante tomada?
- O que fica pendente?

### 3. Actualizar `JOCA/memory/projects/<nome>.md`
Actualizar as secções:
- **Estado actual** — descrição breve do estado presente
- **Decisões tomadas** — append com data
- **Pendente** — substituir com lista actual

### 4. Actualizar knowledge graphs

```bash
# Graph do projecto (directório actual do projecto)
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('<path-projecto>'))"

# Graph do JOCA
python3 -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"
```

Nota: o CLI `graphify` tem bugs (sintaxe `graphify . --update` não existe; `graphify update <path>` falha em projectos HTML-only). Usar sempre a API Python directamente.

Ambos correm incondicionalmente no fim de cada sessão.

### 5. Confirmar

```
✓ Memória actualizada — JOCA/memory/projects/<nome>.md
✓ Graph do projecto actualizado
✓ Graph JOCA actualizado

Sessão guardada.
```
