---
paths:
  - "database/migrations/**/*.php"
  - "app/Models/**/*.php"
---

# Database rules

## Migrations

- **Never change a migration already applied in production.** Create a new one.
- Every migration has to be reversible — a real `down()`, not an empty one.
- Foreign keys with explicit delete behavior
  (`cascadeOnDelete`, `restrictOnDelete`, `nullOnDelete`).
- Indexes on the columns used in `where`, `orderBy` and joins.

## Models

- Explicit `$fillable`, coherent with what the request accepts. Never
  `$guarded = []` in models that receive user input.
- Declared casts (dates, booleans, enums, JSON).
- Relations with a typed return type.

## Queries

- **N+1 is a bug.** Load relations with `with()` before iterating collections.
- Pagination on any listing that can grow.
- Heavy work in a request → queued job.

## Before writing

Read `docs/ARCHITECTURE.md` for the current data model. If Laravel
Boost is available, use its tools to read the real schema instead of
inferring it.
