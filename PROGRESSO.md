# PROGRESSO — JOCA (release público)

> Estado partilhado do projecto. Actualizado pelo JOCA (`/save`).
> Contexto pessoal de cada colaborador vive no Brain do próprio JOCA, não aqui.

## Estado actual

Toolkit maduro e em uso. A publicar por vagas a partir da instalação de trabalho: cada vaga é um
commit em `main` com o que já foi verificado ao vivo. A vaga mais recente (`cc3d6b0`, 2026-09-08) foi
só de `JOCA_OS` — o `JOCA_Brain` não foi tocado.

Próximo passo: portar a vaga de 2026-09-08 para as instalações de trabalho com o `update-os.md`.

> Este projecto nasceu antes do `/start`, portanto não tem as fases S1-S5/E1-E4 de um arranque
> guiado. A tabela abaixo é o que existe de facto, com a prova de cada linha.

## Estado por área

| Área | Estado | Prova |
|---|---|---|
| Motor (`JOCA_Brain/`) | ✅ publicado | 152 skills · 105 agentes · 29 comandos em `JOCA_Brain/.claude/` |
| Interface (`JOCA_OS/`) | ✅ publicado | `cc3d6b0` · `cd JOCA_OS/backend && npm test` → 67 testes, 7 ficheiros |
| Instalação de raiz | ✅ | `install.md` |
| Update completo (motor + interface) | ✅ | `update.md` |
| Update só da interface | ✅ 2026-09-08 | `update-os.md` |
| Consolidar instalações antigas | ✅ | `clean-install.md` |
| Testes do frontend | ⬜ **não existem** | `JOCA_OS/frontend/src` sem ficheiros de teste |
| CI | ⬜ **não existe** | sem `.github/workflows/` |

## Diário (mais recente primeiro)

- 2026-09-08 · macOS · `JOCA_OS`: retrato das sessões em disco — reiniciar o backend deixa de fazer
  as conversas desaparecerem sem explicação, e o output que tinham fica legível. Caixa de escrita
  colapsável, `Save all` no dashboard, `start.sh`/`stop.sh` a deixarem de confundir clientes de uma
  porta com o servidor dela, e o `update-os.md`. Renderer WebGL medido e recusado (bench fica em
  `JOCA_OS/frontend/bench/`). → `cc3d6b0`
- 2026-08-20 · macOS · UI do chat reordenada, subsistema de Automações removido, bridges
  `AGENTS.md`/`GEMINI.md` compiladas do canónico, e 4 skills que só existiam localmente publicadas.
  → `bde0032`
- 2026-08-19 · macOS · Limpeza da cauda que ficou depois de sair o subsistema de Tarefas. → `be16f5c`
- 2026-08-13 · macOS · Dois defeitos reportados e corrigidos: allowlist de anexos a recusar `.svg`
  em silêncio, e o botão `enviar` ilegível no tema escuro. → `13fa294`
