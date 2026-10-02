---
name: algoritmo-de-terceiros
description: "Implementar ou reproduzir um algoritmo, checksum, dígito de controlo ou formato de ficheiro de um terceiro (banco, fabricante, norma) lendo a fonte primária, nunca de memória. MUST be invoked when the user says: checksum, dígito de controlo, check digit, validar NIF/IBAN/EAN/ISBN, referência Multibanco, algoritmo de terceiros, formato de ficheiro proprietário, reproduzir formato de exportação de outra app. SHOULD also invoke when: escrever testes para um algoritmo de validação de terceiros; um vector de teste único chega para dar por validada uma implementação financeira; responder de memória sobre a estrutura de um ficheiro que outra app lê/escreve (gcode, config de slicer, extracto bancário, EDI)."
triggers: checksum, dígito de controlo, check digit, validar nif, validar iban, validar ean, validar isbn, referência multibanco, algoritmo de terceiros, formato de terceiros, formato proprietário, luhn, mod 97, crc, reproduzir formato de ficheiro, ler formato de exportação, número de série com verificação
origin: local
chain: tester-code
---

# Algoritmo de terceiros — pela fonte, nunca de memória

Duas famílias de erro, uma causa: implementar contra o que **parece** certo em vez do que a fonte
do terceiro diz. Aplica-se a checksums/dígitos de controlo (dinheiro, identificação) e a formatos de
ficheiro que outra aplicação lê ou escreve (gcode, config de slicer, export bancário, EDI).

> **Regra-mãe (`memory/soul.md`, Hard Limits):** uma constante numérica que entra em geometria,
> dinheiro ou fabrico lê-se da fonte primária — nunca de um resumo gerado, de memória, ou de um
> valor "típico". Esta skill é essa regra aplicada a algoritmos e formatos.

---

## 1. Checksum / dígito de controlo — um vector não prova nada

**Incidente real (referências Multibanco, 2026-08-25):** o primeiro teste passou com um **peso
errado** porque o único vector de teste oficial tinha `0` nessa posição do algoritmo — um peso
errado multiplicado por 0 não muda o resultado. O código estava a validar dinheiro real e o teste
não o provava.

Checklist antes de dar a implementação por validada:

| Passo | Porquê |
|---|---|
| **Cobertura por POSIÇÃO** — cada posição/peso do algoritmo tem de ser exercitada por pelo menos um vector onde ela **importa** (dígito ≠ 0, peso ≠ 1) | um vector com `0`/`1` nessa posição esconde um peso errado, mesmo com o teste verde |
| **≥2 fontes independentes** para os vectores de teste | um único documento/gerador de terceiros pode ter o próprio erro; duas fontes que concordam é sinal, uma só não é |
| **Mutation kill** — mudar UMA constante do algoritmo de propósito (peso, módulo, offset) e confirmar que o teste passa a **falhar** | se o teste continua verde depois da mutação, não estava a testar aquele peso — é o mesmo princípio do "parti-lo de propósito" dos gates de runtime |
| **Declarar a cobertura que falta** por escrito no código/PR | um vector que nunca exercita uma posição é uma lacuna conhecida, não um risco escondido |

Aplica-se a qualquer algoritmo de verificação de terceiro: Multibanco, NIF/NIPC, IBAN, EAN/ISBN
(Luhn mod 10), CRC, MOD 97 de referências bancárias — o mecanismo de falha é sempre o mesmo vector
pobre, não o algoritmo em si.

## 2. Formato de ficheiro de terceiros — ler o escritor e o leitor, não confiar na memória

**Incidente real (2026-09-09):** respondida de memória a estrutura do ficheiro de pausa do
Bambu/OrcaSlicer como `custom_gcode_per_print_z.xml` (herdado do PrusaSlicer) — estava errado. No
Bambu/Orca chama-se `custom_gcode_per_layer.xml`, com raiz `custom_gcodes_per_layer`, e a posição da
pausa também mudava (o `ToolOrdering.cpp` encosta à camada mais próxima e emite no início dela, não
onde parecia lógico). Só se resolveu no código-fonte, via `gh api`.

Ordem de fontes, da melhor para a pior — parar na primeira que responde com confiança:

1. **Especificação oficial publicada** (RFC, norma ISO, manual do fabricante, schema XSD/JSON).
2. **Código-fonte de quem ESCREVE e de quem LÊ o formato** — não só um dos dois; formatos
   proprietários toleram o que o escritor produz, e o campo que "devia" existir pela spec pode não
   ser o que o leitor realmente espera. `gh api search/code -f q="<termo> in:file repo:<owner>/<repo>"`
   custa ~3 chamadas e substitui a memória.
3. **`strings` no binário instalado da app** (`strings /Applications/<App>.app/.../<binário> | grep <termo>`)
   — prova, sem abrir a app, que ela lê/escreve aquele nome de campo/ficheiro.
4. **Nunca**: "é parecido com o formato irmão X" ou "normalmente chama-se Y" — os dois exemplos
   acima (peso Multibanco, XML do Bambu) nasceram exactamente de generalizar por semelhança.
5. **Nenhuma das fontes 1-3 resolve** → `TODO: fonte não encontrada`: parar e reportar ao utilizador; nunca entregar implementado por semelhança.

`file <caminho>` antes de assumir o formato pela extensão — uma extensão não prova o conteúdo.

---

## 3. Gate de fecho

Antes de dar a implementação por pronta:
- [ ] Cobertura por posição documentada (checksum) OU escritor+leitor lidos na fonte (formato).
- [ ] ≥2 fontes independentes para os vectores de teste, ou explicitamente `TODO: só 1 fonte`.
- [ ] Mutation kill corrido: mudar 1 constante, o teste falha, repor a constante.
- [ ] Testes cobrem pelo menos um caso real que já passou pelo sistema de produção do terceiro
  (extracto real, referência real emitida, ficheiro real exportado por essa app) — não só vectores
  sintéticos.

## Anti-patterns

| Errado | Correcto |
|---|---|
| Um único vector oficial → "está validado" | Cobertura por posição + mutation kill antes de confiar |
| Responder de memória sobre estrutura de ficheiro/nome de campo de terceiro | `gh api search/code` no escritor e no leitor, ou `strings` no binário instalado |
| Assumir que um formato "irmão" (mesmo fabricante, versão anterior) é igual | Cada versão/fork muda nomes e posições — ler a fonte desta versão, não a lembrança da outra |
| Extensão de ficheiro como prova do formato | `file <caminho>` antes de assumir |
| Vector de teste só de uma fonte (um gerador online, um exemplo da documentação) | ≥2 fontes independentes; se só há uma, dizê-lo por escrito |

## Próximo passo (chain)
- Implementação escrita e gate acima passado → `tester-code` (verificador ≠ produtor, sempre).
- Se o algoritmo entra em fluxo de pagamento/dinheiro → `security-review` antes de produção.
