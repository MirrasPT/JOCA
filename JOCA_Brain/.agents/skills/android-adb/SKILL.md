---
name: android-adb
description: "Manage a connected Android device (or emulator) via adb — install/launch/uninstall apps, push/pull files under /sdcard, read internal app data, free up storage, grant runtime permissions, and debug UI state without a GUI. MUST invoke when the user says: adb, android device, gestão de dispositivo Android, ligar o telemóvel por adb, adb push, adb pull, adb shell, adb install, /sdcard, scoped storage, backup de app Android, espaço livre no telemóvel, instalar APK no telemóvel. SHOULD also invoke when: dumpsys, diskstats, df -h, run-as, INSTALL_FAILED_UPDATE_INCOMPATIBLE, pm grant, uiautomator, monkey launcher, resolve-activity, logcat Android, MSYS_NO_PATHCONV, keystore de debug por máquina."
triggers: coordenadas de toque android, input tap, uiautomator dump bounds, screencap, adb, android device, /sdcard, scoped storage, diskstats, dumpsys, run-as, backup de app android, espaço livre android, APK no telemóvel, logcat, pm grant, uiautomator, monkey launcher, resolve-activity, cmd package, MSYS_NO_PATHCONV, INSTALL_FAILED_UPDATE_INCOMPATIBLE, keystore de debug
origin: local
chain: android-compose
---

# Android — gestão de dispositivo por adb

Telemóvel/emulador Android já ligado (USB ou já emparelhado), operado por `adb`/`adb shell` sem
GUI. Não cobre desenvolvimento nativo (Compose/Kotlin) nem builds — para isso, `android-compose`
(Kotlin/Compose) ou o passo de build do stack do projecto (ex.: `unity-build-android`, se instalada).

## 0. Ligar (uma vez)
- Activar **Depuração USB** no dispositivo e autorizar a chave RSA no popup que aparece ao ligar o cabo.
- `adb devices` tem de listar `device`, não `unauthorized` (popup por autorizar) nem `offline`
  (recomeçar o cabo/porta).
- **Windows/Git Bash:** `export MSYS_NO_PATHCONV=1` antes de qualquer comando com caminho `/sdcard/...`
  — sem isto o Git Bash reescreve o caminho para uma forma Windows e o `adb shell` falha em silêncio.
- **O `adb.exe` não entende caminhos MSYS no destino.** `adb pull … "/g/O meu disco/…"` falha com
  `cannot create file` mesmo a pasta existindo (o `ls` do Bash vê-a, o `adb` não). Usar a forma Windows:
  `"G:/O meu disco/…"`.

## 1. Storage — os dois instrumentos que mentem

### `dumpsys diskstats` mente depois de uma limpeza
Os valores por-app vêm de `/data/system/diskstats_cache.json`, reescrito só por uma tarefa **diária**
que corre com o telemóvel a carregar e parado — forçá-la por `cmd jobscheduler run -f android <id>`
não a fez correr (medido 2026-08-29). **Medir espaço sempre por `df -h /data`** (sistema de ficheiros
real, não cache) — nunca `dumpsys diskstats` para decidir o que apagar.

### `find` em `/sdcard` devolve 0 com os ficheiros lá — scoped storage
```
find /sdcard -name '*.mp3'   # → 0 hits, ficheiros existem
```
O `find` fica cego ao scoped storage do Android moderno; o instrumento é que está cego, não a ausência
de ficheiros (medido 2026-08-31). Confirmar com `ls` recursivo, ou por conteúdo indexado:
```bash
adb shell "content query --uri content://media/external/images/media --projection _data \
  --where \"_data LIKE '%<pasta>%'\"" | wc -l
```
Zero de `find` no `/sdcard` exige sempre esta 2.ª ferramenta antes de concluir "não existe".

## 2. Transferir ficheiros

- **`adb push` não aparece no selector de ficheiros do Android até ser indexado.** Forçar:
  `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://<path>`.
