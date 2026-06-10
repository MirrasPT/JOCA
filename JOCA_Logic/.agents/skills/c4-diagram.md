---
name: c4-diagram
description: "Creating C4 architecture diagrams (Context, Container, Component, Code) in Mermaid format. MUST be invoked when the user says: C4, diagrama de arquitectura, architecture diagram, container diagram, system context, como o sistema se estrutura, diagrama do sistema, system diagram. SHOULD also invoke when: arquitectura visual, visual architecture, mermaid architecture, componentes do sistema, system components, diagrama mermaid."
triggers: C4, diagrama de arquitectura, architecture diagram, container diagram, system context, como o sistema se estrutura, diagrama do sistema, system diagram, arquitectura visual, visual architecture, mermaid architecture, componentes do sistema, system components, diagrama mermaid
---
# C4 Diagram

Mermaid architecture diagrams using Simon Brown's C4 model. Output to `docs/architecture/`.

**Activate** after `tech-spec` (sec. 4 Component Breakdown), or on system overview requests.

---

## C4 Levels

| Nivel | Diagrama | Mermaid | Audiencia |
|-------|----------|---------|-----------|
| 1 | **Context** | `C4Context` | Todos — sistema + actores + sistemas externos |
| 2 | **Container** | `C4Container` | Equipa tecnica — apps, servicos, DBs |
| 3 | **Component** | `C4Component` | Devs — estrutura interna de um container |
| 4 | **Code** | `classDiagram` | Devs — classes/funcoes (raro, on demand) |

**Golden rule:** Context + Container suffice for most teams. Generate level 3/4 only if requested or the container is complex.

---

## Mode Detection

Identify mode before producing any diagram:

| Sinal | Modo |
|-------|------|
| Ideia vaga, sem codigo, "quero desenhar..." | **Design** (greenfield) |
| Path para repo, codigo existente | **Document-code** (retro-documentar) |
| README, spec, PRD partilhado | **Document-prose** (retro de docs) |
| Diagrama existente + "esta bem?" | **Review** |
| Diagrama existente + "adiciona X" | **Update** |

If unclear, ask: "Queres (a) desenhar arquitectura nova, (b) documentar sistema existente, ou (c) rever/actualizar diagrama?"

---

## Output

### Directory

```
docs/
└── architecture/
    ├── 01-context.md
    ├── 02-container.md
    └── 03-component-[nome].md    ← so se pedido
```

### Template per Level

```markdown
# [Nivel] — [Nome do Sistema]

## Overview
[1-2 frases: o que este diagrama mostra]

## Diagrama

\```mermaid
C4Container
    title Container diagram for [Sistema]
    ...
\```

## Elementos

| Nome | Tipo | Tecnologia | Responsabilidade |
|------|------|-----------|-----------------|
| [nome] | Container/DB/Queue | [tech] | [o que faz] |

## Relacoes chave

| De | Para | Intent | Protocolo |
|----|------|--------|-----------|
| [origem] | [destino] | [o que faz] | [HTTP/gRPC/AMQP/...] |

## Decisoes arquitecturais
- [decisao relevante para este nivel]

## Assumptions
- [inferencias nao confirmadas — NUNCA incorporar silenciosamente]
```

---

## Notation Rules (non-negotiable)

### Diagram
- Explicit title always
- Legend in the Markdown doc
- Acronyms explained

### Elements
- Explicit type (Person, System, Container, Component, DB, Queue)
- Short responsibility description
- **Technology mandatory** on Container and Component (e.g. "Java, Spring Boot", "PostgreSQL 15")

### Relations
- **Unidirectional** arrows (avoid BiRel -- split into two Rel)
- Labels with **concrete intent** -- FORBIDDEN: "Uses", "Calls", "Reads". CORRECT: "Reads account balances from", "Publishes OrderCreated events to"
- Inter-container relations must state **protocol** (HTTPS/JSON, gRPC, AMQP, JDBC, SMTP)

---

## Mermaid C4 Cheatsheet

### Elements

```
Person(alias, "Label", "Description")
Person_Ext(alias, "Label", "Description")
System(alias, "Label", "Description")
System_Ext(alias, "Label", "Description")
SystemDb(alias, "Label", "Description")

Container(alias, "Label", "Technology", "Description")
ContainerDb(alias, "Label", "Technology", "Description")
ContainerQueue(alias, "Label", "Technology", "Description")

Component(alias, "Label", "Technology", "Description")
```

