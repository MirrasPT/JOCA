---
name: android-compose
description: "Native Android development in Kotlin + Jetpack Compose — Gradle builds, Compose layout/text clipping bugs, foreground services, per-machine signing identity, and Google AI Studio Build exports. Covers BUILD/CODE time; android-adb covers DEVICE time (install/logcat/permissions) — use both together, never one for the other's job. MUST invoke when the user says: Jetpack Compose, Kotlin Android, app Android nativa, AI Studio Build export, debug.keystore. SHOULD also invoke when: BackgroundServiceStartNotAllowedException, foreground service Android, MediaSession, Compose lineHeight cortado, statusBarsPadding a somar, applicationId com.example, validateSigningDebug, ForegroundServiceDidNotStartInTimeException."
triggers: jetpack compose, kotlin android, app android nativa, android nativo kotlin, ai studio build export, debug.keystore, compose lineheight, statusbarspadding, backgroundservicestartnotallowedexception, foreground service android, mediasession, room database kotlin, applicationid com.example, validatesigningdebug, foregroundservicedidnotstartintimeexception, gradlew sem permissao de execucao
origin: local
chain: android-adb
---

# Android nativo — Kotlin + Jetpack Compose

Antes de escrever código: `Read(".claude/reference/codigo-minimo.md")` — escada + guard-rails.

**Fora da stack da casa.** `stack-padrao.md` manda Flutter para móvel — esta skill cobre-se quando o
código já chega assim (export do Google AI Studio Build, projecto herdado) e a excepção fica
registada em `docs/DECISIONS.md`, não quando se escolhe Compose de raiz para um projecto novo.
Cobre o lado **BUILD/CÓDIGO**. Dispositivo já ligado (instalar, `logcat`, permissões, storage) →
`android-adb`.

## 0. Ambiente

| Ferramenta | macOS | Windows | Nota |
|---|---|---|---|
| JDK 17 | `brew install openjdk@17` | TODO: por medir | O cask `temurin@17` corre um instalador `.pkg` com `sudo` e falha sem terminal interactivo (medido, 2026-08-31) — usar o `brew install` directo |
| Android SDK / `platform-tools` | `/opt/homebrew/share/android-commandlinetools` (`platform-tools/adb`, `build-tools/<v>/apksigner`) | TODO: por medir | |
| `gradlew` | `chmod +x gradlew` obrigatório | — | Vem do git com modo `100644` (sem bit de execução) → `permission denied` no Mac. Corrigir no repo, não só localmente: `git update-index --chmod=+x gradlew` (2026-08-31) |

## 1. Build — verificar pelo artefacto, nunca pelo pipe

`./gradlew assembleDebug | tail` devolve **exit 0 mesmo com o build a falhar** — o `tail` mascara o
código de saída do `gradlew`. Um build foi dado por bom com `validateSigningDebug` a falhar por trás
(medido, 2026-08-31). Verificar sempre pelo ficheiro: `ls -la app/build/outputs/apk/debug/`
(existe? `mtime` novo?), nunca pelo código de saída do comando com pipe. Instalar e correr no
dispositivo é gate à parte — doutrina em `.claude/reference/gates-runtime.md` («App móvel
Android/iOS»), executada por `android-adb`.

**Memória: `--max-workers=4` por omissão e build em primeiro plano.** Sem limite de workers, o
Gradle mais os agentes da sessão esgotaram os 32 GB da máquina e o harness matou o build que corria em
fundo, com a sessão parada (2026-10-01). Correr `./gradlew assembleDebug --max-workers=4`
e em **primeiro plano** sempre que o build caiba em 10 min; fundo só para builds mais longos.

## 2. Assinatura — `debug.keystore` é identidade, não configuração

