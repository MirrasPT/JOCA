---
name: unity-gamedev
description: "Unity 6 (LTS) + C# game development — project structure, ScriptableObject-driven data, deterministic rules-engine separation, turn state machines, and Android build/export. Distilled focused skill (NOT a marketplace plugin). MUST be read BEFORE writing Unity/C# gameplay code. Triggers: Unity, C#, MonoBehaviour, ScriptableObject, prefab, build Android, card game engine, jogo Unity, AAB/APK."
metadata:
  type: skill
  category: game-dev
chain: unity-ui, unity-build-android, tester-code
---

# Unity Game Dev (C#)

Skill focada (destilada de packs públicos: Nice-Wolf-Studio/unity-claude-skills, XeldarAlz/everything-claude-unity, The1Studio) — **só o essencial** para construir um jogo Unity (alvo Android), com viés para **card games / TCG**. Sem custo de plugin always-on.

> **Read-first:** antes de escrever qualquer `.cs` de gameplay, ler esta skill. Notify `[skill: unity-gamedev]`.

> **Director — encaminha para especialistas:** esta skill cobre a arquitectura/engine/build base. Para trabalho focado, lê também o especialista certo:
> - UI/apresentação (UGUI/UI Toolkit, prefabs de carta, board, animação, mobile) → **`unity-ui`**
> - Shipping Android (IL2CPP/ARM64, AAB, keystore, gradle, gotchas) → **`unity-build-android`**
> - Correr+verificar um build headless (sem confiar no exit code) → agente **`unity-build-runner`**
> - Card-game design/balanço/arte → `card-game-design` · `game-balance` · `card-art-pipeline` (+ agentes `tcg-balance-auditor` · `card-catalog-sync` · `tcg-playtester`).

---

## 0. Verificar a versão real ANTES de assumir API

Unity muda APIs entre versões. Confirmar no projecto antes de escrever código:
- `ProjectSettings/ProjectVersion.txt` → versão exacta do Editor.
- `Packages/manifest.json` → packages instalados (Input System, Addressables, UI Toolkit, Burst…).
- Alvo: **Unity 6.x LTS** salvo indicação contrária. Não inventar APIs — confirmar contra a versão instalada (mesma regra dos `.d.ts` em `workflows-and-tooling.md`).

---

## 1. Arquitectura — motor de regras ↔ apresentação (CRÍTICO p/ TCG)

A regra #1 de um jogo de cartas: **a lógica de jogo é C# puro (POCO), testável sem Unity.** MonoBehaviours só fazem render + input.

```
Assets/
  Scripts/
    Core/            ← C# PURO (sem UnityEngine): GameState, regras, combate, turnos
      GameState.cs
      Card.cs / Unit.cs / Equipment.cs / EventCard.cs
      CombatResolver.cs
      TurnStateMachine.cs
      Abilities/     ← efeitos (resurrect, buff, block, quick-attack...)
    Data/            ← ScriptableObjects (definições de carta/general)
    View/            ← MonoBehaviours: CardView, BoardView, GeneralView (consomem eventos)
    Input/           ← Input System handlers
  Tests/
    EditMode/        ← testes do Core (NUnit, sem cenas) — alvo do combate/regras
    PlayMode/        ← testes de integração com cenas
```

Porquê: o `mediaval-chess` provou que separar motor↔UI permite testar regras sem render e iterar balanceamento depressa. **Nunca** meter regras de combate dentro de um `MonoBehaviour`.

Comunicação View↔Core: o Core emite eventos (`event Action<...>` ou um event bus simples); a View subscreve. Evitar a View ler/escrever estado directamente.

---

## 2. Dados de carta via ScriptableObject (data-driven)

Cartas/generais = **dados**, não código. Um `ScriptableObject` por definição → designer cria/ajusta no Editor sem recompilar.

```csharp
// Data/CardDefinition.cs
using UnityEngine;

public enum CardType { Unit, Equipment, Event }

[CreateAssetMenu(menuName = "TCG/Card", fileName = "Card_")]
public sealed class CardDefinition : ScriptableObject
{
    public string id;
    public string displayName;
    public CardType type;
    public int goldCost;

    [Header("Unit only")]
    public int attack;
    public int defense;

    public Sprite art;

    // Habilidades referenciadas por id/SO — resolvidas pelo motor, não aqui.
    public AbilityDefinition[] abilities;
}
```

- IDs **string estáveis** (não índices) — sobrevivem a reordenação.
- Runtime: o motor cria instâncias mutáveis (`Card`/`Unit`) a partir da definição imutável (não mutar o SO em runtime — persiste no Editor e corrompe dados).

---

## 3. Turnos = state machine explícita

Modelar o turno como máquina de estados no Core (não com flags soltas):

