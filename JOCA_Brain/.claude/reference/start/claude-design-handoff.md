# Handoff para o Claude Design (via 1 da Parte E2)

O utilizador escolheu criar o design no **Claude Design** (claude.ai). O JOCA prepara o pacote,
pausa, e converte o que voltar.

## 1. O pacote a entregar

Criar `design/handoff/` com copias de:

| Ficheiro | Porque vai |
|---|---|
| `PRD.md` | contexto do produto — o Claude Design compoe melhor com o porquê |
| `BRAND.md` | identidade, tom, logotipo |
| `DESIGN.md` | a direccao escolhida (tipografia, paleta, forma, densidade) — sao RESTRICOES |
| `ECRAS.md` | a lista completa de ecras, cada um com proposito e estados |

Mais `PROMPT.md` — o texto pronto a colar, gerado a partir deste esqueleto:

```
Vou dar-te 4 documentos de um produto chamado <nome>. Cria:
1. O design system (tokens em CSS custom properties, componentes base) seguindo o DESIGN.md
   a letra — e o contrato, nao inspiracao.
2. Todos os ecras listados no ECRAS.md, um ficheiro HTML autonomo por ecra,
   com OS QUATRO ESTADOS (vazio · a carregar · erro · cheio) separados por cabecalho.
3. Dados de exemplo plausiveis do dominio — nunca lorem ipsum.
4. Comentarios HTML a marcar que componente do design system cada bloco usa.
Formato: HTML/CSS/JS autonomo, sem frameworks externas, tokens so via custom properties.
```

Dizer ao utilizador: faz upload dos 4 + prompt no Claude Design; quando terminares, poe os
ficheiros exportados em `design/claude-design/` e avisa-me.

## 2. Quando os ficheiros voltarem

1. **Inventariar contra `ECRAS.md`** — ecra a ecra, um `ls` nao chega: o que falta lista-se
   explicitamente, nao se assume que veio tudo.
2. **`validar-design` a cada ecra** — tokens vs `DESIGN.md` (bloqueia se divergirem), 4 estados,
   acessibilidade. O Claude Design nao conhece o projecto; o porteiro e aqui.
3. **Converter para a stack** — os HTML sao a REFERENCIA, a conversao e re-implementacao fiel:
   - Laravel/Livewire → componentes Blade + Flux, tokens no `@theme` (`laravel-specialist` + `design-html`)
   - Next.js → componentes React + Tailwind (`frontend` + `tailwind` + `design-html`)
   - Flutter → `ThemeData` + widgets (`design-html` para ler, tema manual)
4. Originais ficam em `docs/mockups/` (referencia versionada). `design/claude-design/` pode ser
   apagada depois da conversao validada — pergunta primeiro.

## Armadilha conhecida

O Claude Design gera CSS proprio por ecra. **Dois ecras com tokens ligeiramente diferentes e o
defeito esperado**, nao a excepcao — por isso o `validar-design` corre ANTES da conversao: converter
um ecra fora do sistema e pagar a conversao duas vezes.
