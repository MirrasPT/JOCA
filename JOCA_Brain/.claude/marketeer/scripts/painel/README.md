# painel — painel HTML do Marketeer (qualquer cliente)

```bash
node painel.mjs --cliente "<RAIZ>/clientes/<slug>" [--ciclo AAAA-MM] [--saida <ficheiro.html>]
```
Por omissão: ciclo = campo `ciclo` do `estado.json`; saída = `<cliente>/painel.html`. Nunca escreve por cima de um
ficheiro que não tenha sido gerado por este painel (`<meta name="gerador" content="marketeer-painel">`) — nesse caso
grava `<nome>-vN.html`. Só lê; nenhum ficheiro do cliente é alterado.

**Lê:** `marca.md` (nome = 1.º `# `, antes de « — ») · `conectores.md` (1.ª tabela com coluna `canal`) · `estado.json` ·
`auditorias/*.json` (o mais recente) · `ciclos/<ciclo>/`: `01-analise.md` · `02-proposta.md` · `revisao-<fase>.md` e
`revisao-<fase>-*.md` (voltas seguintes) · `vendas-woocommerce-*.json` (campo `mensal`, `catalogo`, objeto com
`produto_id` = produto em foco) · `meta-ads-*.md` (secções `## Janelas…` e `## Por mês…`) · `03-artes/` ·
`04-implementacao.md` · `05-review.md`. Ficheiro em falta → a secção diz «ainda sem dados».

**Ordem de leitura:** onde estamos (F0–F5 + próxima ação) → decisões pedidas → números e gráficos → revisão →
proposta → vendas → anúncios Meta → auditoria e acessos → análise → mercado → F3/F4/F5 → lacunas → fontes.

**Gráficos de avaliação** (SVG inline, sem bibliotecas; um só eixo; título com a conclusão; tabela de dados ao lado):
(a) vendas pagas da loja vs gasto Meta, € por mês · (b) gasto Meta ÷ vendas pagas, com o teto = preço de tabela do
produto em foco (sem produto em foco: ticket médio 90 dias) · (c) compras reportadas pela Meta vs vendas pagas ·
(d) faixa de fases F0–F5 e veredito da revisão (um ponto por juiz e por volta). Mês da loja sem linha dentro do
histórico = 0 (o ficheiro lê o histórico todo); antes do histórico = não verificado. Mês Meta sem linha = 0 só se o
ficheiro o disser («Meses sem linha = gasto 0»).

Ficheiros: `painel.mjs` (dados e secções) · `graficos.mjs` (SVG) · `md.mjs` (markdown mínimo) · `estilo.css`
(embutido no HTML).

## Paleta base do Marketeer

Neutra, sem cor de marca (nenhum token de cliente entra no painel). Contraste medido (WCAG 2.x) contra a superfície
onde cada cor é usada; texto ≥ 4,5:1, marcas de gráfico ≥ 3:1.

| Papel | Claro | Contraste (sup. `#ffffff`) | Escuro | Contraste (sup. `#1c1d1f`) |
|---|---|---|---|---|
| fundo da página | `#f6f6f3` | — | `#111213` | — |
| superfície | `#ffffff` | — | `#1c1d1f` | — |
| tinta (texto) | `#17181a` | 17,77 | `#f2f2f0` | 15,05 |
| tinta 2 | `#45484d` | 9,18 | `#c9c9c3` | 10,14 |
| tinta 3 (notas, eixos) | `#5f636a` | 6,04 | `#a3a39d` | 6,65 |
| acento (ligações) | `#1f5fae` | 6,35 | `#8ab8f2` | 8,21 |
| texto ok / crítico / aviso | `#006300` / `#a82828` / `#7a5200` | 7,54 / 7,00 / 6,92 | `#5fcf5f` / `#f29a9a` / `#f0bf55` | 8,50 / 7,92 / 9,87 |
| série 1 (loja) | `#2a78d6` | 4,42 | `#3987e5` | 4,64 |
| série 2 (Meta) | `#eb6834` | 3,20 | `#d95926` | 4,34 |
| crítico (marca) | `#d03b3b` | 4,80 | `#e66767` | 5,22 |
| ok (marca) | `#0ca30c` | 3,35 | `#0ca30c` | 5,19 |

Séries 1 e 2 = slots 1 e 2 da paleta de referência da skill `dataviz`; validadas com
`validate_palette.js` (claro e escuro: todos os testes passam, ΔE CVD 24,7 / 26,8). Caixas de estado com texto
sobre fundo tingido: ≥ 5,5:1 nos dois modos. O modo escuro segue o sistema e tem botão próprio (guardado no browser).