```
Draw → Main (jogar cartas, pagar gold, on-cost) → Attack (escolher alvos) → End (on-death cleanup, +gold)
```

- Cada transição valida o que é legal (anti-bug + base de testes).
- Habilidades disparam por gatilho: **on-play** (1x ao entrar), **on-cost** (acção paga repetível), **on-death** (ao ir p/ cemitério).

---

## 4. C# / Unity — boas práticas

- `private` por defeito; expor ao Editor com `[SerializeField] private` (não `public`).
- Cache de referências em `Awake`; **nunca** `GetComponent`/`Find` em `Update`.
- Evitar alocações por frame (sem LINQ/`new` em `Update`); usar pools de objectos para cartas/efeitos.
- `sealed` em classes que não são herdadas; `readonly` onde aplicável.
- Coroutines/`async`+`Awaitable` (Unity 6) para sequências de animação — não bloquear o motor de regras.
- Namespaces por camada (`Tcg.Core`, `Tcg.View`).
- **DI leve:** injecção manual via construtor no Core (POCO). VContainer/Zenject só se a complexidade justificar (YAGNI — `skills/yagni.md`).

---

## 5. Testes (EditMode = motor puro)

O Core sem Unity → testável com NUnit em EditMode (rápido, sem abrir cena):

```csharp
using NUnit.Framework;

public class CombatTests
{
    [Test]
    public void Attacker_destroys_target_when_attack_exceeds_defense()
    {
        var atk = new Unit(attack: 4, defense: 2);
        var def = new Unit(attack: 1, defense: 3);
        Assert.IsTrue(CombatResolver.Resolve(atk, def).targetDestroyed); // 4 > 3
    }

    [Test]
    public void Nothing_happens_when_defense_meets_or_exceeds_attack()
    {
        var atk = new Unit(attack: 2, defense: 2);
        var def = new Unit(attack: 0, defense: 2);
        Assert.IsFalse(CombatResolver.Resolve(atk, def).targetDestroyed); // 2 ≥ 2
    }
}
```

Cobrir: combate ATK/DEF, muralhas (1 ataque = 1 muralha; 6º mata), gold por turno, gatilhos de habilidade. Encadeia → `tester-code`.

---

## 6. Build Android (Unity → AAB/APK)

Pré-requisitos (uma vez):
- **Android Build Support** module (via Unity Hub): SDK + NDK + OpenJDK incluídos.
- `Project Settings → Player → Android`: package name (`com.<vendor>.<jogo>`), versão mínima API (24+ típico), `IL2CPP` + `ARM64` (obrigatório p/ Google Play), orientação.
- Keystore p/ release: `Player → Publishing Settings` → criar `.keystore` (guardar password fora do git; **nunca** commitar o keystore nem secrets).

Build por GUI: `File → Build Profiles → Android → Build`.

Build por linha de comando (CI / batchmode):
```bash
"<Unity>/Editor/Unity" -quit -batchmode -nographics \
  -projectPath "C:/Users/<user>/Projetos/tcg" \
  -buildTarget Android \
  -executeMethod BuildScript.AndroidBuild \
  -logFile -
```
Com um `Editor/BuildScript.cs` que chama `BuildPipeline.BuildPlayer(...)`. Para Google Play gerar **AAB** (`EditorUserBuildSettings.buildAppBundle = true`).

> Em Windows, paths com `python`/Git Bash: cuidado com conversão de paths (`MSYS_NO_PATHCONV=1`) — ver `workflows-and-tooling.md`.

---

## 7. `.gitignore` Unity (essencial)

Gerar a partir do template oficial (github/gitignore Unity). Ignorar SEMPRE: `Library/`, `Temp/`, `Obj/`, `Build/`, `Builds/`, `Logs/`, `UserSettings/`, `*.csproj`, `*.sln`, keystores. **Versionar** `Assets/`, `Packages/`, `ProjectSettings/`.

---

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| Regras de combate dentro de MonoBehaviour | Core C# puro, testável em EditMode |
| Carta hard-coded em código | `ScriptableObject` data-driven |
| Mutar o SO em runtime | Instância runtime separada da definição |
| `GetComponent`/`Find` em `Update` | Cache em `Awake` |
| `public` campos para o Inspector | `[SerializeField] private` |
| Assumir API de versão desconhecida | Ler `ProjectVersion.txt` + manifest primeiro |
| Commitar `Library/` ou keystore | `.gitignore` Unity + secrets fora do git |
| Flags soltas para o turno | State machine explícita |
| VContainer/Zenject "porque sim" | DI manual; framework só se justificar (YAGNI) |

## Próximo passo (chain)
Após escrever motor/regras → `tester-code` (rever contra o GDD + padrões). Se o combate/muralhas mudou → re-correr os testes EditMode. Arte de cartas → `img-gen` + `graphic-design`.
