# Delta — Jogos moveis: Unity 6

A via da casa para jogos moveis (doutrina `rules/stack-padrao.md`). Backend, se existir, e Laravel
API — o delta `laravel-livewire.md` cobre essa metade.

## Antes de comecar

As skills `unity-*` (gamedev, ui, build-android) **nao fazem parte de todas as instalacoes JOCA** —
verifica no `memory/SKILL_INDEX.json`. Com elas: seguem-se como qualquer skill de dominio. Sem elas:
o Unity trata-se como stack manual — regista em `docs/DECISIONS.md` e a execucao limita-se ao que e
verificavel por CLI (builds batchmode, testes EditMode/PlayMode).

## O que muda no fluxo

- **E1**: o scaffold e um projecto Unity 6 (LTS), nao `laravel new`. CI: builds batchmode + testes
  Unity; o exit code do batchmode MENTE — verificar pelo log `Build Finished, Result: Success` +
  artefacto no disco, nunca pelo exit code.
- **E2**: o design system e game-art direction (paleta, UI kit, tipografia in-game) — a pagina de
  direccoes do /start serve na mesma; a materializacao e em prefabs/UI Toolkit, nao Tailwind.
- **E4**: os "ecras" sao cenas; os testes preferidos sao PlayMode sobre as regras do jogo (motor
  UI-independent testavel sem cena e a arquitectura a exigir no PRD).
- **Deploy** ⛔: Play Console/App Store — keystore e segredos NUNCA no git.

## PRD de jogo — seccoes extra

Core loop (30s) · economia/progressao · win/lose conditions · monetizacao (se houver — pagamentos
in-app tem regras de loja proprias, nao ifthenpay/Stripe web).
