# /resume — 2h: projectos de design sem código

Sem repo, o 2b não tem nada para comparar e a memória fica sem contraditório. O contraditório são os
**finais já entregues**: listar a pasta de entrega (`_Final/`, `_Publicar/`, `Entregues/` — o que o
projecto usar), **medir dimensões**, amostrar as cores dominantes e registar as bandas de layout
ocupadas (onde está o logo, o texto, a margem).

```bash
ls -lt "<pasta>/_Final" | head -20
python -c "from PIL import Image;import sys,glob
for f in sorted(glob.glob(sys.argv[1]))[:12]:
    im=Image.open(f); print(im.size, f)" "<pasta>/_Final/*.png"
```

**O material do cliente vem ANTES de amostrar cores.** Antes de fazer engenharia inversa dos
pixels, inventariar as pastas de origem (`_material/`, `_ref/`, `_briefing/`, `Fornecido/`) e **ler**
o que lá está escrito — `.rtf`, `.txt`, `.md`, `.docx`. É onde o cliente costuma mandar os códigos de
cor, as fontes e as regras, por escrito. Amostrar a cor dominante de um JPEG comprimido quando o
`.rtf` ao lado diz o hex exacto é inventar um token que já era facto:

```bash
ls -R "<pasta>"/_material "<pasta>"/_ref 2>/dev/null | head -40
find "<pasta>" -maxdepth 3 \( -name '*.rtf' -o -name '*.txt' -o -name '*.md' \) -print 2>/dev/null
textutil -convert txt -stdout "<ficheiro>.rtf" 2>/dev/null | head -40   # macOS: lê RTF sem abrir app
```

Cor/fonte lida de um documento fornecido é **facto documentado**; amostrada de um PNG é **estimativa**
— e marca-se como tal (`soul.md`: sem token medido ou documentado → `TODO: token em falta`).

**Entregas anteriores = espaço ocupado.** Em produção recorrente (posts, campanhas, peças mensais),
listar o que já foi publicado/entregue como **inventário a não repetir** — tema, imagem, frase de
abertura — e pô-lo no resumo antes de produzir peças novas. Sem isto, repete-se um post de há dois meses.

**Um final exportado pelo cliente/designer é o brandguide de facto quando não há documento** — e é a
única forma de saber o **formato-alvo real**.
> Caso real: entregaram-se 6 imagens a 1080×1350 porque era o que a memória dizia; o formato de
> entrega era **1200×1500**, descoberto por acaso ao inspeccionar finais exportados minutos depois.
> Ninguém tinha medido os finais em 2 meses de projecto, e a memória afirmava "o sistema de design
> está por definir" quando existia um sistema completo, visível nos PNG de `_Final/`.

**Projecto de design com site publicado: medir COBERTURA, não só o que foi entregue.** A memória
lista os entregáveis; ninguém compara essa lista com o inventário de páginas do site-alvo, portanto
páginas por redesenhar ficam invisíveis até o cliente perguntar. Puxar o inventário do próprio site
e cruzar:

```bash
curl -s <url>/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//' | sort -u    # inventário real
ls "<pasta>/_Final" | sed 's/\.[a-z]*$//' | sort -u                              # o que existe feito
```

Sem `sitemap.xml`, extrair os `href` internos da homepage. Reportar no resumo em três números:
**páginas do alvo · com entregável · sem entregável**, e nomear as que faltam. Uma cobertura parcial
apresentada como "entregue" é a forma mais comum de um projecto de design parecer fechado e não estar.
