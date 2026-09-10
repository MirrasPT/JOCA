---
name: mysql
description: "MySQL query writing, performance optimization, schema design, SQL debugging. MUST be invoked when the user says: MySQL, mysql, slow query, EXPLAIN, index, migration. SHOULD also invoke when: schema, database, N+1, query optimization, full table scan."
triggers: MySQL, slow query, EXPLAIN, index, migration, schema, database, N+1, query optimization, full table scan, covering index, composite index, deadlock, lock, InnoDB, utf8mb4, DECIMAL, JSON column, query performance, database design, normalization, denormalization, foreign key, constraint
chain: query-debugger
---
# MySQL

Schema design and optimization. EXPLAIN analysis, composite indexes, SARGability, efficient pagination.

Auto-invoked by `laravel-specialist` for slow queries or schema design.

---

## SARGability -- #1 performance killer

```sql
-- BAD: function on an indexed column = full table scan
WHERE YEAR(created_at) = 2024
WHERE UPPER(email) = 'JOHN@EXAMPLE.COM'
WHERE LEFT(customer_code, 3) = 'ABC'
WHERE salary * 1.1 > 50000

-- GOOD: range comparison preserves the index
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
WHERE email = 'john@example.com'
WHERE customer_code LIKE 'ABC%'
WHERE salary > 50000 / 1.1
```

---

## Composite indexes -- leftmost prefix rule

```sql
-- Index (A, B, C) works for: WHERE A, WHERE A+B, WHERE A+B+C
-- Does NOT work for: WHERE B, WHERE B+C, WHERE C

-- Order: EQUALITY first, RANGE second, ORDER BY last
CREATE INDEX idx_orders ON orders(status, created_at);
-- OK: WHERE status = 'active' ORDER BY created_at
-- KO: WHERE created_at > '2024-01-01' (no status)

-- Covering index: includes the SELECT columns to avoid table reads
CREATE INDEX idx_covering ON orders(customer_id, created_at, total_amount, status);
-- SELECT total_amount, status FROM orders WHERE customer_id = 1 ORDER BY created_at
-- = index-only scan, zero table reads
```

---

## EXPLAIN -- what to check

```sql
EXPLAIN FORMAT=JSON SELECT ...;
```

| Signal | Meaning |
|-------|-------------|
| `type: ALL` | Full table scan -- CRITICAL |
| `type: index` | Full index scan -- WARNING |
| `type: ref/eq_ref` | Index lookup -- GOOD |
| `type: const` | Single row by PK -- OPTIMAL |
| `Extra: Using filesort` | ORDER BY not served by index |
| `Extra: Using temporary` | Temp table created |
| `rows >>` actual rows | Stale stats -- run `ANALYZE TABLE` |

---

## Pagination -- never large OFFSET

```sql
-- BAD: reads and discards 100,000 rows
SELECT * FROM products ORDER BY created_at DESC LIMIT 20 OFFSET 100000;

-- GOOD: cursor/keyset pagination
SELECT * FROM products
WHERE created_at < '2024-06-15 10:30:00'
ORDER BY created_at DESC LIMIT 20;

-- Or by ID:
SELECT * FROM products WHERE id > 1000 ORDER BY id LIMIT 20;
```

Laravel: `simplePaginate()` (no COUNT), cursor pagination for large datasets.

---

## Useful patterns

### EXISTS vs COUNT
```sql
-- BAD: counts every row
IF (SELECT COUNT(*) FROM orders WHERE user_id = 1) > 0

-- GOOD: stops at the first
IF EXISTS (SELECT 1 FROM orders WHERE user_id = 1)
```

### Conditional aggregation
```sql
-- BAD: 3 queries
SELECT COUNT(*) FROM orders WHERE status = 'pending';
SELECT COUNT(*) FROM orders WHERE status = 'shipped';

-- GOOD: 1 query
SELECT
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped
FROM orders;
```

### Batch inserts
```sql
-- BAD: row-by-row
INSERT INTO products (name, price) VALUES ('A', 10);
INSERT INTO products (name, price) VALUES ('B', 15);

-- GOOD: batch
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

| Rule | Detail |
|-------|---------|
| Always `utf8mb4` | MySQL's `utf8` is incomplete (3 bytes, no emoji) |
| `DECIMAL` for money | Never `FLOAT`/`DOUBLE` -- loss of precision |
| `DATETIME` > `TIMESTAMP` | TIMESTAMP has a 2038 limit and is 4 bytes; DATETIME is 5 bytes with no limit |
| Always InnoDB | MyISAM only for append-only logs |
| Smallest possible type | `TINYINT` for status/booleans, not `BIGINT` |
| ULIDs as PK if API-exposed | `$table->ulid('id')->primary()` in Laravel |
| Auto-increment for internal PKs | When not exposed in the API, better for InnoDB clustering |

---

## Anti-patterns

| Wrong | Problem | Fix |
|--------|----------|-----|
| Function on an indexed column in the WHERE | Full table scan | Range comparison |
| `SELECT *` | Prevents covering indexes | Specify the columns |
| `LIMIT N OFFSET large` | Reads and discards N rows | Cursor pagination |
| LEFT JOIN when INNER is needed | Returns nulls, confuses the optimizer | INNER JOIN |
| `FLOAT`/`DOUBLE` for money | Loss of precision | `DECIMAL(precision, scale)` |
| `utf8` charset | Truncates 4-byte chars | `utf8mb4` |
| String literal vs INT column | Implicit conversion, broken index | Match types |
| No index on the JOIN column | Nested loop with no index | Index it |
| `COUNT(*) > 0` for existence | Counts everything | `EXISTS` |
| Correlated subquery | Runs per row | Window function or JOIN |

---

## Performance targets

| Metric | Target |
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
