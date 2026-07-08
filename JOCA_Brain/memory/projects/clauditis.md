---
type: project
name: clauditis
created: 2026-06-30
---

# Clauditis — Redes Sociais

Criação de imagens/assets para redes sociais de uma **consultoria de gestão empresarial** (tom corporativo, PME portuguesas). Temas dos posts: formação, produtividade, burnout, organização/eficiência, liderança, preparação de equipa. Estilo WEOPTIMIZE-like (corporate, credível).

## Estrutura de pastas
```
D:\Mega\Clauditis\2026_Redes_Sociais\
  └── <MM>_<Mês>\           ex.: 07_Julho
        └── _material\      ← imagens geradas vão para aqui
```
Posts nomeados `NN_Post_DD_MM` (NN = ordinal do dia/template, DD_MM = data de publicação). Cada post tem *Copy Design* (texto sobre a imagem, aplicado depois) + *Copy Legenda* (caption).

## Especificação das imagens (validada 2026-06-30)
- **1 imagem por post.**
- **Gemini** (agy / nano_banana) — pedido explícito do cliente.
- **Foto realista** (não ilustração/3D/render), ambiente de **escritório/corporativo**.
- **3:4 portrait**, normalizado para **1080×1440** exacto.
- **SEM TEXTO** na imagem (sem letreiros, ecrãs legíveis, logos, números) — o texto é aplicado depois sobre a foto.

## Estado actual
**2026-06-30:** 4 imagens de Julho geradas e entregues em `07_Julho\_material\`:
- `01_Post_05_07.jpg` — workshop de formação (equipa a aprender)
- `04_Post_10_07.jpg` — empresários confiantes, escritório moderno
- `01_Post_18_07.jpg` — burnout silencioso (profissional exausta ao portátil)
- `01_Post_27_07.jpg` — reunião de estratégia (2º semestre)

## Gotcha técnico — agy/Gemini não respeita aspect ratio
agy (nano_banana) **ignora o rácio pedido** e devolve dimensões inconsistentes entre gerações (observado: 896×1200, 768×1024; docs dizem 1:1). **Sempre medir pixels reais (PIL) e normalizar** via cover-fit center-crop para o alvo (1080×1440). Não confiar no auto-relato do agente sobre orientação. Ver [[clauditis]] aprendizado no Brain log.

## Pendente
- Aplicar *Copy Design* sobre as fotos (pipeline de texto/template por definir).
- Confirmar marca/cliente exacto (logo, paleta, fontes) — copy actual é genérica.

## Última sessão
2026-06-30 — geração das 4 imagens de Julho (Gemini, 3:4, foto realista escritório, sem texto).
