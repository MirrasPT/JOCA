---
name: file-organization
description: "Audita uma pasta de ficheiros (assets de design, documentos, exports) e produz um plano de renomeação/reorganização com conteúdo REALMENTE verificado, não adivinhado pelo nome. MUST be invoked when the user says: organizar pasta, arrumar ficheiros, renomear ficheiros, limpar pasta de assets, plano de organização. SHOULD also invoke when: pasta de cliente desorganizada, nomes tipo v1/v2/op1, duplicados de ficheiros, ficheiros soltos na raiz."
triggers: organizar pasta, arrumar ficheiros, renomear ficheiros, limpar pasta, plano de organização, organização de ficheiros, duplicados, ficheiros soltos, nomear assets, rename files, clean up folder, file organization
chain: nenhum — termina no plano aprovado + execução; não encadeia automaticamente
---

# File Organization

Organizar uma pasta de ficheiros reais (design, docs, exports) — não é refactor de código. O valor está em **verificar o conteúdo antes de renomear**, nunca inferir pelo nome actual, e nunca apagar sem aprovação explícita.

## Quando usar

Pedido do tipo "organiza esta pasta", "isto está uma bagunça", nomes genéricos (`v1/v2/v3`, `op1-op4`, `IMG_1234`), pasta de cliente com anos de material acumulado, exports duplicados em formatos diferentes.

**Não é esta skill:** organizar código-fonte (isso é refactor — `laravel-refactor`/`tech-debt-auditor`), nem arrumar `.claude/skills`/repos de código (estrutura já é regida pelo `CLAUDE.md` do projecto).

## Workflow

### 1. Recon — mapear zonas independentes

`find`/`ls` para perceber a árvore e o volume antes de decidir método:
```bash
find . -type f -not -path "*/graphify-out/*" -not -name ".DS_Store" | wc -l
find . -maxdepth 3 -type d
```
Cada subpasta de topo (por projecto/cliente/marca) é uma **zona independente** — candidata a fan-out se o volume justificar (ver secção 5).

### 2. Detectar zonas de exclusão ANTES de propor qualquer rename

Procurar sinais de pipeline activa que renomear parte:
- Scripts que leem nomes fixos: `build.py`, `Makefile`, `package.json` com paths hardcoded, HTML/CSS que referencia asset por nome exacto.
- Pastas `_src/`, `_build/`, `dist/`, `_backup/` junto de um gerador.
- Se existir → **marcar a zona como intocada no plano**, explicar porquê (nome exacto lido por X), e organizar só à volta dela. Não pedir para confirmar — é dado objectivo (grep encontra a referência).

### 3. Abrir o conteúdo real — nunca renomear pelo nome

Regra dura (soul.md): **design tokens contam como factos** — o mesmo vale aqui para nomes de ficheiro. Um nome plausível não é verificação.
- Imagens/SVG/PDF pequenos → `Read()` directamente (o Read tool renderiza imagem/PDF).
- `.ai`/PSD grandes (>15MB) e binários não renderizáveis → não abrem; inferir por metadata (tamanho, data, nome-irmão já verificado) e marcar explicitamente **"não verificado visualmente"** no plano. Nunca fingir que foi aberto.
- Ficheiros `.md`/`.txt`/`.rtf` → ler o conteúdo real, não só o nome.
- Nomes tipo `v1/v2/v3`, `op1-op4`, `(1)/(2)` **quase sempre escondem uma diferença real** (cor, fundo, variante, versão descartada vs escolhida) — abrir todos os candidatos da série e nomear pela diferença encontrada, não manter o índice genérico.

### 4. Detectar duplicados exactos

`md5`/`md5sum` para pares que parecem redundantes (mesma pasta com nomes diferentes, ou pastas irmãs com o mesmo conteúdo):
```bash
md5 "caminho/a" "caminho/b"
```
- **Nunca apagar automaticamente.** Listar o par, apontar qual parece a cópia canónica (mais completa/recente/melhor nomeada) e deixar a remoção pendente de aprovação explícita do utilizador — mesmo que ele tenha aprovado "o plano" em bloco. Apagar é irreversível; renomear/mover não é.
- Ficheiros de metadata órfã do macOS (`._*`, `.DS_Store`) → sinalizar, não abrir, não renomear.

