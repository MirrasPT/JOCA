---
name: mkt-psicologia
description: "Psicologia aplicada ao marketing de uma marca (F2 do /marketeer), em dois modos: aplicar (escolher 2-4 princípios por peça ou decisão da estratégia, com o porquê) e rever (diagnosticar onde um rascunho perde a atenção e propor até 5 mudanças feitas só com material do próprio rascunho). Ética: sem escassez falsa nem dark patterns. MUST be invoked when the user says: rever a psicologia da copy, porque é que este anúncio não prende, aplicar psicologia à campanha, director of psychology, onde isto perde as pessoas. SHOULD also invoke when: rever a proposta antes do cliente, melhorar o gancho, escolher gatilhos de persuasão, rever landing ou email da campanha."
triggers: mkt-psicologia, psicologia, psicologia do marketing, persuasão, gatilhos mentais, vieses cognitivos, prova social, escassez, ancoragem, rever copy, onde perde as pessoas, porque não prende, melhorar o gancho, director of psychology, marketing psychology, persuasion, cognitive bias, review hook, punch this up
chain: mkt-revisor-agent, mkt-relatorio
---
# mkt-psicologia

Entra na **F2 Proposta** em dois momentos: **aplicar** (a `mkt-estrategia` e a `mkt-copy` escolhem princípios)
e **rever** (depois de `mkt-copy` e `mkt-medicao`, antes do revisor adversarial). Serve também a F3 (texto das
peças) e a F5 (porque é que um anúncio perdeu). Tabela de modelos: `"<MKT>/referencias/psicologia.md"`.

## Recebe
- `<RAIZ>/clientes/<slug>/marca.md` (público, voz, restrições).
- Modo aplicar: a peça ou decisão em causa (secção do `02-proposta.md`, brief de peça).
- Modo rever: `ciclos/<ciclo>/02-proposta.md` «Estratégia e canais», «Campanhas» e «Mensagens e copy» ou um rascunho avulso
  (anúncio, landing, email, guião, post).
- `"<MKT>/referencias/psicologia.md"`.

## Entrega
- Modo aplicar: 2-4 princípios por peça, cada um com o porquê — devolvidos a quem chamou (a `mkt-copy` grava-os em «Mensagens e copy»).
- Modo rever: `02-proposta.md` «Revisão psicológica» (dentro de «Mensagens e copy») — só entre `<!-- mkt-psicologia:inicio -->` e `<!-- mkt-psicologia:fim -->`.
  Rascunho avulso → resposta no chat (ou ficheiro que o utilizador indicar).

## Regras
- **Regra da fonte (modo rever):** cada sugestão é montada **só com material do rascunho** (e de `marca.md`/factos
  aprovados quando é uma peça da proposta). Número, nome, ferramenta, afirmação ou imagem que não esteja lá →
  sugestão inválida. Exceção: palavras de ligação («por isso», «mas»).
- **Ética — teste do leitor informado:** a peça continua a funcionar se o leitor souber exatamente o que estamos
  a fazer e porquê? Se não, sai. Proibido: escassez ou urgência falsa (contadores que recomeçam, «só restam 3»
  fixo, «última oportunidade» repetida), prova social inventada ou arredondada para cima, âncoras de preço que
  nunca existiram, medos fabricados, inimigos inventados, consentimentos pré-marcados, «Recusar» escondido.
- Não citar como ciência o que não se replica (Zeigarnik, «2:1» da aversão à perda, «7 contactos») — ver a referência.
- Falar do efeito no leitor, não do nome da técnica (ver «Vocabulário» abaixo).
- Nunca publicar em Artifact; o que for visual sai em ficheiro local.

## Modo A — aplicar (estratégia e copy)

Para cada peça de «Materiais a produzir» (ou decisão de «Estratégia e canais»):
1. Situar: onde está o leitor no funil (não conhece / compara / decide) e o que o impede de agir agora.
2. Escolher **2-4 princípios** da tabela de `referencias/psicologia.md` pelo bloqueio, não pela moda:

| Bloqueio do leitor | Princípios a considerar |
|---|---|
| Não confia (marca desconhecida) | prova social real, autoridade (fez, não diz), *pratfall*, disponibilidade (casos com fotos) |
| Acha caro | ancoragem honesta (custo de não resolver), enquadramento, contabilidade mental, contraste |
| Adia («depois vejo») | urgência honesta (capacidade, data real, época), aversão à perda **só no fecho**, imediato |
| Não percebe o que é | especificidade, fluência (palavras simples), lacuna de curiosidade com resposta na peça |
| Desiste no formulário | Lei de Hick, energia de ativação (2 passos), gradiente de objetivo |
| Tem medo de errar | aversão ao arrependimento (garantia), reciprocidade (diagnóstico grátis), pé na porta |

3. Para cada princípio: uma linha «porquê aqui» + **o material real que o sustenta** (avaliação do GBP, prazo
   cumprido, caso com autorização). Sem material real → o princípio não entra (escreve-se «falta: …»).
4. Passar o teste do leitor informado. Devolver a lista a quem chamou.

## Modo B — rever um rascunho

Cinco passadas **internas**, por esta ordem; as três primeiras não produzem sugestões.

**1. Inventário.** Tirar do rascunho: todos os números, nomes próprios, afirmações, a sequência do que
acontece, **a coisa que só esta marca podia ter escrito** (normalmente o que faz, não o que sabe), e **a frase
mais forte**, citada com o sítio onde está. Rascunho sem números, sem nada específico, sem nada que só a marca
diria → *isso* é o diagnóstico; pedir o material real que ficou de fora (modo interativo) ou registá-lo.

