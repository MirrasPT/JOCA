# /init-project — fundido no /start

**Este comando foi absorvido pelo `/start`** (`.claude/skills/start.md`), que e a entrada unica de
qualquer projecto — novo ou existente.

Ao receber `/init-project`: **corre o `/start`**. A Fase 0 dele resolve as tres portas:
- pasta vazia → entrevista completa;
- pasta com `PROGRESSO.md` → retoma pela fase certa;
- pasta com projecto mas sem `PROGRESSO.md` → **a via "ligar ao JOCA"** — exactamente o que este
  comando fazia, mas sem questionario: as respostas antigas (tipo, stack, estado) derivam-se do
  disco (`composer.json`/`package.json`/`pubspec.yaml`, git, README), a memoria do Brain
  cria-se/actualiza-se, e a unica pergunta e "o que queres fazer a seguir?".

A doutrina que vivia aqui ("uma pergunta que o disco ja responde e uma pergunta que nao se faz",
memoria guarda-chuva vs sub-entrada, nunca comecar como novo quando ha memoria) **vive agora na
Fase 0 do `/start`** — nao esta perdida, mudou de casa.