### 5. Fan-out se o volume justificar

Regra de paralelismo do `task-intake.md`: **≥2 zonas independentes → despachar em paralelo**, um `Agent()` por zona, no mesmo turno. Cada agente:
- Recebe a zona (path) + a convenção de nomes a aplicar + a lista do que NÃO tocar (pipelines já identificadas no passo 2).
- Abre o conteúdo real de cada ficheiro da sua zona (passo 3).
- Devolve Markdown: `caminho actual → caminho/nome proposto` + razão, agrupado, mais secção de duplicados encontrados.
- **Não move nem apaga nada** — só inventaria. A execução acontece depois, centralizada, quando o plano estiver aprovado.

Zonas pequenas (poucos ficheiros óbvios) fazem-se inline, sem agente — não vale o custo de ~15x tokens para 3 ficheiros.

### 6. Convenção de nomes (default, ajustar ao projecto)

- minúsculas, hífen, sem espaços/acentos **no nome do ficheiro** (o conteúdo pode ter acentos);
- idioma segue o resto do projecto (não traduzir nomes de marca/produto);
- preservar extensão e semântica existente se já for uma convenção coerente — só corrigir o que estiver mesmo errado (typo, ambíguo, ou nome que não bate com o conteúdo);
- se uma pasta/projecto já tiver convenção própria e consistente (confirmado por amostragem, não suposição), **não a reescrever só por preferência pessoal** — só sinalizar o que quebra o padrão.

### 7. Apresentar o plano

Por omissão: **texto/tabelas directamente no chat**, agrupado por zona, com secção de duplicados destacada no fim. Não publicar como Artifact salvo pedido explícito do utilizador — plano é para leitura e aprovação rápida, não é um deliverable visual.

Incluir sempre: contagem total revista, quantos renames propostos, quantos duplicados, o que ficou intocado e porquê.

### 8. Executar (só depois de aprovação)

- Renomear/mover é reversível → executar sem pedir confirmação extra por ficheiro, uma vez que o plano em si foi aprovado.
- Apagar duplicados → **1 confirmação explícita por grupo**, mesmo que "aplica o plano" tenha sido dito em bloco — a aprovação do plano cobre a reorganização, não a remoção, salvo o utilizador dizer isso de forma inequívoca.
- **Gotcha de filesystem case-insensitive** (macOS local, e a maioria dos mounts de Google Drive/iCloud): `mv Ficheiro.md ficheiro.md` (rename só de maiúscula/minúscula) é tratado como o mesmo ficheiro e o `mv` falha ou não faz nada — silenciosamente, sem erro visível. Passar sempre por um nome temporário:
  ```bash
  mv -n "ANALISE.md" "__tmp_analise.md"
  mv -n "__tmp_analise.md" "analise.md"
  ```
- Usar `mv -n` (no-clobber) sempre — nunca sobrescrever um ficheiro existente sem intenção explícita (regra dura: escrever por cima de um ficheiro existente é irreversível).
- Verificar no fim: `find` a árvore outra vez e confirmar que não sobrou nenhum nome antigo fora das zonas marcadas como intocadas.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Renomear pelo nome do ficheiro sem abrir | Abrir o conteúdo real (imagem/PDF/md) antes de propor nome |
| Apagar duplicados porque "o plano" foi aprovado em bloco | Confirmação explícita por grupo de duplicados, sempre |
| Renomear ficheiros dentro de uma pasta `_src`/`_build` com gerador | Detectar a pipeline primeiro (grep por nomes fixos em scripts), marcar como intocada |
| `mv Nome.md nome.md` numa pasta do Google Drive/macOS | Passar por nome temporário — filesystem case-insensitive trata como o mesmo ficheiro |
| Publicar o plano sempre como Artifact | Chat por omissão; Artifact só se pedido |
| Manter `v1/v2/v3` genérico depois de já ter aberto e visto a diferença real | Nomear pela diferença (cor/fundo/variante), não pelo índice |
