# Padrões de slop — lista alargada (on-demand)

Lida pela skill `stop-slop` na passada de marcação. Complementa as listas da skill; não as repete.
Adaptado de blader/humanizer v3.1.0 (MIT, © 2025 Siqi Chen), que parte da página «Signs of AI writing» da Wikipedia (WikiProject AI Cleanup).

**Força:** **F** = forte, justifica edição à 1.ª ocorrência · **f** = fraco sozinho, só conta com outros sinais no mesmo trecho.
Cada linha: padrão · o que vigiar (EN / PT) · o que fazer.

## A. Encenar em vez de afirmar

| # | Padrão | Vigiar | Fazer | Força |
|---|---|---|---|---|
| 1 | Fechos de uma linha | parágrafo de 1 frase que repete o anterior; frase depois de um exemplo a dizer o que ele mostrou; «E isso faz toda a diferença.», «Simples assim.»; palavra em MAIÚSCULAS ou com pontos (to. dos. os. dias.) | cortar se repete; manter só se acrescenta um facto | F |
| 2 | Aforismos falsos | «X is the language of Y», «X becomes a trap», «not a tool but a mirror», «the currency/architecture of» · «a linguagem da confiança», «a moeda de», «o ADN de» | trocar pela afirmação concreta | F |
| 3 | Arranque encenado | «Let's dive in», «without further ado», «Honestly?» · «Vamos a isso», «Sem mais demoras», «Aqui fica o que precisas de saber», «Sejamos honestos» | cortar o arranque, não só o tom | F |
| 4 | Discutir com ninguém | «I'm not saying», «To be clear», «Don't get me wrong», «A tempting approach would be» · «Não estou a dizer que», «Para ser claro», «Seria tentador» | tirar a defesa contra objecção que ninguém levantou; manter a opção que o leitor pesaria mesmo | F |

## B. Ritmo por regra

| # | Padrão | Vigiar | Fazer | Força |
|---|---|---|---|---|
| 5 | Aberturas repetidas | «Ela… Ela… Ela…» em frases seguidas | fundir ou mudar o sujeito; não banir a palavra | f |
| 6 | Qualificadores empilhados | «could potentially», «might arguably» · «poderá eventualmente», «é possível que talvez» | 1 qualificador só se a fonte o suporta; «talvez»/«tende a» são humanos | f |

## C. Inflação e autoridade emprestada

| # | Padrão | Vigiar | Fazer | Força |
|---|---|---|---|---|
| 7 | Vocabulário marcado (EN) | additionally, align with, bolstered, crucial, delve, enduring, enhance, garner, highlight (v.), interplay, intricate, key (adj.), landscape, meticulous, pivotal, quietly, robust (fig.), showcase, tapestry, testament, underscore, valuable, vibrant | trocar pela palavra simples; o problema é o grupo | F em grupo |
| 8 | Significância inflacionada | «a pivotal moment», «plays a key role», «Challenges and Legacy», «the future looks bright» · «marca um momento decisivo», «desempenha um papel fundamental», «no panorama actual», «o futuro afigura-se promissor» | manter o facto, largar a importância; acabar no último facto concreto | F |
| 9 | Ligação vaga | «associated with», «linked to» · «associado a», «ligado a», «em articulação com» | nomear a relação que a fonte dá; se não dá, manter vago, **nunca inventar o papel** | F |
| 10 | Cauda de gerúndio | «…, highlighting/underscoring/reflecting/fostering» · «…, reforçando/destacando/sublinhando/reflectindo» | manter o facto; a cauda só se a fonte suporta o que afirma. Em PT-PT pesa a dobrar: gerúndio solto é também marca de PT-BR | F |
| 11 | Linguagem de brochura | nestled, in the heart of, breathtaking, must-visit, renowned, rich (fig.) · «situado no coração de», «deslumbrante», «de cortar a respiração», «rico património» | dizer o que a coisa é | F |
| 12 | Autoridade emprestada | «experts argue», lista de meios de prestígio, «over N followers» · «os especialistas defendem», «segundo vários estudos» | usar a fonte real e o que disse; senão cortar. Falta de citação sozinha não é sinal | F |
| 13 | Fugir de é/tem | serves as, stands as, boasts, features, offers · «funciona como», «assume-se como», «constitui», «conta com», «dispõe de» | «é» / «tem» | f |

## D. Formatação por regra

