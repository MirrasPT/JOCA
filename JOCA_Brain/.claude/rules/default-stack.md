# Standard stack — the house stack

Barring real impossibility, **every new project uses the house stack**:

| Layer | Piece |
|---|---|
| Web frontend | **Next.js 16** (sites/landing) or **Livewire 4 + Flux** (Laravel apps) |
| Backend | **Laravel 13** |
| Backoffice | **Filament v5** |
| Database | **MySQL 8.4** (managed with phpMyAdmin) or **PostgreSQL 17** |
| Mobile | **Flutter** |
| Mobile games | **Unity 6** |

`/start` chooses **which pieces go in** according to the product — not pieces outside the house.
Leaving the stack requires a reason recorded in `docs/DECISIONS.md`. Project inherited on another
stack: propose conversion when the cost is reasonable; if it stays, record why.