**2. Localizar a falha** — seis perguntas:
1. Quem é a marca aqui: alguém com opiniões ou alguém com resultados? Um concorrente podia publicar isto igual?
2. O que acontece no primeiro momento (primeira linha, primeiro frame, acima da dobra, assunto do email)?
3. O que faz ficar depois disso: há um fim que o leitor imagina e espera? O custo de não fazer nada está dito?
4. O que segura a peça: algo que se conta e acompanha, ou nada?
5. Porque não sai a meio: há sempre algo por resolver, ou cada parte fecha e dá licença para sair?
6. Como acaba: a última linha responde à primeira e pede **uma** ação?

**3. Verificações** (com evidência do rascunho):
- Depois da abertura, escrever a pergunta que o leitor faz. Não cabe em 6 palavras → a abertura é mole.
- A 2.ª linha responde já à pergunta da 1.ª? (tensão perdida)
- A frase mais forte está na abertura? Se não, onde está?
- Há um troço em que nada fica por resolver? É aí que saem.
- A mesma ideia dita três vezes? Citar as variantes.
- A última linha responde à primeira? Alguém notava se fosse apagada?
- O que é que a abertura obriga a peça a entregar — entrega, e cedo?
- Que afirmações caem se o leitor responder «como?» ou «quais?» (precisão sem base é pior do que vagueza).
- Anúncio → landing: a promessa do anúncio aparece no título da landing (*message match*)?

**4. Prescrever.** Cada mudança com o sítio citado e construída só com o inventário; nomear o material usado.
Preferir **mover** a inventar (subir a linha enterrada, cortar duas de três repetições, ligar secções).
**Máximo 5.**

**5. Cortar o que não é deles.** Apagar qualquer nota que se pudesse escrever sem ler o rascunho («melhore o
gancho» nunca sobrevive). Procurar o vocabulário proibido abaixo.

**Saída** (títulos com as palavras do leitor, não do método):
```
### <peça>
**O que tem de facto** — o material real; a frase mais forte citada, com o sítio.
**Onde perde as pessoas** — localizado, com evidência, em linguagem simples.
**Cinco mudanças** — numeradas: sítio citado → mudança, com o material do rascunho.
**Se só fizer uma coisa** — uma frase.
**Ética** — ✓ passa o teste do leitor informado · ou ✗ <o quê> → retirar.
```
Notas, não reescrita: quem decide reescrever é a `mkt-copy` (ou o autor). Público cativo (relatório a um cliente
que já paga) → dizer que o gancho é desnecessário e prescrever menos: o resultado principal na primeira linha.

**Vocabulário fora da saída:** inventário, auditoria de etapas, espinha, mecanismo, *foreshadow*, contrato de
promessa, loop auto-fechado, teste das seis palavras, regra da fonte, queda prevista, e os nomes dos vieses
quando servem de rótulo («falta prova social»). Diz-se o efeito: «nada aqui diz ao leitor o que terá no fim»;
«as 4,8 estrelas estão no rodapé e são a única coisa que um concorrente não podia escrever».
Teste: **esta frase podia aparecer no diagnóstico de outra peça?** Se sim, reescreve-se.

### Por formato — o primeiro momento

| Formato | O primeiro momento é | O fim importa porque |
|---|---|---|
| Anúncio de pesquisa | os 2-3 títulos que aparecem | o CTA decide o clique |
| Meta / LinkedIn | a 1.ª linha antes do «ver mais» e a imagem | o botão e a landing têm de cumprir a promessa |
| Vídeo curto | o primeiro frame, que tem de funcionar sem som | o último segundo é o que fica |
| Email | assunto + início da pré-visualização | decide se o próximo é aberto |
| Landing | o que está acima da dobra no telemóvel | o formulário e a página de obrigado (pico-fim) |
| Cartaz / flyer | o que se lê em 2-3 segundos a passar | QR + oferta + prazo real |

## Gravar (modo rever sobre a proposta)
Re-ler `02-proposta.md` imediatamente antes de escrever e editar só entre os marcadores `mkt-psicologia`.
Conteúdo: uma entrada por peça revista (formato acima) + uma nota sobre a **estratégia** («Estratégia e canais»): a oferta e o
funil usam princípios com material real? Há urgência sem base? Os ✗ éticos também vão para «Lacunas e por confirmar».

## Próximo passo (chain)
- Modo rever terminado → **`mkt-revisor-agent`** (revisão adversarial da proposta inteira; quem produziu não revê)
  → **`mkt-relatorio`** → gate de aprovação. As mudanças aceites aplicam-se pela `mkt-copy` (modo chamado por agente) antes do revisor.
- Modo aplicar → volta à skill que chamou (`mkt-estrategia` ou `mkt-copy`).

## Créditos
- Skill local `director-of-psychology` — `SKILL.md` (regra da fonte, cinco passadas, verificações, formato de saída,
  vocabulário a evitar, tabela por formato, integridade), `references/constructions.md` (barato vs. caro), `references/diagnostics.md`.
- Skill local `lead-magnet` — `references/psychology.md` (gatilhos e ética).
- coreyhaines31/marketingskills (MIT) — `skills/marketing-psychology/SKILL.md` (catálogo e Quick Reference desafio → modelos).