- **`adb pull -a` copia lixo do Android junto** (`.trashed-<epoch>-<nome>` de 0 bytes) — estraga
  contagens de verificação. Limpar no destino: `find <dest> -name ".trashed-*" -delete`.
- **Ficheiro empurrado do Windows chega com CRLF** e um `while read`/script no device apaga 0 linhas
  sem erro (os caminhos não casam). `tr -d '\r' < lista > lista2` no device antes de usar.
- Verificar uma cópia grande **por medição dos dois lados** (contagem de ficheiros + MB), não pelo
  log do `adb` — o exit code de sucesso não garante integridade nem velocidade.

## 3. Dados internos da app (sem root)

- **`run-as` só funciona em builds DEBUGGABLE** (`android:debuggable="true"`, típico de debug builds).
  Contra um release: `run-as: package not debuggable` — não há via por `adb` para o armazenamento
  interno; a única via é pela própria UI (`input tap` + `exec-out screencap`).
- **Backup/restore ponta-a-ponta, provado (2026-08-31):**
  ```bash
  adb exec-out "run-as <pkg> tar -c -f - databases files" > backup.tar
  adb uninstall <pkg> && adb install app-debug.apk
  adb push backup.tar /data/local/tmp/ && adb shell chmod 644 /data/local/tmp/backup.tar
  adb shell "run-as <pkg> tar -x -f /data/local/tmp/backup.tar"
  ```
  `run-as` consegue ler de `/data/local/tmp` (testado). **Testar o caminho de reposição ANTES de
  desinstalar** — extrair para pasta descartável e apagar, só depois confiar no fluxo real.
- **Ler a BD sem sair do device:** `adb exec-out "run-as <pkg> cat databases/<db>" > local.db` +
  `sqlite3 local.db`.

## 4. Instalar / reinstalar / assinatura

- **`debug.keystore` costuma ser gitignored e é POR MÁQUINA** (dois clones do mesmo repo geram chaves
  diferentes). `adb install -r` com um APK assinado por chave diferente da instalada dá
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. **A única saída é desinstalar, e desinstalar apaga
  `/data/data`** — fazer o backup do §3 antes. Correcção definitiva: copiar o `debug.keystore` para
  todas as máquinas em vez de deixar cada clone gerar o seu.
- `adb install <apk>` para instalar de novo; `-r` só substitui com **mesma assinatura**.

## 5. Lançar e inspeccionar apps sem saber o nome da activity

- **`am start -n <pkg>/.MainActivity` falha se a app for derivada de outro projecto** — o package
  muda mas a classe da activity principal pode manter o nome antigo (`does not exist`). Descobrir a
  activity real: `adb shell cmd package resolve-activity --brief <pkg>`.
- **Via que funciona sempre, sem saber o nome de nada:**
  `adb shell monkey -p <pkg> -c android.intent.category.LAUNCHER 1`.
- **Confirmar qual app está em primeiro plano** (não pelo nome do pacote — nem todo o `pm list
  packages` bate com o nome visível na UI): `adb shell dumpsys window | grep mCurrentFocus`.
- **Identificar um pacote opaco** (`pm list packages` só dá o id): se houver um launcher/gestor de
  apps de terceiros no telemóvel com lista nome-visível + pacote lado a lado, é mais rápido do que
  `dumpsys package`, que **não devolve label nenhuma** em alguns ROMs.

## 6. Screenshots e automação de UI sem `uiautomator`

⚠ **Dois usos diferentes, dois instrumentos — não se trocam:**

| Quero… | Instrumento | Porquê |
|---|---|---|
| **Coordenadas de toque** (onde clico?) | `uiautomator dump` → `bounds` do nó | Dá pixels exactos no espaço do ecrã, acerta à primeira |
| **Estado de um widget Compose** (o toggle está ligado?) | `screencap` + olhar a imagem | O dump não expõe esse estado (ver abaixo) |

