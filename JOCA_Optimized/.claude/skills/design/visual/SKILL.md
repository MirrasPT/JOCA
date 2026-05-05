---
name: visual
description: Visual asset generation — static art, brand-aligned design, and AI image generation routing. Use when creating posters, artwork, illustrations, static visual designs, brand-styled artifacts, or generating images via AI (OpenAI or Google). Triggers: generate image, create image, make image, poster, artwork, illustration, visual design, brand colors, Anthropic brand, canvas design, art, graphic, icon, banner, mockup, logo usage.
---

## Brand (Anthropic)
Colors: Dark `#141413` · Light `#faf9f5` · Mid Gray `#b0aea5` · Light Gray `#e8e6dc` · Orange `#d97757` · Blue `#6a9bcc` · Green `#788c5d`
Typography: Headings → Poppins (Arial fallback) · Body → Lora (Georgia fallback)
Apply when: user asks for Anthropic-styled artifact, brand colors, or corporate identity.

## Canvas Design (static visual art)
Two-step process:
1. **Design Philosophy** — name an aesthetic movement (e.g. "Brutalist Joy"), write a visual manifesto (form/space/color/composition, minimal text as visual accent)
2. **Express visually** — create `.pdf` or `.png` that is 90% visual, 10% essential text. Never copy existing artists.

Output formats: `.md` (philosophy) + `.pdf` or `.png` (artifact)

## Image Generation Router
Analyse request → pick model → craft optimal prompt → spawn agent.

USE OpenAI (`img-gen-openai`) when: text in image · specific branded product shots · complex precise composition · inpainting/masking · high-fidelity delivery · dense typography/diagrams

USE Google (`img-gen-google`) when: general imagery (people/landscapes/scenes) · quick drafts/iteration · unusual aspect ratios · high-volume batch · web backgrounds/textures · no text required

USE BOTH when: user asks for comparison · high-stakes hero asset · ambiguous brief

PROMPT ENGINEERING: be specific about style, lighting, composition, mood. Include negative prompts for OpenAI. For Google: lead with subject, add style qualifier, end with technical specs (aspect ratio, quality).

NEVER: use img-gen-openai or img-gen-google skills directly — always route through this skill · skip model selection reasoning
