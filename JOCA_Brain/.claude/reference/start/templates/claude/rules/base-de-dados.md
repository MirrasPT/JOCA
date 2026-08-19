---
paths:
  - "database/migrations/**/*.php"
  - "app/Models/**/*.php"
---

# Regras de base de dados

## Migrações

- **Nunca alterar uma migração já aplicada em produção.** Criar uma nova.
- Toda a migração tem de ser reversível — `down()` a sério, não vazio.
- Chaves estrangeiras com comportamento de eliminação explícito
  (`cascadeOnDelete`, `restrictOnDelete`, `nullOnDelete`).
- Índices nas colunas usadas em `where`, `orderBy` e junções.

## Modelos

- `$fillable` explícito, coerente com o que o request aceita. Nunca
  `$guarded = []` em modelos que recebem input de utilizador.
- Casts declarados (datas, booleanos, enums, JSON).
- Relações com o tipo de retorno tipado.

## Queries

- **N+1 é bug.** Carregar relações com `with()` antes de percorrer coleções.
- Paginação em qualquer listagem que possa crescer.
- Trabalho pesado em request → job em fila.

## Antes de escrever

Ler `docs/ARCHITECTURE.md` para o modelo de dados atual. Se o Laravel Boost
estiver disponível, usar as suas ferramentas para ler o schema real em vez de
o inferir.
