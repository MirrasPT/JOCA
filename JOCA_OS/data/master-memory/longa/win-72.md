# Update de CLIs (codex/agy) via workers JOCA + automações matinais

TAGS: JOCA, codex-cli, antigravity-cli, workers, automações, CLIs
JANELA: win-72 (8 turnos)

Sessão de manutenção de CLIs comandada pelo Renato ao JOCA (Master orquestrador), executada via workers Claude Code.
Worker `92b7d69b-22dc-4728-9563-d3e8ab50c369` correu `codex update` com sucesso → confirmou `codex-cli 0.142.2`.
Houve um warning não-fatal `EPERM` no cleanup ao apagar o `codex.exe` antigo (estava em uso); não afectou a instalação.
Worker `4237e8a7-81d5-491b-a0d1-ff118e5da68f` ficou intocado, em estado `working`, durante toda a sessão.
Renato pediu para verificar o Antigravity CLI (`agy`): está em `1.0.12` (release oficial mais recente, 2026-06-24); `agy update` devolveu `already on the latest version`, logo sem update a fazer.
O binário `antigravity` separado não está instalado nesta máquina.
Ficou por concluir a verificação de login/auth do `agy`: o probe ficou preso em `agy models` e não deu estado limpo antes de os scans serem cortados.
Correram em paralelo duas automações agendadas: smoke test (resultado `ola-automacao`) e "Resumo Matinal" (2 promoções: Lidl até 50% e TMNT grátis no mobile via IsThereAnyDeal).
Preferência do Renato: pedir updates imediatos quando há versão nova e mandar fazê-los logo ("faz-lo agora").