| # | Padrão | Vigiar | Fazer | Força |
|---|---|---|---|---|
| 14 | Negrito decorativo | negrito sem razão; listas com rótulo a negrito + dois pontos em todos os itens | tirar o negrito; lista de rótulos vazios → prosa | F |
| 15 | Cabeçalhos decorativos | Title Case, emojis/setas em títulos, `---` entre todas as secções, H1 que repete o título, título «de efeito» | capitalização de frase; o título diz o que a secção tem | F (em PT o Title Case é sempre forte) |

## E. Restos do chat e do rascunho — remover sem reescrever

| # | Padrão | Vigiar | Fazer | Força |
|---|---|---|---|---|
| 16 | Resíduo de chatbot | «I hope this helps», «Great question!», «Would you like…» · «Espero que ajude», «Excelente pergunta!», «Claro!», «Com certeza!», «Queres que…?» | tirar o invólucro, manter o conteúdo. O sinal mais certo da lista | F |
| 17 | Limite de conhecimento + palpite | «as of my last update», «not widely documented», «likely grew up…» · «não há informação disponível», «terá provavelmente…» | dizer o que a fonte não mostra, ou cortar; **o palpite a preencher o vazio sai sempre** | F |
| 18 | Cabeçalho repetido na 1.ª frase | «## Desempenho» seguido de «A velocidade importa.» | cortar a frase | F |
| 19 | Escrever sobre o documento | «was added to replace», «compiled from», «the table below compares» · «esta secção foi acrescentada para», «a tabela abaixo compara», «compilado a partir de» | falar do assunto; versão anterior só em changelog; aviso só se muda o que o leitor faz | f (uma ocorrência) |

## F. Leitor errado

| # | Padrão | Vigiar | Fazer | Força |
|---|---|---|---|---|
| 20 | Re-explicar o que o leitor já sabe | resposta curta que refaz o problema, o diagnóstico e as provas, com a decisão na última linha | decisão primeiro; só o raciocínio que mudaria a concordância do leitor. Só se aplica quando se vê a conversa à volta (comentário de PR, issue, resposta a cliente) | F |

## Lista de palavras PT — **a validar com texto real**

Ponto de partida, não medido: saiu de uma análise, não de um corpus. Confirmar contra texto real do dono/cliente antes de a tratar como proibida.

crucial · fundamental · robusto · potenciar · alavancar · mergulhar · desbloquear · jornada · ecossistema · sinergia · holístico · disruptivo · «no panorama actual» · «em suma» · «importa salientar» · «vale a pena referir»

Intensificadores em «-mente» (o equivalente PT de «kill all adverbs»): realmente, verdadeiramente, profundamente, fundamentalmente, simplesmente, literalmente, basicamente. «ainda», «já», «só» são estruturais: ficam.

## Medir a voz a partir de amostras

Ideia adaptada de elvisun/newsjack `skills/voice-extractor` (MIT, © 2026 Elvis Sun). Com 5-20 textos reais do cliente/dono, medir antes de escrever:

```bash
python - amostras.txt <<'EOF'
import re, statistics, sys
t = open(sys.argv[1], encoding="utf-8").read()
frases = [f for f in re.split(r"(?<=[.!?…])\s+", t.strip()) if f]
n = [len(f.split()) for f in frases]
pal = len(t.split()) or 1
m = statistics.mean(n); cv = statistics.pstdev(n) / m
print(f"frases={len(n)} media={m:.1f} cv={cv:.2f}")
for nome, c in [("travessao", "—"), ("exclamacao", "!"), ("ponto_virgula", ";"), ("reticencias", "…")]:
    print(f"{nome}_por_1000={t.count(c) * 1000 / pal:.1f}")
EOF
```

Correr o mesmo sobre o rascunho e comparar:
- `cv` (variação do comprimento das frases) do rascunho muito abaixo do das amostras → ritmo achatado (o newsjack acusa abaixo de ~50% do valor medido).
- Pontuação que nas amostras está a 0 (travessão, ponto e vírgula) e no rascunho aparece → intrusão.
- Abertura ou transição que nunca aparece nas amostras («Além disso», «No entanto» a abrir frase) → não entra.
- Expressões que se repetem nas amostras → são da voz; um rascunho sem nenhuma perdeu a dicção.

As palavras-função e a diversidade lexical do newsjack estão calibradas para inglês; em PT usar só comprimento e pontuação até haver base medida.
