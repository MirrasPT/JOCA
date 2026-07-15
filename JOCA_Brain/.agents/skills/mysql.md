---
name: mysql
description: "MySQL query writing, performance optimization, schema design, SQL debugging. MUST be invoked when the user says: MySQL, mysql, query lenta, slow query, EXPLAIN, index, indice, migration. SHOULD also invoke when: schema, database, base de dados, N+1, query optimization, full table scan."
triggers: MySQL, mysql, query lenta, slow query, EXPLAIN, index, indice, migration, schema, database, base de dados, N+1, query optimization, full table scan, covering index, composite index, deadlock, lock, InnoDB, utf8mb4, DECIMAL, JSON column, query performance, database design, normalization, denormalization, foreign key, constraint
chain: query-debugger
---
# MySQL

Schema design and optimization. EXPLAIN analysis, composite indexes, SARGability, efficient pagination.

Auto-invoked by `laravel-specialist` for slow queries or schema design.

---

## SARGability -- #1 performance killer

```sql
-- MAU: funcao em coluna indexada = full table scan
WHERE YEAR(created_at) = 2024
WHERE UPPER(email) = 'JOHN@EXAMPLE.COM'
WHERE LEFT(customer_code, 3) = 'ABC'
WHERE salary * 1.1 > 50000

-- BOM: range comparison preserva index
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
WHERE email = 'john@example.com'
WHERE customer_code LIKE 'ABC%'
WHERE salary > 50000 / 1.1
```

---

## Composite indexes -- leftmost prefix rule

```sql
-- Index (A, B, C) funciona para: WHERE A, WHERE A+B, WHERE A+B+C
-- NAO funciona para: WHERE B, WHERE B+C, WHERE C

-- Ordem: EQUALITY primeiro, RANGE segundo, ORDER BY ultimo
CREATE INDEX idx_orders ON orders(status, created_at);
-- OK: WHERE status = 'active' ORDER BY created_at
-- KO: WHERE created_at > '2024-01-01' (sem status)

-- Covering index: inclui colunas do SELECT para evitar table reads
CREATE INDEX idx_covering ON orders(customer_id, created_at, total_amount, status);
-- SELECT total_amount, status FROM orders WHERE customer_id = 1 ORDER BY created_at
-- = index-only scan, zero table reads
```

---

## EXPLAIN -- what to check

```sql
EXPLAIN FORMAT=JSON SELECT ...;
```

| Sinal | Significado |
|-------|-------------|
| `type: ALL` | Full table scan -- CRITICO |
| `type: index` | Full index scan -- WARNING |
| `type: ref/eq_ref` | Index lookup -- BOM |
| `type: const` | Single row by PK -- OPTIMO |
| `Extra: Using filesort` | ORDER BY not served by index |
| `Extra: Using temporary` | Temp table created |
| `rows >>` actual rows | Stale stats -- run `ANALYZE TABLE` |

---

## Pagination -- never large OFFSET

```sql
-- MAU: le e descarta 100.000 linhas
SELECT * FROM products ORDER BY created_at DESC LIMIT 20 OFFSET 100000;

-- BOM: cursor/keyset pagination
SELECT * FROM products
WHERE created_at < '2024-06-15 10:30:00'
ORDER BY created_at DESC LIMIT 20;

-- Ou por ID:
SELECT * FROM products WHERE id > 1000 ORDER BY id LIMIT 20;
```

Laravel: `simplePaginate()` (no COUNT), cursor pagination for large datasets.

---

## Useful patterns

### EXISTS vs COUNT
```sql
-- MAU: conta todas as linhas
IF (SELECT COUNT(*) FROM orders WHERE user_id = 1) > 0

-- BOM: para na primeira
IF EXISTS (SELECT 1 FROM orders WHERE user_id = 1)
```

### Conditional aggregation
```sql
-- MAU: 3 queries
SELECT COUNT(*) FROM orders WHERE status = 'pending';
SELECT COUNT(*) FROM orders WHERE status = 'shipped';

-- BOM: 1 query
SELECT
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped
FROM orders;
```

### Batch inserts
```sql
-- MAU: row-by-row
INSERT INTO products (name, price) VALUES ('A', 10);
INSERT INTO products (name, price) VALUES ('B', 15);

-- BOM: batch
INSERT INTO products (name, price) VALUES ('A', 10), ('B', 15), ('C', 20);
```

### JOINs -- always index the ON column
```sql
-- Every JOIN ON column MUST have an index
-- INNER JOIN for required matches (not LEFT JOIN)
-- Push filters to ON clause when possible
```

---

## Schema rules

| Regra | Detalhe |
|-------|---------|
| Sempre `utf8mb4` | `utf8` do MySQL e incompleto (3 bytes, sem emoji) |
| `DECIMAL` para dinheiro | Nunca `FLOAT`/`DOUBLE` -- perda de precisao |
| `DATETIME` > `TIMESTAMP` | TIMESTAMP tem limite 2038 e e 4 bytes; DATETIME e 5 bytes sem limite |
| InnoDB sempre | MyISAM so para append-only logs |
| Menor tipo possivel | `TINYINT` para status/booleans, nao `BIGINT` |
| ULIDs como PK se API-exposed | `$table->ulid('id')->primary()` em Laravel |
| Auto-increment para PKs internas | Quando nao exposto na API, melhor para InnoDB clustering |

---

## Anti-patterns

| Errado | Problema | Fix |
|--------|----------|-----|
| Funcao em coluna indexada no WHERE | Full table scan | Range comparison |
| `SELECT *` | Impede covering indexes | Especificar colunas |
| `LIMIT N OFFSET grande` | Le e descarta N rows | Cursor pagination |
| LEFT JOIN quando precisa INNER | Retorna nulls, confunde optimizer | INNER JOIN |
| `FLOAT`/`DOUBLE` para dinheiro | Perda de precisao | `DECIMAL(precision, scale)` |
| `utf8` charset | Trunca 4-byte chars | `utf8mb4` |
| String literal vs coluna INT | Conversao implicita, index quebrado | Match types |
| Sem index em coluna JOIN | Nested loop sem index | Indexar |
| `COUNT(*) > 0` para existencia | Conta tudo | `EXISTS` |
| Subquery correlacionada | Corre por row | Window function ou JOIN |

---

## Performance targets

| Metrica | Target |
|---------|--------|
| Query execution | < 100ms |
| Index usage rate | > 95% |
| Cache hit rate | > 90% |
| Lock waits | < 1% |

---

## Findings classification

- **CRITICAL**: wrong results, data loss, full scans on large tables
- **WARNING**: significant perf issue (missing index on JOIN)
- **SUGGESTION**: improvement (better data types)
- **INFO**: educational note

---

## Laravel integration

Rules auto-applied when `laravel-specialist` invokes this skill:
- `simplePaginate()` over `paginate()`
- Eager loading with `::with()` to avoid N+1
- `$table->index()` on foreign key and frequent filter columns
- `EXPLAIN` before approving complex queries
