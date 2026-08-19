# Stack padrao — a stack da casa

Salvo impossibilidade real, **todos os projectos novos usam a stack da casa**:

| Camada | Peca |
|---|---|
| Frontend web | **Next.js 16** (sites/landing) ou **Livewire 4 + Flux** (apps Laravel) |
| Backend | **Laravel 13** |
| Backoffice | **Filament v5** |
| Base de dados | **MySQL 8.4** (gerida por phpMyAdmin) ou **PostgreSQL 17** |
| Movel | **Flutter** |
| Jogos moveis | **Unity 6** |

O `/start` escolhe **que pecas entram** conforme o produto — nao pecas fora da casa. Sair da stack
exige razao registada em `docs/DECISIONS.md`. Projecto herdado noutra stack: propor conversao
quando o custo for razoavel; se ficar, registar porque.