### Boundaries

```
Enterprise_Boundary(alias, "Enterprise") { ... }
System_Boundary(alias, "System") { ... }
Container_Boundary(alias, "Container") { ... }
```

### Relations

```
Rel(from, to, "Intent label", "Protocol")
Rel_D(from, to, "Label")    # down
Rel_R(from, to, "Label")    # right
```

### Example -- Laravel Container Diagram

```mermaid
C4Container
    title Container diagram for SaaS Platform

    Person(user, "Tenant User", "Utilizador autenticado de um tenant")
    Person(admin, "Platform Admin", "Administrador da plataforma")

    System_Boundary(platform, "SaaS Platform") {
        Container(spa, "Frontend SPA", "React, Vite", "Interface do utilizador")
        Container(api, "API", "Laravel 11+, PHP 8.3", "Business logic, REST endpoints")
        Container(worker, "Queue Worker", "Laravel Horizon", "Processa jobs assincronos")
        ContainerDb(db, "Database", "MySQL 8", "Dados multi-tenant")
        ContainerDb(cache, "Cache", "Redis 7", "Cache, sessions, queues")
        Container(ws, "WebSocket", "Laravel Reverb", "Real-time events")
    }

    System_Ext(stripe, "Stripe", "Payment processing")
    System_Ext(postmark, "Postmark", "Transactional email")
    System_Ext(s3, "AWS S3", "File storage")

    Rel(user, spa, "Manages tenant data via", "HTTPS")
    Rel(admin, api, "Administers platform via", "HTTPS")
    Rel(spa, api, "Makes API calls to", "JSON/HTTPS")
    Rel(spa, ws, "Receives real-time updates from", "WSS")
    Rel(api, db, "Reads and writes tenant data to", "MySQL Protocol")
    Rel(api, cache, "Caches queries and manages sessions in", "Redis Protocol")
    Rel(api, worker, "Dispatches async jobs to", "Redis Queue")
    Rel(worker, db, "Processes background data in", "MySQL Protocol")
    Rel(worker, stripe, "Processes payments via", "HTTPS")
    Rel(worker, postmark, "Sends transactional emails via", "HTTPS")
    Rel(api, s3, "Stores uploaded files in", "HTTPS/S3 API")
```

---

## Process

### Design (greenfield)

1. Gather context: read PRD + TECH_SPEC if they exist
2. Questions (max 5 per batch):
   - Who are the actors? (users, admins, external systems)
   - Which external systems does it integrate?
   - Monolith or separate services?
3. Produce Context diagram (level 1)
4. Present, iterate
5. Produce Container diagram (level 2)
6. Present, iterate
7. Write files only after explicit approval

### Document-code (retro)

1. Explore codebase: `composer.json`/`package.json`, routes, config, `.env.example`
2. Identify containers (apps, DBs, caches, queues, external services)
3. Generate diagrams from real code
4. Mark assumptions (unconfirmed inferences)
5. Present for validation

### Review

1. Read existing diagram
2. Check against checklist (notation, labels, technologies)
3. Report issues: missing technologies, vague labels, mixed levels
4. Suggest fixes

### Update

1. Read existing diagram
2. Apply requested change
3. Verify cross-level consistency
4. Present diff

---

## Common Mistakes

| Erro | Problema | Fix |
|------|----------|-----|
| Misturar niveis | Container ao lado de Component no mesmo diagrama | Um nivel por diagrama |
| Esquecer sistemas externos | Sistema parece isolado | Context level mostra TUDO que interage |
| Labels vagas ("Uses", "Calls") | Nao comunica nada | Intent concreto + protocolo |
| Sem tecnologia em containers | Nao se sabe o que e | Sempre: "Laravel 11+, PHP 8.3" |
| Diagrama sem documento | Diagrama e ambiguo sozinho | Sempre acompanhar com Markdown |
| Entregar sem validar | Assumptions nao confirmadas | Nunca escrever ficheiros sem "ok" do utilizador |

---

## Workflow

Pipeline position in the JOCA sequence:

-> **before**: `tech-spec` (sec. 4 Component Breakdown as input)
-> **lateral**: `adr` (architectural decisions logged during diagramming)
-> **after**: `task-breakdown` (break components into atomic work)

Notify on completion: `-> proximo: task-breakdown`
