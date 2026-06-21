---
name: mediaval-chess
description: Jogo de táctica em grelha + deckbuilder (tema medieval) — React + Vite + TS, motor de regras custom
type: project
directorio: C:\Users\renat\Projetos\mediaval_chess
---

**Stack:** React + Vite + TypeScript · render 2D (Canvas/DOM) · motor de regras **custom** (sem chess.js/stockfish)
**Objectivo:** Jogo táctico original com tema medieval — táctica em grelha + deckbuilder (família Duelyst/Faeria/Stormbound). Projecto pessoal.
**Directório:** `C:\Users\renat\Projetos\mediaval_chess`
**Iniciado:** 2026-06-21
**PRD:** PRD.md existe — actualizar via skill `prd` no /save
**Why:** Renato a explorar um design original que cruza táctica em grelha com economia de cartas. Sem objectivo comercial.
**How to apply:** Frontend/jogo → activar `frontend` + cluster React. Manter **separação dura motor↔UI** (motor TS puro, testável sem render). NÃO usar chess.js/stockfish (regras não são de xadrez). Decisões de backend/DevOps → explicar 1 linha antes (Renato a aprender backend).

## Conceito (regras-chave)
- Campo **9×10**; territórios linhas 1-2 (J1) e 9-10 (J2); resto neutro.
- Cada jogador coloca um **Castelo**: gera **ouro**/turno e é o alvo de vitória (destruir = ganhar).
- Deck de **50 cartas** (peças/terrenos/eventos); draw 1/turno.
- Turno em 2 fases: **Deploy** (pagar ouro p/ colocar cartas) + **Acção** (mover/atacar).
- Peças: atq · vida · alcance/área · movimento · habilidades. Combate subtrai atq à vida; 0 = destruída.
- Cartas não-peça: terrenos persistentes (ravina impassável; forte que absorve dano) + eventos (one-shot).
- Classes assimétricas (Romanos, Vikings).

## MVP (P0)
Hot-seat 2 jogadores · 2 classes (Romanos vs Vikings) · ~10-15 cartas + 1-2 terrenos + 1 evento · motor de regras + UI 2D.
Fora do MVP (P1): IA/bot, multiplayer online, deckbuilder UI, persistência, +classes, polish/anima.

## Estado actual
Iniciado via /init-project (2026-06-21). Pasta vazia — só PRD.md + CLAUDE.md criados. **Sem código ainda** (sem `package.json`, sem scaffold Vite). Próximo passo: `/plan` para fechar open questions de regras + arquitectura do motor, depois scaffold.

## Decisões tomadas
- Stack React + Vite + TS, render 2D; motor de regras custom (não xadrez).
- MVP = hot-seat 2P, 2 classes, ~10-15 cartas.
- Separação dura motor↔UI (motor TS puro, testável).

## Pendente
- Fechar open questions de regras (Q1-Q8 no PRD): ouro/acumulação, mão, zonas de deploy, acção por peça, padrão de movimento, retaliação, valores do castelo, identidade Romanos/Vikings.
- `/plan` arquitectura do motor + scaffold Vite.
- Decidir deploy (indeciso).
