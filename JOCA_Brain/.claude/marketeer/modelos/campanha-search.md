{{FRONTMATTER}}
# {{CLIENTE}}: campanha Search {{TEMA}}

> Modelo do marketeer (`node "<MKT>/scripts/campanha/nova.mjs"`), no formato revisto e aprovado em campanhas
> reais (outubro de 2026). Regras: nada inventado (sem fonte → `<sem fonte>` ou `TODO`); os
> números dos anúncios vêm só dos **factos aprovados**; volumes só do Planeador da Google, nunca
> estimados à mão. Os valores de máquina estão no frontmatter (`campanha:`); as tabelas explicam o
> porquê. Validar com `node "<MKT>/scripts/campanha/validar.mjs" <este ficheiro>` antes de mostrar a alguém.
> Apagar este bloco quando o documento estiver pronto.

## Resumo executivo

- TODO: o que o histórico da conta mostra (`ads/diagnostico.mjs`), em 3-5 pontos com números reais.
- TODO: o que a pesquisa de palavras-chave deu (`campanha/pesquisa.mjs`) e se o Planeador respondeu.
- **Proposta:** uma campanha `{{NOME}}`, TODO grupos, só expressão e exacta, TODO negativas,
  {{LICITACAO_TEXTO}}, landing {{LANDING}}.

| | Campanha |
|---|---|
| Nome na conta | `{{NOME}}` |
| Tema | {{TEMA}} |
| Objectivo | {{OBJECTIVO}} |
| Público | {{PUBLICO}} |
| URL final | {{LANDING}} |
| Caminho visível | `{{CAMINHO}}` |
| Grupos de anúncios | TODO |
| Orçamento | {{ORCAMENTO_TEXTO}} |
| Licitação | {{LICITACAO_TEXTO}} |

### Factos aprovados (fonte única dos números nos anúncios)

{{FACTOS}}

---

## 1. Diagnóstico da conta

TODO: resumo de `clientes/{{SLUG}}/ads/diagnostico-<data>.md` — campanhas com gasto, termos que
gastaram sem converter, landing pages com erro, acções de conversão. Só números da API.

## 2. Pesquisa de palavras-chave

TODO: resumo de `clientes/{{SLUG}}/campanhas/pesquisa-<data>.md`. Se o Planeador recusou
(`DEVELOPER_TOKEN_NOT_APPROVED`), dizê-lo: **este documento não tem volumes da Google**.

| Tema | Decisão | Evidência (histórico real) |
|---|---|---|
| TODO | Entra / Fica de fora | TODO |

---

## 3. Definições da campanha

### 3.1 Definições

| Definição | Valor | Porquê |
|---|---|---|
| Tipo | Pesquisa, sem objectivo guiado | Controlo das definições |
| Redes | Só Pesquisa Google (sem parceiros, sem Display) | TODO |
| Localização | {{ZONA}} | TODO |
| Opção de localização | Incluir: **"Presença"**. Excluir: "Presença" | Evita quem só pesquisa *sobre* a zona |
| Idiomas | {{IDIOMAS}} | TODO |
| Correspondência ampla | Desligada | Só expressão e exacta |
| Recursos automáticos | Desligados | Os textos são só os revistos na secção 6 |
| Programação de anúncios | {{HORARIO}} | TODO |
| Programação do recurso de chamada | {{CHAMADA}} | TODO |
| Datas | Início `TODO: data de arranque`; sem fim | — |

**Objectivos de conversão** (por campanha): {{OBJECTIVOS}}

### 3.2 Orçamento e licitação a partir do CPC real

| Referência | CPC | Fonte |
|---|---|---|
| TODO | TODO | `ads/diagnostico.mjs` / `campanha/pesquisa.mjs` |

**Proposta:** {{ORCAMENTO_TEXTO}} · {{LICITACAO_TEXTO}}. TODO: porquê, com a conta cliques × CPC.

---

## 4. Grupos de anúncios e palavras-chave

Regras: só expressão (`"…"`) e exacta (`[…]`), um par por linha de intenção comercial. Cada palavra
passa pelo Planeador antes de criar; a que não tiver volume sai.

**G1 · TODO nome do grupo**
```
"TODO palavra-chave"
[TODO palavra-chave]
```

---

## 5. Palavras-chave negativas