- **Coordenadas de toque vêm SEMPRE das `bounds` do `uiautomator dump` — nunca de medição sobre a
  captura.** O `adb exec-out screencap -p` pode chegar **redimensionado e sem aviso** (medido
  2026-09-20 `[win]`: 900×2000 para um ecrã de 1116×2480), e a conversão por regra de três dá cliques
  na linha ao lado. Falhou **3 vezes seguidas** antes de se mudar de método; o dump resolveu à
  primeira. A captura não diz que veio reduzida — o `wm size` do device e as dimensões do PNG só
  batem por acaso.
  ```bash
  adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml .
  # bounds="[esq,topo][dir,baixo]" → centro = ((esq+dir)/2, (topo+baixo)/2) → input tap
  ```
  ⚠ `[win]` Git Bash: `export MSYS_NO_PATHCONV=1` antes (§0) — o caminho `/sdcard/ui.xml` é reescrito.
- **`uiautomator dump` não expõe o estado de switches/toggles construídos em Compose** — a árvore
  fica sem essa informação. Para **ler estado** (ligado/desligado), usar o **screenshot**
  (`adb exec-out screencap -p > frame.png`) em vez de confiar no dump. Isto é sobre estado, **não**
  sobre coordenadas: o mesmo dump que não sabe se o switch está ligado sabe exactamente onde ele está.
- **Ecrã apagado ou bloqueado dá screenshot PRETO ou parado no lockscreen** — não é a app partida.
  Confirmar o estado do ecrã e a `topResumedActivity` (`dumpsys power` / `dumpsys window`; TODO: nome exacto do campo não confirmado) **antes** de tirar conclusões de uma captura.
- Navegação sem framework de teste: `adb shell input tap <x> <y>` / `input swipe` / `input keyevent
  KEYCODE_BACK`, sempre seguido de `exec-out screencap` para verificar por efeito.
- `adb shell input draganddrop <x1> <y1> <x2> <y2> <duração_ms>` para arrastar (ex.: reordenar itens
  numa lista com handle).

### Helper `tap_text` — dump → bounds → centro, com scroll e travão

O padrão acima repetiu-se à mão dezenas de vezes numa sessão (2026-09-23). Colar a
função no Git Bash e chamar `tap_text "<texto visível>" [máx_scrolls]`. Aritmética só com `$(( ))` —
**`bc` não existe no Git Bash**: um loop improvisado com `bc` nunca tocou em nada e ficou 120 s a fazer
swipes até ser morto. Por isso o travão: ecrã igual depois de um swipe → aborta.

```bash
tap_text() {  # uso: tap_text "Definições" [max_scrolls=5]
  local alvo="$1" max="${2:-5}" i=0 antes="" xml b W H
  export MSYS_NO_PATHCONV=1
  read W H <<<"$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr x ' ')"
  while [ "$i" -le "$max" ]; do
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null && xml=$(adb exec-out cat /sdcard/ui.xml)
    b=$(printf '%s' "$xml" | grep -o "text=\"$alvo\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" \
        | head -1 | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]')
    if [ -n "$b" ]; then
      set -- $(printf '%s' "$b" | tr -c '0-9' ' ')
      adb shell input tap $(( ($1+$3)/2 )) $(( ($2+$4)/2 )); return 0
    fi
    [ "$xml" = "$antes" ] && { echo "sem efeito: o ecrã não mudou — abortar" >&2; return 1; }
    antes="$xml"; adb shell input swipe $((W/2)) $((H*3/4)) $((W/2)) $((H/4)) 300; i=$((i+1))
  done
  echo "não encontrado: $alvo" >&2; return 1
}
```
Depois do toque, verificar por efeito (`exec-out screencap` ou novo dump), como em qualquer `input tap`.
Texto com caracteres especiais de regex (`.`, `[`, `*`) → escapar no argumento.

- **`input keyevent KEYCODE_HOME` com o launcher Niagara abre a pesquisa**, não o ecrã inicial
  (2026-09-23). Para sair de uma app, `KEYCODE_BACK` repetido ou lançar a app
  seguinte directamente (§5).

