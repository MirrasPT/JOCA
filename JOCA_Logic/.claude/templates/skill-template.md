---
name: <kebab-case, max 32 chars>
description: "<O que faz + quando usar. Front-load do caso de uso primário. MUST be invoked when the user says: <trigger 1>, <trigger 2>, <trigger 3>. SHOULD also invoke when: <trigger PT>, <trigger EN>. Max 1024 chars.>"
triggers: <trigger 1>, <trigger 2>, <trigger PT>, <trigger EN>
---

# <Nome da Skill>

<1-2 frases: o que esta skill garante que acontece. Sem marketing.>

## When to use

- <sintoma/pedido concreto 1>
- <sintoma/pedido concreto 2>
- NÃO usar quando: <caso vizinho que pertence a outra skill — apontá-la>

## Procedimento

1. <passo específico — não "handle errors" mas "se X falhar, fazer Y">
2. <passo com comando/código exacto quando aplicável>
3. <passo de verificação — como confirmar que ficou certo>

## Padrões

```<lang>
<exemplo mínimo correcto>
```

## Anti-patterns

| Errado | Correcto |
|--------|----------|
| <prática a evitar> | <alternativa> |

## Quality gate

<Critério verificável de "done" + teste/comando de validação.>

<!--
Regras do template (apagar ao usar):
- Corpo < 500 linhas. Conteúdo pesado → companion `<name>.ref.md` (o index ignora *.ref.md)
- Cada frase tem de mudar o comportamento do Claude concretamente
- Triggers bilingues PT/EN no frontmatter
- Layout flat: .claude/skills/<name>.md — nunca subdirectórios
-->
