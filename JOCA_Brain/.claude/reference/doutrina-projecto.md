# Doutrina de projecto — detalhe (on-demand)

Versão comprimida (auto-carregada) em `.claude/rules/pipelines.md` §Doutrina de projecto. Este ficheiro guarda a tabela completa e os porquês. `Read()` quando arrancas/adoptas um projecto ou quando a versão curta não chega.

## Doutrina de projecto — vale SEMPRE, com ou sem `/start`

A forma de trabalho do `/start`/`executar-projeto` é o **modo por omissão de qualquer projecto** —
novo, herdado ou a meio. O `/start` é a porta que a instala de raiz; a ausência dele não a dispensa.

Unidade de trabalho = **issue**. Gate = **GitHub Actions**. Estado partilhado = **`PROGRESSO.md`**.

| Momento | Acção |
|---|---|
| **1ª sessão num projecto sem `PROGRESSO.md`** | Levantamento do disco (`pwd`/`ls`/git/manifestos/`memory/projects/`) → cria `PROGRESSO.md` (formato: `.claude/reference/start/progresso-formato.md`) com o estado **observado** + memória do Brain. Não abras a entrevista completa por tua iniciativa — isso é o `/start`; aqui é uma pergunta só: "o que fazemos a seguir?" |
| Trabalho novo (ideia, bug, ecrã) | `novo-issue` **antes** de código; nada de implementar direto do chat. Sem "Ficheiros prováveis" o issue não está pronto — é o que decide o paralelismo |
| Ecrã/UI que ainda não existe | `preparar-design` (Artifact) → `validar-design` (porteiro) → só então implementar. Desenhar durante a implementação é o que produz o ecrã que destoa |
| ≥3 issues abertos sem plano | `planear-ondas` (milestones + `blocked-by` + `docs/ONDAS.md`) |
| ≥2 issues a implementar | **loop de onda**: implementar (agentes de domínio, paralelo só com "Ficheiros prováveis" disjuntos) → `escrever-testes` **noutra sessão** → `tester-code` → PR `Closes #N` → varredura transversal → gate de runtime → portão humano |
| Decisão técnica tomada (stack, schema, fora-da-casa) | 1 entrada em `docs/DECISIONS.md` — cria o ficheiro se não existir. Decisão sem registo repete-se |
| Gates (lint · testes · build) | correm em **Actions** (skill `github`); à mão só como pré-verificação local |
| Repo sem `.github/workflows/` | criar o CI (`github`) antes de fechar a onda seguinte — gate por convenção não é gate |
| Fecho | `/ship` → PR; o issue fecha pelo PR (`Closes #N`), não à mão |
| Fim de sessão | `PROGRESSO.md` actualizado e **commitado** com o trabalho (`/save` faz o resto) |

**O que NÃO se globaliza:** a entrevista das Fases 1-5, a página de direcções de design, o scaffold
E1 (criar repo/CI/hooks/templates) e o ponto de situação E3 são de **arranque** — só correm no
`/start`/`executar-projeto`. Num projecto a meio, o que já existe **não se recria**: adopta-se.

**⚠ Não inventar documentos.** `docs/PRD.md` só se cria a pedido ou pelo `/start`. `PROGRESSO.md` e
`docs/DECISIONS.md` criam-se quando o trabalho os exige (acima) — os restantes, não.

Projecto novo já traz isto na E1 do `executar-projeto` (passos 7-10). CI verde **não** substitui o
gate de runtime abaixo: prova que compila e que os testes passam, não que funciona.
