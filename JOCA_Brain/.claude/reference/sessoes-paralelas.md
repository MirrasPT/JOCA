# Sessões paralelas — protocolo completo (on-demand)

Resumo auto-carregado em `.claude/rules/orchestration-patterns.md` §5b. `Read()` quando descobres outra sessão Claude no mesmo repo/projecto.

### 5b. Sessões paralelas (dois Claude no mesmo repo)

Não são subagentes — são **pares**, cada um com o seu main loop. Já aconteceu várias vezes (JOCA_OS
multi-worker, duas sessões no mesmo site, duas na mesma instalação) e correu bem só porque as sessões
inventaram, sozinhas e por acaso, o mesmo protocolo. Codificado:

- **Handshake ao descobrir um par:** path onde estou · o que vou fazer · ficheiros que tenho sujos.
- **Fronteira por directório.** Leitura livre; escrita só no meu território. Tocar em ficheiro alheio
  exige aviso antes. Dois workers na mesma árvore já reverteram trabalho intencional um do outro
  (`AppShell.jsx` acabou com edições dos dois misturadas — e o build compilava à mesma).
- **Estado partilhado avisa-se sempre:** BD, portas, ficheiros de configuração, `~/CLAUDE.md`.
- **Ficheiro partilhado edita-se com `Edit` cirúrgico, nunca `Write`.** Reler antes de escrever. Um
  `Write` no `memory/projects/<x>.md` teria apagado o trabalho da outra sessão — só se soube porque o
  `Edit` avisou "the file had been modified on disk".
- **Endereçar: os nomes do `ListAgents` são opacos** (`joca-brain-be`, `joca-brain-dc`) e **não**
  identificam projecto nem sessão — uma mensagem endereçada por nome foi parar à sessão errada. O
  endereço fiável é o socket do `from=` de quem escreveu (`uds:/tmp/cc-socks/NNNNN.sock`). Responder
  sempre por aí; usar o nome só para iniciar contacto, e confirmar quem é antes de assumir contexto.
- **Artefactos por sessão, não por repo.** Checkpoints, filas e `.joca/intermediate/` derivados do
  repo do cwd colidem entre sessões — o `latest` passa a devolver o da outra. Derivar do **projecto**.

