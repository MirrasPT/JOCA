# Estado dos 10 projectos + criação de Medieval Chess e Gerador de Rótulos no JOCA_OS

TAGS: joca_os, gestao-projectos, memoria-joca-brain, criacao-projectos, worker-resume, datalix-vps
JANELA: win-40 (8 turnos)

O Renato pediu o estado dos seus 10 projectos no JOCA_OS e uma verificação cruzada com a memória do JOCA_Brain. Um worker (`00c912f6`) devolveu a tabela de estado dos 10: JOCA (Fase 1a + memória 3-camadas), Bracaris Brasil (operacional), Bigorna (no GitHub, falta deploy+credenciais), Redes Vinhos/elite-imagens-db (pipeline AI em uso), UniMedia (build verde, falta commitar), Simao-sina (em dev), ComfyUI (Ideogram 4.0 + TRELLIS 2 testados), Meu Site (hardened, CI/cPanel prontos), LE_Nova_Plataforma/livro-de-elogios (falta URL do remote), Bodegas do Campo (no GitHub, falta deploy+SMTP).
A memória do JOCA_Brain tem 13 ficheiros de projecto vs 10 no JOCA_OS — faltavam 3: Medieval Chess, Gerador de Rótulos (DRC) e Datalix VPS. Confirmou-se que a memória é superset (nenhum dos 10 ausente).
Decisão tomada: o Renato pediu para criar os projectos. Foram criados os 2 locais — Medieval Chess (projectId `a59fe8ee`, `C:\Users\renat\Projetos\mediaval_chess`) e Gerador de Rótulos (projectId `301e327e`, `D:\_Restauros\Roma\Gerador`) — ambos já na sidebar.
Ficou por fazer: registar o Datalix VPS (remoto `194.62.248.50`, sem path local) — precisa de definir convenção/path antes. No fim, o Renato pediu um worker resume em todos os projectos e depois o estado de cada um (pedido pendente nesta janela).
Preferência do Renato: criar registos de projecto a partir da memória existente e manter JOCA_OS alinhado com o JOCA_Brain.