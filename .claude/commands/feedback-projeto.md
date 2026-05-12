# /feedback-projeto — Feedback do Projecto

Analisa a conversa actual, actualiza os ficheiros de documentação do **projecto**, e sugere actualizar a memória JOCA do projecto.

Diferença dos outros comandos:
- `/feedback-projeto` → aprendizagens do projecto: glossários, regras, templates, limitações (este comando)
- `/feedback-joca` → gaps do workflow JOCA: skills, agentes, comandos, tools
- `/save` → estado da sessão: o que foi feito, decisões, pendentes

---

## PASSO 1 — Identificar projecto e ficheiros

Detectar directório do projecto e listar ficheiros de documentação existentes:
- `Branding.md`, `CLAUDE.md`, `estado.md`, `README.md`, ficheiros `*RS.md`, outros `.md`

Ler cada ficheiro encontrado.

---

## PASSO 2 — Analisar a conversa

Extrair aprendizagens com impacto em sessões futuras:

**A. Terminologia clarificada**
Expressões que causaram ambiguidade, com definição correcta.
Exemplo: "a meio" = nível de vinho a 50% na garrafa, NÃO vinho a ser vertido.

**B. Regras e preferências descobertas**
Constraints ou comportamentos que se revelaram importantes.
Exemplo: "usar sempre Gemini por defeito, nunca gpt-image-2 salvo instrução explícita".

**C. Limitações de ferramentas**
Limitações documentáveis de modelos ou MCPs que afectaram o resultado.
Exemplo: "modelos de imagem completam automaticamente pescoços de garrafa com cápsula".

**D. Templates ou formatos validados**
Estruturas testadas e aprovadas durante a sessão.
Exemplo: formato JSON para prompts Gemini com campos `scene`, `subject`, `bottle`, `lighting`.

**E. Correcções de workflow**
Passos do processo do projecto que foram corrigidos ou melhorados.

---

## PASSO 3 — Determinar actualizações por ficheiro

| Ficheiro | Conteúdo a actualizar |
|----------|-----------------------|
| `Branding.md` | Glossários, regras de imagem, limitações de modelos, templates de prompt |
| `CLAUDE.md` | Regras de trabalho, convenções, comandos do projecto |
| `*RS.md` | Tom, pilares, histórico de copy — adicionar notas de uso |
| `README.md` | Só se algo estrutural mudou |
| Outros `.md` | Avaliar caso a caso |

**Regra:** só actualizar o que a conversa trouxe de novo. Edições cirúrgicas — não reescrever ficheiros inteiros.

---

## PASSO 4 — Actualizar ficheiros do projecto

Para cada ficheiro:
1. Identificar onde inserir (não apagar conteúdo existente válido)
2. Fazer edit cirúrgico — append de secções novas, update de secções existentes, correcção de erros
3. Manter estilo e estrutura do ficheiro original

**Prioridade:**
- Corrigir informação errada → Alta
- Adicionar glossário/terminologia → Alta
- Adicionar template validado → Alta
- Documentar limitação de ferramenta → Média
- Adicionar regra de workflow → Média

---

## PASSO 5 — Sugerir actualização da memória do projecto

Após actualizar os ficheiros do projecto, verificar se a memória JOCA do projecto precisa de ser actualizada.

Ler `JOCA/memory/projects/<nome-projecto>.md`.

Se a sessão trouxe contexto novo relevante (decisão de modelo, novo workflow, mudança de strategy), sugerir ao utilizador:

> "Queres que actualize também `memory/projects/<nome>.md` com [X e Y]?"

Não actualizar sem confirmação — o utilizador pode preferir fazer com `/save`.

Se a entrada de memória não existir para este projecto, sugerir `/init-project`.

---

## PASSO 6 — Relatório

```
FEEDBACK PROJECTO — <nome>
──────────────────────────

Ficheiros actualizados:

✓ Branding.md
  + Glossário PT→AI (N entradas)
  + Secção: Limitações de modelos
  + Template JSON para prompts
  ~ Modelo por defeito: Gemini

✓ CLAUDE.md
  + Regra: [descrição]

Sem alterações:
  - README.md — sem novidades relevantes

Memória do projecto:
  [sugestão de actualização ou "actualizada" se confirmado]

Próximo:
  → /save para guardar estado da sessão (o que foi feito, decisões, pendentes)
  → /feedback-joca se houve gaps no workflow do JOCA
```

---

## Notas

- Não criar ficheiros desnecessários — só se fizer sentido estrutural claro
- Não duplicar `/save` — não actualizar pendentes ou o que foi feito
- Não duplicar `/feedback-joca` — gaps do JOCA (skills, agentes, comandos) não vão aqui
- Perguntar se incerto sobre relevância antes de escrever