Gitignored e **gerado por máquina**: dois clones do mesmo repo produzem chaves diferentes, e um APK
assinado por uma não substitui o instalado pela outra (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`; medido
2026-08-31 — certificados diferentes entre um clone em Windows e outro em Mac). Desinstalar para resolver
apaga `/data/data` (dados da app).

- **Correcção definitiva:** copiar o `debug.keystore` para todas as máquinas — é a chave que define a
  identidade da app, guarda-se fora do git **e** fora de uma só máquina. Nunca gerar de novo "para
  desbloquear o build". O mesmo vale para outros segredos que são identidade (certificado de
  assinatura iOS, chave de assinatura de plugin): cópia em cada máquina + backup fora do git.
- **Sem keystore comum:** backup dos dados ANTES de desinstalar — receita `run-as tar` em
  `android-adb.md` §3. Testar a reposição numa pasta descartável antes de confiar no fluxo real.

## 3. Compose — corta texto/layout sem erro nenhum

| Armadilha | Efeito | Correcção |
|---|---|---|
| `typography.X.copy(fontSize = Nsp)` | Herda o `lineHeight` do estilo original; o glifo corta-se dentro da própria caixa, independente da altura do contentor | Declarar `lineHeight` explícito em **todos** os `.copy()` que mudam `fontSize` |
| `Row` com filhos de largura fixa | Não quebra nem encolhe — a soma pode exceder o ecrã sem erro nenhum, corta as pontas em silêncio | Somar as larguras fixas contra a largura disponível antes de as fixar |
| `.statusBarsPadding()` num `Scaffold` | Soma com o `innerPadding` que o próprio `Scaffold` já devolve — a barra de estado é contada 2×, ~28 dp perdidos | Usar só o `innerPadding` do `Scaffold`, tirar o `.statusBarsPadding()` extra |
| `Canvas` desenhado em píxeis crus | Piora com zoom/densidade forçada (uma calha de `8f` dá 2,6 dp a 500 dpi) | Converter com `dp.toPx()` |
| Caixa com texto em `sp` e altura fixa em `dp` | O texto elástico corta dentro do contentor rígido | `heightIn(min = …)` em vez de `height()` |

(Fonte de todas: um projecto real, 2026-08-31.) **Público com acessibilidade forçada** (densidade forçada +
`font_scale` alto + negrito) parte combinações que nenhuma sozinha parte — testar com o perfil real do
dispositivo-alvo (`adb shell settings get secure font_scale` / `display_density_forced`), não a 1×.

## 4. Serviço em primeiro plano (playback, trabalho contínuo)

- **`Application.onCreate()` a chamar `startService()` directamente crasha em Android 8+**
  (`BackgroundServiceStartNotAllowedException`) **antes de desenhar seja o que for** — o processo
  ainda está em segundo plano nesse ponto. Usar `bindService(…, BIND_AUTO_CREATE)` em vez disso
  (medido, 2026-08-31; o standby bucket NÃO era a causa — pô-lo em `active` e continuar a
  crashar foi o controlo que o provou).
- `onStartCommand` tem de chamar `startForeground()` a abrir — sem isso, risco de
  `ForegroundServiceDidNotStartInTimeException` em Android 8+.
- Decidir explicitamente: deslizar fora dos recentes (`onTaskRemoved`) mata o serviço? Botão home não
  passa por `onTaskRemoved` — path diferente, decisão de produto, não bug.
- `POST_NOTIFICATIONS` negada bloqueia a notificação em silêncio (sem crash) — pedir em runtime na
  activity principal; conceder/inspeccionar do lado do dispositivo é `android-adb` §7.

## 5. Export do Google AI Studio Build

- O plugin Secrets do Gradle exige uma variável preenchida (ex.: `GEMINI_API_KEY`) no `.env` para o
  `BuildConfig.java` gerado compilar — mesmo que a app nunca chame o modelo.
- `applicationId`/`namespace` saem como lixo do gerador (`com.aistudio.<slug>.<hash>` /
  `com.example`) — **renomear depois de qualquer instalação é irreversível** para quem já tem a app
  instalada (obriga a desinstalar, apaga dados). Decidir antes da 1.ª instalação real.

## 6. Editar ficheiros `.kt` com texto PT-PT

`sed`/`perl` corromperam ficheiros Kotlin com acentos numa das máquinas medidas (duplo-encoding UTF-8, linhas em
branco comidas) — usar `python3` com UTF-8 explícito, ou `Edit`/`Write`. Verificar com
`iconv -f UTF-8 -t UTF-8` depois de qualquer edição em massa (2026-08-31).

## Anti-patterns

| Errado | Correcto |
|---|---|
| Ler `./gradlew … \| tail` para saber se o build passou | `ls`/`mtime` do APK — o pipe mascara o exit code |
| `adb uninstall` para resolver `INSTALL_FAILED_UPDATE_INCOMPATIBLE` sem keystore comum nem backup | Copiar `debug.keystore` entre máquinas; sem isso, backup `run-as tar` antes |
| `.copy(fontSize = X)` sem `lineHeight` | Declarar `lineHeight` explícito em todo `.copy()` que mude `fontSize` |
| `startService()` no `Application.onCreate()` | `bindService(…, BIND_AUTO_CREATE)` |
| Renomear `applicationId` depois de instalar em qualquer dispositivo | Decidir antes da 1.ª instalação real |
| `sed -i` num `.kt` com acentos | `python3` UTF-8 explícito ou `Edit`/`Write`; `iconv` a verificar depois |

## Próximo passo (chain)

APK compilado e no disco → `android-adb` cobre instalar, `logcat` e permissões no dispositivo. Gate de
«app instalável» (`adb install` + `logcat` sem `FATAL EXCEPTION`) é doutrina de
`.claude/reference/gates-runtime.md`, não desta skill.