Só contam as negativas **dentro das tabelas**, entre crases: palavra solta = ampla, entre aspas =
expressão, entre parênteses rectos = exacta. Termos citados fora de tabela não se lêem (o validador
avisa). Listas partilhadas a associar: {{LISTAS}}.

### 5.1 Negativas da campanha

| Tema | Negativas | Evidência (termos reais com gasto e sem conversão) |
|---|---|---|
| TODO | `TODO` | TODO |

### 5.2 Negativas entre grupos

| Grupo | Excluir (expressão) | Para mandar a pesquisa para |
|---|---|---|
| G1 | `"TODO"` | TODO |

---

## 6. Anúncios responsivos de pesquisa (RSA)

1 RSA por grupo, 15 títulos (≤30) e 4 descrições (≤90). URL final {{LANDING}}, caminho `{{CAMINHO}}`.
`Car.` = caracteres contados pelo validador (cada letra acentuada vale 1). `Fixar` = posição fixa
(vazio = sem fixação). O telefone **não** entra no texto (política da Google): vai no recurso de
chamada. Números só dos factos aprovados.

### G1 · TODO nome do grupo

| # | Título | Car. | Fixar |
|---|---|---|---|
| 1 | TODO | | |
| 2 | TODO | | |
| 3 | TODO | | |
| 4 | TODO | | |
| 5 | TODO | | |
| 6 | TODO | | |
| 7 | TODO | | |
| 8 | TODO | | |
| 9 | TODO | | |
| 10 | TODO | | |
| 11 | TODO | | |
| 12 | TODO | | |
| 13 | TODO | | |
| 14 | TODO | | |
| 15 | TODO | | |

| # | Descrição | Car. | Fixar |
|---|---|---|---|
| D1 | TODO | | |
| D2 | TODO | | |
| D3 | TODO | | |
| D4 | TODO | | |

---

## 7. Recursos

### Sitelinks (texto ≤25, descrições ≤35; URLs têm de responder 200)

| Texto | Car. | Descrição 1 | Car. | Descrição 2 | Car. | URL |
|---|---|---|---|---|---|---|
| TODO | | TODO | | TODO | | TODO |

### Frases de destaque (≤25)

| Frase | Car. |
|---|---|
| TODO | |

### Snippet estruturado · cabeçalho **Serviços** (≤25 por valor)

| Valor | Car. |
|---|---|
| TODO | |

### Recurso de chamada

{{TELEFONE}} · {{CHAMADA}}.

---

## 8. Página de destino

| Página | HTTP | Serve? | Porquê |
|---|---|---|---|
| {{LANDING}} | TODO | TODO | TODO |

---

## 9. Plano de medição

### Dia 0

1. Criar em pausa (`node "<MKT>/scripts/campanha/criar.mjs" {{SLUG}} {{NOME}}`) e rever `node "<MKT>/scripts/campanha/investimento.mjs" {{SLUG}} {{NOME}}`.
2. Teste real de conversão a partir da landing (Tag Assistant e, até 24 h depois, na coluna de conversões).
3. Activação: manual, pelo dono da conta, depois de rever o investimento.

### Semana 1 (dias 1–7)

| O que ver | Acção |
|---|---|
| Anúncios aprovados e com impressões | Zero impressões: ver "Volume de pesquisa baixo" |
| Termos de pesquisa, todos os dias | Termos sem intenção comercial → negativas |
| Gasto diário contra o orçamento | Registar |
| CPC real contra o CPC máximo | Registar |

### Semana 2 (dias 8–14)

| O que ver | Acção |
|---|---|
| Parcela perdida por classificação | TODO |
| Impressões e CTR por grupo | Grupo com zero impressões → juntar ao mais próximo |
| Índice de qualidade | Abaixo de 5: rever palavra-chave → título → landing |

### Semana 4 (dias 22–30)

| O que ver | Acção |
|---|---|
| Leads totais e leads qualificados | Primeira métrica: custo por lead qualificado |
| Conversões principais em 30 dias | TODO: critério para mudar de licitação |

---

## 10. TODOs e decisões para o aprovador

### TODOs (sem isto, não se cria)

| # | TODO | Onde entra |
|---|---|---|
| 1 | Passar as palavras da secção 4 pelo Planeador de palavras-chave | Secção 4 |

### Decisões pendentes

| # | Decisão | Proposta deste documento |
|---|---|---|
| 1 | TODO | TODO |

## Decisões tomadas

- {{DATA}} · questionário da campanha (`campanha/nova.mjs`, respostas do operador).