## 6b. QA visual de uma app no emulador (React Native/Expo ou nativa)

Os testes unitários não vêem layout: num caso real esta volta apanhou 26 defeitos que 666 testes jest não viam (linha com milhares de px, texto cortado, teclado preso no arranque — 2026-09-29). Percurso:

1. **Guardar o estado original** (`adb shell wm size`, `wm density`, `settings get system font_scale`).
2. **Matriz larguras × fonte:** 320 / 360 / 412 / 600 dp × `font_scale` 1.0 / 1.3 / 2.0. Largura em dp = px × 160 / densidade → fixar com `adb shell wm size <W>x<H>` + `wm density <D>`; fonte com `adb shell settings put system font_scale <f>`.
3. **Em cada célula:** relançar a app (§5), percorrer os ecrãs com `uiautomator dump` + `input tap` (§6) e `exec-out screencap` por ecrã; procurar no dump `bounds` maiores do que o ecrã (largura/altura absurda) e texto cortado na captura.
4. **Repor sempre no fim** — também se o percurso falhar a meio: `wm size reset`, `wm density reset`, `settings put system font_scale <valor guardado>`.
5. **Relatório:** uma linha por defeito — ecrã · célula da matriz (dp × fonte) · sintoma · captura (caminho). O tester relata, não corrige.

## 7. Permissões

`adb shell pm grant <pkg> android.permission.<NOME>` concede uma permissão em runtime sem passar
pela UI. Uma permissão negada falha **em silêncio** do lado da app — sinal só aparece no `logcat`
(ex.: `Blocked onNotificationPosted` para `POST_NOTIFICATIONS` negada). Ao depurar uma feature que
"não aparece" sem crash, conferir permissões negadas antes de assumir bug de código.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Decidir o que apagar por `dumpsys diskstats` | Medir por `df -h /data` |
| Concluir "não existe" por `find /sdcard` a dar 0 | `ls` recursivo ou `content query` antes de concluir |
| `adb uninstall` para resolver `INSTALL_FAILED_UPDATE_INCOMPATIBLE` sem backup | Backup `run-as tar` (§3) primeiro — apaga `/data/data` |
| `run-as` num release build | Só funciona em DEBUGGABLE; release → via UI |
| `am start -n pkg/.MainActivity` numa app derivada | `cmd package resolve-activity --brief` ou `monkey -c …LAUNCHER 1` |
| Confiar em `uiautomator dump` para estado de switches Compose | Screenshot |
| Medir coordenadas de toque sobre o `screencap` (regra de três) | `bounds` do `uiautomator dump` — a captura chega redimensionada sem aviso |
| Screenshot com ecrã apagado/bloqueado dado como "app partida" | Confirmar `mDreamingLockscreen`/tela ligada antes |
| Comando `/sdcard` no Git Bash sem `MSYS_NO_PATHCONV=1` | Exportar a variável antes |
| Ficheiro pushed do Windows lido por script no device sem tratar CRLF | `tr -d '\r'` no device |
| `bc` num loop de automação no Git Bash (não existe — o loop corre sem tocar em nada) | Aritmética `$(( ))`; helper `tap_text` (§6) com travão «ecrã não mudou → abortar» |
| Loop de swipes/toques sem verificar efeito | Comparar o dump antes/depois; sem mudança → abortar e reportar |
| `KEYCODE_HOME` para voltar ao início com o Niagara | Abre a pesquisa — `KEYCODE_BACK` ou lançar a app directamente |

## Próximo passo (chain)
App Android acabada de compilar → `android-compose` (nativo) ou o build do stack (Unity:
`unity-build-android`, se instalada) cobre o build; este skill cobre
instalar/testar/depurar no dispositivo depois de gerado o `.apk`/`.aab`. Gate de "app instalável"
(`adb install` + `logcat` sem crash) é doutrina de `.claude/reference/gates-runtime.md`, não deste
skill.
