# Teste de orquestração JOCA — estado de Bigorna, Meu Site e Livro de Elogios

TAGS: JOCA, Bigorna 2026, Meu Site, Livro de Elogios, git, workers
JANELA: win-8 (8 turnos)

Janela de teste à orquestração do JOCA Master sobre 3 workers, cada um na sua pasta. "Livro de elogios" = LE_Nova_Plataforma / livro_redesign.
Meu Site (renatoferreira.org): `main` com working tree limpo, nada por commitar; último commit `fb2cc2b` (hardening auth/segurança + optimização frontend). Foi arrancado (`node server.js`, SQLite `portfolio.db`) e aberto no browser — abriu em http://localhost:7381 (HTTP 200) por causa de uma variável de ambiente `PORT=7381` herdada do setup JOCA que se sobrepôs ao `.env` (`PORT=3001`). Servidor ficou em background.
Livro de Elogios: branch `master` com apenas 1 commit inicial (`8cb280e`) e muito trabalho por commitar/untracked (backend Laravel 13+Filament v5, frontend React 19+Vite, docs, docker, testes Playwright; reorganização `_material/→assets/`, `Info_Cliente/→cliente/`). Fetch FALHOU — remote `github.com/MirrasPT/livro_redesign.git` devolve "Repository not found" (apagado/privado/URL errado); sem push/pull até corrigir o URL.
Bigorna 2026: backend dado como COMPLETO (8/8 fases do `BACKEND_BUILDPLAN.md`, 235 testes, API `/api/v1`, carrinhos+abandonados, stock, state-machine, notificações, emails/funis); foco mudou para frontend SPA React 19 + Vite + TS + Tailwind 4. Problema crítico: a pasta NÃO é repositório git — todo o trabalho sem versionamento/backup.
Por fazer: confirmar se faz `git init` + commit inicial no Bigorna; corrigir remote do Livro (falta URL correto); corrigir o `CLAUDE.md` raiz que descreve o Bigorna desactualizado (fases 0-4/8, 99 testes em vez de 8/8, 235 testes); decidir se reinicia o Meu Site na porta 3001.
Preferência do Renato: confirmações curtas, pedidos focados, acções reversíveis.