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
graphify update .

# Graph do JOCA (toolkit — navegar para a pasta JOCA)
cd <caminho JOCA> && graphify update .
```

Ambos correm incondicionalmente no fim de cada sessão.

### 5. Confirmar

```
✓ Memória actualizada — JOCA/memory/projects/<nome>.md
✓ Graph do projecto actualizado
✓ Graph JOCA actualizado

Sessão guardada.
```
