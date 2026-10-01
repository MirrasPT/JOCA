# Referência — lead magnets para PME de serviços e negócios locais

Usada pela `mkt-estrategia` (§Funil e captação) e pela `mkt-copy` (gancho e página de captação).
Um lead magnet é o **passo 1 da oferta paga**, entregue de graça em troca de um contacto. Se não leva
naturalmente ao serviço que a marca vende, atrai as pessoas erradas.

## 1. Os quatro princípios (filtro de qualquer conceito)

1. **Ponte** — consumir o lead magnet faz querer o serviço pago («gostei do diagnóstico → quero que
   resolvam o que ele mostrou»).
2. **Especificidade** — público, resultado e prazo concretos. «Guia de marketing» falha;
   «Checklist: 12 pontos para preparar a casa antes de remodelar a cozinha» funciona. Números só reais.
3. **Ganho rápido** — resolve um problema pequeno por inteiro em minutos, não promete tudo em semanas.
4. **Equação de valor** — valor = (resultado desejado × probabilidade percebida) ÷ (tempo de espera ×
   esforço). Subir o numerador (prova, especificidade) e baixar o denominador (formato curto, entrega imediata).

## 2. Tipos que servem a uma PME

| Tipo | Serve a | Intenção do lead | Custo para a marca | Ponte típica | Cuidados |
|---|---|---|---|---|---|
| **Diagnóstico / auditoria gratuita** (site, instalação, contas, processo) | Agências, técnicos, consultores, serviços B2B | Alta | Alto (tempo por lead) | O diagnóstico mostra o problema; o serviço resolve-o | Qualificar antes (2-3 perguntas); limitar por capacidade real («4 por semana» só se for verdade) |
| **Pedido de orçamento rápido / simulador** | Obras, cozinhas, energia, seguros, transportes | Alta | Médio (resposta em horas) | O orçamento é a primeira proposta | Prazo de resposta prometido tem de ser cumprido (quem responde está em `marca.md`?) |
| **Visita técnica / medição gratuita** | Serviços ao domicílio, remodelações | Muito alta | Alto (deslocação) | A visita fecha a venda | Zona de cobertura explícita no formulário |
| **Checklist / guia curto (PDF 1-4 páginas)** | Quase todos | Média | Baixo (fazer uma vez) | Mostra a complexidade → «preferem que tratemos nós?» | Tem de ser útil sozinho; nada de folheto disfarçado |
| **Guia local** («onde/como em <cidade>») | Comércio e serviços locais, turismo | Baixa-média | Baixo | Notoriedade local + lista de email | Fontes verificáveis; não citar terceiros sem autorização |
| **Calculadora** (poupança, prestação, consumo) | Energia, crédito, software, equipamentos | Média-alta | Médio-alto (construir) | O número pessoal cria a conversa | Fórmulas com fonte; disclaimer; nunca prometer o resultado |
| **Cupão / oferta de 1.ª visita** | Restauração, saúde, beleza, retalho | Média | Margem | Primeira compra → cliente recorrente | Condições claras, data de fim real, regras de preços (ver `mkt-estrategia` §Oferta) |
| **Workshop / sessão / evento** (presencial ou online) | Formação, B2B, lojas com demonstração | Alta | Médio | Demonstração ao vivo | Lembretes por email com consentimento; follow-up em 24-48 h |
| **Caso de estudo** | B2B, serviços caros | Média-alta | Baixo (se o caso existe) | Prova de capacidade | Autorização escrita do cliente citado; números reais |
| **Newsletter sazonal / alertas** («avisamos quando abrir a época») | Negócios sazonais | Baixa-média | Baixo-médio (regularidade) | Lembrança na altura certa | Cadência que a marca consegue manter |
| **Amostra / demonstração / teste** | Produto físico, software | Alta | Variável | Experimentar → comprar | Logística e stock reais |

Concursos e sorteios: têm regras próprias em Portugal `[por confirmar: enquadramento legal antes de propor]`
— não se propõem sem essa confirmação.

## 3. Como escolher (por esta ordem)

1. **Capacidade de resposta** — quem responde aos leads e em quanto tempo (`marca.md` §Restrições ou
   entrevista F0). Diagnóstico ou visita sem ninguém para os fazer = leads perdidos e marca queimada.
2. **Valor de um cliente** — serviço caro (> centenas de €) aguenta lead magnets de custo alto
   (diagnóstico, visita); serviço barato pede custo baixo (checklist, cupão).
3. **Ciclo de decisão** — decisão rápida (urgências, restauração) → oferta direta, não lead magnet;
   decisão lenta (obras, B2B) → lead magnet + sequência de email.
4. **Prova disponível** — sem casos nem avaliações, o diagnóstico gratuito *é* a prova.
5. **Canal** — pesquisa paga (intenção alta) → orçamento/visita; redes sociais (intenção baixa) →
   checklist, guia, calculadora; offline → QR para cupão ou guia.

Entregar **3 conceitos** na proposta, cada um com: conceito numa frase · formato · gancho (título) ·
ponte para a oferta · esforço de produção · dono e prazo. Recomendar um e dizer porquê, por estes critérios.

## 4. Formulário e entrega

- **Campos mínimos**: cada campo extra custa conversões. Lead magnet de baixa intenção → nome + email.
  Orçamento/visita → o que é preciso para responder (serviço, zona, contacto) — pode ser em 2 passos
  (primeiro o serviço, depois os contactos).
- **Consentimento** (RGPD + Lei 41/2004, art. 13.º-A: comunicações de marketing direto por correio
  eletrónico a pessoas singulares exigem consentimento prévio expresso — verificado 2026-10-01,
  diariodarepublica.pt/dr/detalhe/lei/41-2004-480710 e resumo ANACOM):
  - caixa de marketing **separada** e **não pré-marcada** («Quero receber novidades por email»);
  - entregar o lead magnet não pode depender de aceitar marketing — a entrega é o serviço pedido;
  - cada email de marketing tem forma gratuita e fácil de recusar (link de cancelamento);
  - guardar prova do consentimento (data, formulário, texto aceite) na ferramenta de email.
  Exceção para clientes existentes e produtos semelhantes: `[por confirmar no texto da lei antes de usar]`.
- **Medição**: o envio com sucesso dispara `generate_lead` com `formulario=<id>` (ver `mkt-medicao`).
- **Entrega imediata** (email 1 da sequência), com um próximo passo único.

## 5. Sequência a seguir ao lead magnet (resumo para a proposta)

| Sequência | Para quê | Tamanho típico |
|---|---|---|
| Boas-vindas | Entregar, apresentar, dar um ganho rápido, fazer a ponte, oferta | 5-7 emails |
| Nutrição | Valor e confiança entre a captação e a oferta | 4-6 emails |
| Conversão | Vender a oferta (objeções, prova, prazo real) | 4-7 emails |
| Reativação | Recuperar contactos inativos | 3-4 emails |

Um CTA por email. A escrita das sequências é da F4 (`mkt-email`); a F2 decide qual e com que objetivo.

## Créditos

- Skill local `lead-magnet` — `SKILL.md` (princípios, formatos, ganchos, teste), `references/services-magnets.md`.
- Skill local `email-sequences` — `SKILL.md` §Sequence Types.
- coreyhaines31/marketingskills (MIT) — `skills/offers/SKILL.md` (equação de valor), `skills/cro/references/form.md` (custo por campo).
