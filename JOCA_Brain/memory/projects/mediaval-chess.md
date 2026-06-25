---
name: mediaval-chess
description: Jogo de táctica em grelha + deckbuilder (tema medieval) — React + Vite + TS, motor de regras custom
type: project
directorio: C:\Users\renat\Projetos\mediaval_chess
---

**Stack:** React + Vite + TypeScript · Tailwind v4 · Zustand · render 2D CSS Grid (DOM, não Canvas) · motor de regras custom (TS puro)
**Objectivo:** Jogo táctico original com tema medieval — táctica em grelha + deckbuilder (família Duelyst/Faeria/Stormbound). Projecto pessoal.
**Directório:** `C:\Users\renat\Projetos\mediaval_chess`
**Iniciado:** 2026-06-21
**PRD:** PRD.md existe
**Why:** Renato a explorar um design original que cruza táctica em grelha com economia de cartas. Sem objectivo comercial.
**How to apply:** Frontend/jogo → activar `frontend` + cluster React. Manter **separação dura motor↔UI** (motor TS puro, testável sem render). NÃO usar chess.js/stockfish (regras não são de xadrez). Decisões de backend/DevOps → explicar 1 linha antes.

## Conceito (regras-chave)
- Campo **7×9**; territórios linhas 0-1 (J1) e 7-8 (J2); resto neutro.
- Cada jogador coloca um **Castelo**: gera ouro/turno (variável por classe) e é o alvo de vitória (destruir = ganhar).
- Deck de **50 cartas** (peças/terrenos); draw 1/turno + bonus de classe.
- Turno em 2 fases: **Deploy** (pagar ouro p/ colocar cartas) + **Acção** (mover/atacar, 1 acção/peça).
- Peças: atq · vida · alcance/área · movimento · habilidades. Combate subtrai atq à vida; 0 = destruída. Sem retaliação.
- Cartas terreno: ravina (impassável), forte (absorve dano, HP próprio), pântano (passável, slow — Fase 3).
- Classes assimétricas: **Romanos** (mais ouro) vs **Vikings** (mais cartas).

## Habilidades do Castelo
- **Romanos — Império**: +3 ouro/turno
- **Vikings — Saque**: +2 ouro/turno + 1 carta extra/turno

## Pool de cartas actual (13 tipos)
| Classe | Carta | Custo | ATK | HP | Alcance | Movimento |
|--------|-------|-------|-----|----|---------|-----------|
| Romanos | Legionário | 2 | 2 | 5 | 1 | King |
| Romanos | Arqueiro Romano | 3 | 1 | 3 | 2 | Straight:2 |
| Romanos | Centurião | 4 | 2 | 6 | 1 | King |
| Romanos | Escorpião (Siege) | 5 | 3 | 2 | 3 | Straight:1 |
| Romanos | Testudo | 3 | 1 | 8 | 1 | Straight:1 |
| Vikings | Berserker | 3 | 4 | 4 | 1 | King |
| Vikings | Invasor | 2 | 2 | 4 | 1 | Straight:3 |
| Vikings | Muro de Escudos | 3 | 1 | 7 | 1 | Straight:1 |
| Vikings | Lançador de Machado | 3 | 2 | 3 | 2 | Straight:2 |
| Vikings | Jarl (Chefe) | 5 | 4 | 5 | 1 | King |
| Neutro | Ravina | 1 | — | — | — | Impassável |
| Neutro | Forte Temporário | 2 | — | 5 | — | Passável, absorve dano |
| Neutro | Pântano | 1 | — | — | — | Passável (slow engine Fase 3) |

## MVP — Estado actual
**MVP funcional e jogável (hot-seat 2P).** Sessão 2 trouxe:
- Bug corrigido: cartas do J1 cortadas a meio (fix `min-h-0` + `shrink-0` no flexbox)
- Redesign completo para paleta B&W (sem cores medievais blue/red/gold)
- Tabuleiro reduzido 9×10 → 7×9
- Nerf ao arqueiro (alcance 3 → 2)
- 6 novas cartas (3 Romanos + 3 Vikings) + 1 novo terreno
- Habilidades assimétricas do Castelo por classe (economia vs cycling)
- HUD mostra habilidade activa por jogador

## Decisões tomadas
- 2026-06-21: Stack React + Vite + TS, render 2D CSS Grid; motor custom.
- 2026-06-21: MVP = hot-seat 2P, 2 classes, 50 cartas/baralho; separação dura motor↔UI.
- 2026-06-21: `/plan` fechou: deploy só no próprio território; 1 acção/peça/turno; movimento data-driven por tipo; sem retaliação.
- 2026-06-21: Paleta B&W (P0=branco, P1=zinc-400, fundos zinc-900/950).
- 2026-06-21: Tabuleiro 7×9 (era 9×10) — mais compacto, mais decisões táticas precoces.
- 2026-06-21: Castelo dá habilidades diferentes por classe: Romanos +3 ouro/turno; Vikings +2 ouro +1 carta/turno.

## Pendente (Fase 2+)
- IA/bot (P1)
- Multiplayer online (P1)
- Deckbuilder UI (P1)
- Persistência (P1)
- Habilidades especiais nas peças (abilityId registry — desenhado em ARCHITECTURE.md)
- Efeito lento do Pântano no engine (Fase 3)
- Mais classes (além de Romanos/Vikings)
- Animações de combate (`anima` skill)
- Polish visual (assets de imagem, `img-gen` skill)

## Última sessão
2026-06-21 — MVP construído e polido: bug layout corrigido, redesign B&W completo, tabuleiro 7×9, 6 cartas novas, habilidades assimétricas do Castelo.
