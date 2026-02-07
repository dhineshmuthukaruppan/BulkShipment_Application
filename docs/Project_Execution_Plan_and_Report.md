# Shipping Label Platform — Detailed Execution Plan & Report

**Prepared by:** Dhinesh Muthukaruppan  
**Date:** February 2025  
**Project:** Rebuild of app.printnsend.com — Multi-Domain Shipping Label Platform  

---

## Table of Contents

1. [Estimated Timeline & Hours Breakdown](#1-estimated-timeline--hours-breakdown)
2. [Execution Plan](#2-execution-plan)
3. [Complete Feature List](#3-complete-feature-list)
4. [Architectural Perspective](#4-architectural-perspective)
5. [Improvements & Recommendations](#5-improvements--recommendations)
6. [Risk Analysis](#6-risk-analysis)
7. [Testing Strategy](#7-testing-strategy)
8. [AI & Tooling Strategy](#8-ai--tooling-strategy)
9. [Engagement Model](#9-engagement-model)

---

## 1. Estimated Timeline & Hours Breakdown

### Overview: 6–8 Weeks Total (~294 Hours)

| Phase | Duration | Hours | Focus | Deliverable |
|-------|----------|-------|-------|-------------|
| Phase 0: Discovery & Setup | Day 1–3 | 20h | Environment, existing app exploration, scope lock | Working local env, scope document |
| Phase 1: Foundation | Week 1 | 35h | Django project, MongoDB, domain middleware, auth | Skeleton app with login on one domain |
| Phase 2: Core User Flows | Week 2–3 | 65h | Single label, bulk CSV, order lifecycle, billing | Users can create labels and see status |
| Phase 3: Admin APIs | Week 3–4 | 40h | Full admin API suite, feature flags, pricing engine | Admin can manage everything via API |
| Phase 4: Multi-Domain & Branding | Week 4–5 (3 days) | 18h | Domain detection, per-domain config, branding | Same app running on 2+ domains |
| Phase 5: File Storage & Downloads | Week 5 (3 days) | 18h | Minio integration, presigned URLs, ZIP downloads | Users can download labels |
| Phase 6: Logging & Observability | Week 5–6 (3 days) | 18h | Centralized logging, audit trails, admin log API | Full logging pipeline working |
| Phase 7: Testing & Hardening | Week 6–7 | 50h | Unit, integration, E2E tests, security review | 80%+ test coverage, pen-test ready |
| Phase 8: Deployment & Launch | Week 7–8 | 30h | Coolify deployment, staging, production cutover | Live on production |
| **TOTAL** | **6–8 Weeks** | **294h** | | |

---

### Phase 0: Discovery & Setup — 20 Hours (3 Days)

| Task | Hours | Details |
|------|-------|---------|
| Local environment setup (Django 5.x, MongoDB, Minio, Docker) | 3h | Install, configure, verify all services running |
| Explore existing app.printnsend.com (every user flow) | 4h | Signup, login, single label, bulk label, payment, download, edge cases |
| Explore Lovable UI reference & document UX decisions | 2h | Screenshot key patterns, note component structure, identify reusable ideas |
| Document all user flows & requirements extraction | 3h | Analyze walkthrough and extract structured requirements checklist |
| Finalize MVP scope (v1.0 vs v1.1) | 2h | Priority matrix, client alignment |
| Lock tech decisions (frontend, ODM, JWT library) | 1h | Compare options, document rationale |
| Scaffold project skeleton | 2h | Folder structure, settings, linting, pre-commit hooks, docker-compose, .env.example |
| Set up CI/CD pipeline on Coolify | 2h | Docker build, test, deploy pipeline |
| Write processor contract document | 1h | Expected payloads, status values, Minio paths |
| **Phase 0 Total** | **20h** | |

**Deliverables:** Working local environment, scope document, processor contract, CI/CD pipeline

---

### Phase 1: Foundation — 35 Hours (1 Week)

| Task | Hours | Details |
|------|-------|---------|
| **Django + MongoDB Core** | | |
| Initialize Django 5.x project with django-mongodb-backend | 1h | Project structure, settings, base configuration |
| Create all 7 MongoDB models (Users, Orders, Transactions, Domain Settings, Feature Flags, Logs, Sessions) | 3h | Define models with proper field types and validation rules |
| Schema validation rules and compound indexes | 2h | `(domain, status)`, `(domain, user_id, created_at)`, `(domain, email)` unique, etc. |
| Domain detection middleware (Host header → domain config) | 1.5h | Middleware + unit tests |
| Domain config caching layer (5-min TTL) | 1h | Cache wrapper to reduce DB reads per request |
| **Authentication System** | | |
| Custom JWT implementation (3hr access + refresh tokens) | 3h | JWT utils, token service, refresh flow |
| bcrypt password hashing integration | 0.5h | Integrate into user model |
| Registration flow (domain-aware, email validation) | 2h | Serializer, view, URL routing, tests |
| Login/logout with session tracking in MongoDB | 2h | Auth views, session model, token management |
| Password reset flow (token generation, email, reset view) | 2h | Full reset flow with secure token |
| Auth unit tests (JWT creation, verification, refresh, expiry) | 2h | Comprehensive test suite with edge cases |
| **Base Frontend Setup** | | |
| Base layout (navigation, responsive, domain-aware) | 3h | Templates + CSS + responsive design |
| Auth pages (login, register, forgot password) | 3h | Forms + HTMX interactions |
| Domain-aware template context processor | 1h | Injects branding from domain_settings into every page |
| Error handling pages (404, 500, permission denied) | 1h | Styled error templates matching branding system |
| Integration testing (auth + middleware end-to-end) | 3h | API tests verifying full auth flow |
| Code review & refinement | 3h | Review all code for quality and correctness |
| **Phase 1 Total** | **35h** | |

**Deliverables:** Working auth system, domain middleware, base UI, MongoDB schema with indexes

---

### Phase 2: Core User Flows — 65 Hours (2 Weeks)

| Task | Hours | Details |
|------|-------|---------|
| **Single Label Creation** | | |
| Label creation form UI (sender, recipient, package, carrier) | 4h | Form with validation and UX |
| Address validation integration (StreetVerify API) | 3h | API client, error handling, retry logic |
| Pricing engine (user → domain → global waterfall) | 4h | Core business logic with tiered pricing resolution |
| Real-time price calculation endpoint | 2h | API endpoint + frontend integration |
| Form validation (all field constraints) | 1.5h | Address 32 chars, city 24 chars, name 32 chars, weight max 70 lbs |
| Single label creation unit + integration tests | 3h | Test suite covering happy path and edge cases |
| **Order Lifecycle & Status Tracking** | | |
| Order creation service (validate → balance check → debit → create → log) | 5h | MongoDB transaction ensuring atomicity; critical business logic |
| Idempotency key implementation | 1.5h | Key generation + duplicate detection to prevent double orders |
| Status polling mechanism (5-second interval) | 2h | HTMX/React polling for real-time status updates |
| Status display UI (color-coded badges, timeline) | 2h | Pending (yellow), processing (blue), completed (green), failed (red) |
| Order detail page (full info, timeline, download link) | 2h | Complete order view with status history |
| Order lifecycle unit + integration tests | 3h | Test every status transition and edge case |
| **Bulk CSV Label Creation** | | |
| CSV upload handler + parser | 2h | File upload with format validation |
| Column validation + row-by-row validation | 2h | Required columns, format checks, field constraints |
| Fix wizard UI (inline errors, user correction) | 5h | Interactive error correction interface |
| Batch order creation (all-or-nothing transaction) | 3h | Transaction with proper rollback on failure |
| Bulk status tracking page | 2h | Batch progress view with per-order status |
| CSV + bulk flow tests | 2h | Test suite for CSV parsing, validation, batch creation |
| **Billing & Credits** | | |
| User balance display + transaction history page | 3h | UI with pagination and filters |
| Balance check guard on order creation | 1h | Reject if insufficient balance |
| Auto-refund on failed orders (credit + transaction + log) | 3h | Refund service with full audit trail; critical logic |
| Crypto deposit flow preparation (wallet display, balance polling) | 3h | Wallet address display and balance polling mechanism |
| Billing unit + integration tests | 3h | Test balance deduction, refund, insufficient balance scenarios |
| Phase 2 code review & refinement | 3h | Review all code for quality |
| **Phase 2 Total** | **65h** | |

**Deliverables:** Complete single + bulk label flow, order lifecycle, billing system

---

### Phase 3: Admin APIs — 40 Hours (1 Week)

| Task | Hours | Details |
|------|-------|---------|
| **Domain Management APIs** | | |
| Domain CRUD endpoints (list, create, get, update, delete) | 3h | ViewSet + serializer + URL routing + pagination |
| Domain settings endpoints (branding, signup, carriers) | 2h | Nested serializer for domain configuration |
| Domain API tests | 1.5h | Test suite for all domain endpoints |
| **User Management APIs** | | |
| User list/detail endpoints (all domains, paginated, filterable) | 2h | Cross-domain user listing with filters |
| User status management (activate, deactivate, suspend) | 2h | Status transitions with business logic validation |
| User balance management (credit, debit) | 2h | Transaction-safe balance operations |
| User custom pricing endpoint | 1h | Per-user pricing override |
| User orders + transactions sub-endpoints | 1.5h | Nested routes for user's orders and transactions |
| User API tests | 2h | Test suite covering all user management scenarios |
| **Order Management APIs** | | |
| Order list/detail (all domains, filterable) | 2h | Complex filters: status, domain, user, date range |
| Order cancel endpoint (pending only) | 2h | Validate status, refund balance, update order |
| Order refund endpoint (completed only) | 2h | Validate status, credit balance, create transaction |
| Order API tests | 2h | Test cancel/refund edge cases and permission checks |
| **Pricing & Feature APIs** | | |
| Global pricing CRUD | 1.5h | Global rate management |
| Domain-specific pricing CRUD | 1.5h | Per-domain rate override |
| Feature flag management (global + per-domain) | 2h | Toggle features globally or per domain |
| Pricing + feature API tests | 1.5h | Test suite for pricing resolution and flag toggling |
| **Logging, System & Admin Auth** | | |
| Log query API (filter by domain, user, level, category, date) | 2h | Complex query builder with compound filters |
| Log export endpoint (CSV/JSON) | 1h | Bulk export for analysis |
| Health check endpoint (DB, Minio, processor) | 1h | Verify all service connectivity |
| System stats endpoint (users, orders, revenue by domain) | 1.5h | Aggregation queries for dashboard data |
| Admin JWT auth (separate permissions) | 1.5h | Elevated permission classes for admin endpoints |
| Rate limiting configuration | 1h | Per-endpoint rate limits |
| OpenAPI/Swagger documentation | 1.5h | Auto-generated API documentation |
| Phase 3 code review & refinement | 2h | Review all admin endpoints for security and correctness |
| **Phase 3 Total** | **40h** | |

**Deliverables:** Complete admin API suite, OpenAPI docs, admin auth

**Admin API Structure:**

```
/api/admin/v1/
├── /domains/                     # Domain Management
│   ├── GET/POST /                # List/Add domains
│   ├── GET/PUT/DELETE /{domain}  # CRUD domain
│   └── /{domain}/settings/       # branding, signup, services
├── /users/                       # User Management (ALL domains)
│   ├── GET /                     # List all users
│   ├── /{id}/status/             # activate, deactivate, suspend
│   ├── /{id}/balance/            # credit, debit
│   └── /{id}/pricing/            # custom pricing
├── /orders/                      # Order Management
├── /pricing/                     # Global Pricing
├── /features/                    # Feature Flags
├── /logs/                        # Centralized Logs
└── /system/                      # Health, stats, maintenance
```

---

### Phase 4: Multi-Domain & Branding — 18 Hours (3 Days)

| Task | Hours | Details |
|------|-------|---------|
| Per-domain branding system (logo, colors, name, footer) | 3h | CSS variables driven by domain_settings |
| Template context processor (inject domain config everywhere) | 1h | Extend scaffolding from Phase 1 |
| Per-domain signup control (open/closed) | 1h | Middleware check against domain config |
| Per-domain carrier availability (USPS only vs USPS+UPS) | 1.5h | Filter carrier list from domain config |
| Per-domain pricing override (domain rates > global rates) | 1.5h | Configure pricing engine for domain-level override |
| Set up 2 test domains (local /etc/hosts aliases) | 1h | Configure and verify both domains |
| Cross-domain login preparation (allowed_domains field) | 1.5h | Validation logic for future cross-domain auth |
| Multi-domain integration tests | 3h | Same request, different Host headers, different results |
| Multi-domain UI testing & polish | 2.5h | Verify branding, pricing, carriers per domain |
| Code review | 2h | Review domain isolation and data scoping |
| **Phase 4 Total** | **18h** | |

**Deliverables:** Same codebase serving 2+ branded domains with different settings

---

### Phase 5: File Storage & Downloads — 18 Hours (3 Days)

| Task | Hours | Details |
|------|-------|---------|
| Minio client wrapper (boto3/minio-py) | 2h | Connection pooling, error handling, retry logic |
| Presigned URL generation service (1hr expiry) | 1.5h | Secure URL generation; never expose credentials |
| Single label download endpoint (presigned URL redirect) | 1.5h | Download endpoint for completed orders |
| Bulk label download (ZIP streaming) | 3h | Generate ZIP of all labels in a batch; test with large batches |
| Order history page with download links | 2h | UI showing completed orders with download buttons |
| File not found / Minio unavailable handling | 1.5h | Graceful degradation with user-friendly messages |
| File cleanup policy (archive old labels) | 1.5h | TTL-based cleanup for old label files |
| Minio integration tests (mocked S3 responses) | 3h | Test upload, download, presigned URLs, error scenarios |
| Code review & security check (no credential exposure) | 2h | Verify presigned URLs, no leaks |
| **Phase 5 Total** | **18h** | |

**Deliverables:** Working label download, ZIP for bulk, presigned URLs

---

### Phase 6: Logging & Observability — 18 Hours (3 Days)

| Task | Hours | Details |
|------|-------|---------|
| Log model + MongoDB TTL indexes per level | 2h | Model with TTL: debug 7d, info 30d, warning 90d, error 180d, critical 365d |
| Logging service (structured log creation) | 2h | Consistent structured format across all actions |
| Request ID middleware (unique ID per request) | 1h | Generate unique ID, pass through all log calls |
| Sensitive data masking utility | 1.5h | Never log passwords, tokens, card numbers |
| Instrument all existing code with logging calls | 4h | Add log calls to auth, orders, billing, admin actions |
| Admin log query API (complex filters) | 2h | Refine and test log query endpoint from Phase 3 |
| Admin log export (CSV/JSON) | 1h | Verify export endpoint |
| Health check endpoint refinement | 1h | Verify DB, Minio, processor checks |
| Logging integration tests | 2h | Verify logs are created for every action |
| Code review | 1.5h | Verify no sensitive data logged |
| **Phase 6 Total** | **18h** | |

**Deliverables:** Full logging pipeline, retention, admin queryable, health endpoints

**Structured Log Format:**

```json
{
  "timestamp": "2025-02-15T10:30:00Z",
  "level": "info",
  "category": "order",
  "domain": "shipfast.com",
  "user_id": "abc123",
  "order_id": "ord456",
  "action": "order_created",
  "message": "Order created successfully",
  "request_id": "req-789",
  "ip_address": "1.2.3.4",
  "metadata": {}
}
```

---

### Phase 7: Testing & Hardening — 50 Hours (1.5 Weeks)

| Task | Hours | Details |
|------|-------|---------|
| **Unit Tests** | | |
| Model unit tests (all 7 models, validation, calculations) | 4h | All models with field validation and business logic |
| Service unit tests (auth, orders, billing, pricing, logging) | 5h | Every service method with edge cases |
| Middleware unit tests (domain detection, request ID) | 1.5h | Middleware behavior tests |
| Validator unit tests (address, CSV, form fields) | 2h | All validation rules tested |
| **Integration Tests** | | |
| User-facing API tests (all endpoints) | 5h | Every user API endpoint with assertions |
| Admin API tests (all endpoints) | 4h | Every admin endpoint with permission checks |
| MongoDB transaction tests (atomicity, rollback) | 3h | Critical: order + balance + log atomicity |
| Minio integration tests | 2h | Upload, presigned URL, download, errors |
| Multi-domain integration tests | 2h | Different Host headers → different results |
| **E2E Tests** | | |
| User journey: Register → Login → Create label → Download | 2h | Full single label flow |
| User journey: CSV upload → Fix wizard → Batch → ZIP download | 2.5h | Full bulk label flow |
| User journey: Insufficient balance → Top up → Create label | 1.5h | Billing edge case flow |
| User journey: Failed order → Auto-refund → Transaction shows | 1.5h | Failure recovery flow |
| Admin journey: Manage domains → Users → Orders → Logs | 2h | Full admin management flow |
| Multi-domain E2E: Same user, different domains | 1.5h | Domain isolation verification |
| Concurrent order test (two tabs simultaneously) | 2h | Verify balance correctness under concurrency |
| **Security Hardening** | | |
| Input sanitization audit (NoSQL injection prevention) | 2h | Scan and fix injection vulnerabilities |
| Rate limiting configuration (auth + order endpoints) | 1.5h | Configure per-endpoint rate limits |
| CORS per-domain configuration | 1h | Domain-specific CORS rules |
| JWT token rotation and revocation | 1.5h | Implement and verify token lifecycle |
| File upload validation (CSV only, size limits) | 1h | Restrict file types and sizes |
| Security review of all critical endpoints | 2h | Manual review of auth, billing, admin |
| **Phase 7 Total** | **50h** | |

**Deliverables:** Full test suite, security review report, performance baseline

---

### Phase 8: Deployment & Launch — 30 Hours (1 Week)

| Task | Hours | Details |
|------|-------|---------|
| Dockerfile + docker-compose.yml (production) | 2h | Production-ready container configuration |
| Coolify deployment configuration | 3h | Environment variables, secrets, build pipeline |
| Staging environment setup | 3h | Deploy, seed with test data, verify |
| Staging testing (full user flow verification) | 4h | Run all E2E tests against staging |
| Bug fixes from staging testing | 4h | Buffer for issues found in staging |
| Production deployment (zero-downtime) | 2h | Deploy, verify, DNS cutover |
| DNS + domain configuration (first branded domain) | 1.5h | Configure domain, SSL, verify |
| Monitoring setup (health checks, error alerting) | 2h | Coolify health checks, error notifications |
| API documentation (OpenAPI/Swagger) | 2h | Polish auto-generated docs |
| Deployment runbook | 1.5h | Step-by-step deployment guide |
| Architecture decision records (ADRs) | 2h | Document key technical decisions |
| Developer onboarding doc | 1.5h | How to set up, run, test locally |
| Final code review & cleanup | 1.5h | Remove TODOs, dead code, console logs |
| **Phase 8 Total** | **30h** | |

**Deliverables:** Live production deployment, documentation, monitoring

---

### Grand Total Hours Summary

| Phase | Hours | Calendar Time |
|-------|-------|---------------|
| Phase 0: Discovery & Setup | 20h | 3 days |
| Phase 1: Foundation | 35h | 1 week |
| Phase 2: Core User Flows | 65h | 2 weeks |
| Phase 3: Admin APIs | 40h | 1 week |
| Phase 4: Multi-Domain & Branding | 18h | 3 days |
| Phase 5: File Storage & Downloads | 18h | 3 days |
| Phase 6: Logging & Observability | 18h | 3 days |
| Phase 7: Testing & Hardening | 50h | 1.5 weeks |
| Phase 8: Deployment & Launch | 30h | 1 week |
| **TOTAL** | **294 hours** | **6–8 weeks** |

> **Note:** 294 hours at ~40 hours/week = ~7.4 weeks. The 6–8 week range accounts for unforeseen complexities (processor contract clarifications, MongoDB edge cases, client feedback iterations).

### Hours by Category

| Category | Hours | % of Total |
|----------|-------|------------|
| Backend Development (models, APIs, services, middleware) | 105h | 36% |
| Frontend Development (templates, UI, forms, interactions) | 45h | 15% |
| Testing (unit, integration, E2E, security) | 65h | 22% |
| DevOps & Deployment (Docker, Coolify, CI/CD, monitoring) | 22h | 8% |
| Documentation (API docs, runbooks, ADRs, onboarding) | 12h | 4% |
| Planning & Review (scope, architecture, code review) | 25h | 8% |
| Discovery & Exploration (existing app, requirements) | 10h | 3% |
| Buffer (staging bugs, client feedback, unforeseen issues) | 10h | 4% |
| **TOTAL** | **294h** | **100%** |

---

## 2. Execution Plan

### Sprint Structure (1-Week Sprints)

I would run **1-week sprints** for faster feedback:

- **Day 1 (Morning):** Sprint planning — define goals, break into tasks, prioritize
- **Day 1–4:** Development — build features, write tests alongside code
- **Day 5:** Demo, integration testing, retrospective, deploy to staging

### Development Workflow

1. **Plan the feature** — define the data model, API endpoints, and UI requirements clearly
2. **Implement** — build models, serializers, views, URL routing, templates
3. **Review and refine** — review every file for correctness, security, and business logic accuracy
4. **Write tests** — unit + integration tests covering happy paths, edge cases, and error scenarios
5. **Run tests, fix issues** — debug failing tests, analyze errors, fix root causes
6. **Commit and deploy** — feature branch → PR → staging deployment

### Priority Order

The build order is deliberately sequenced so that:

1. **Auth + domain middleware first** — every subsequent feature depends on knowing "who" and "which domain"
2. **Single label flow second** — proves the full stack end-to-end (form → validate → price → order → status → download)
3. **Admin APIs third** — once user flows work, admin needs to manage them
4. **Multi-domain fourth** — once everything works on one domain, extend to many
5. **Logging last (but not least)** — easier to instrument after all features exist

---

## 3. Complete Feature List

### Core Features (MVP — v1.0)

| # | Feature | Priority | Phase |
|---|---------|----------|-------|
| 1 | User registration (domain-aware) | Critical | 1 |
| 2 | User login / logout / JWT auth | Critical | 1 |
| 3 | Password reset flow | High | 1 |
| 4 | Domain detection middleware | Critical | 1 |
| 5 | Single label creation (form + validation) | Critical | 2 |
| 6 | Address validation (StreetVerify) | Critical | 2 |
| 7 | Real-time price calculation | Critical | 2 |
| 8 | Order lifecycle (pending → processing → completed/failed) | Critical | 2 |
| 9 | Status polling (5-second interval) | Critical | 2 |
| 10 | Bulk CSV upload (max 100) | Critical | 2 |
| 11 | CSV validation + fix wizard | Critical | 2 |
| 12 | Credit-based billing system | Critical | 2 |
| 13 | Balance check before order | Critical | 2 |
| 14 | Auto-refund on failed orders | Critical | 2 |
| 15 | Transaction history | High | 2 |
| 16 | Order history with status | High | 2 |
| 17 | Label download (presigned URL) | Critical | 5 |
| 18 | Bulk label download (ZIP) | High | 5 |
| 19 | Per-domain branding (logo, colors, name) | High | 4 |
| 20 | Per-domain pricing | High | 4 |
| 21 | Per-domain carrier availability | High | 4 |
| 22 | Per-domain signup control | High | 4 |
| 23 | Feature flags (per domain) | High | 4 |
| 24 | Admin API: domain management | Critical | 3 |
| 25 | Admin API: user management | Critical | 3 |
| 26 | Admin API: order management | Critical | 3 |
| 27 | Admin API: pricing management | Critical | 3 |
| 28 | Admin API: feature flag management | High | 3 |
| 29 | Admin API: log query & export | High | 6 |
| 30 | Admin API: system health & stats | High | 6 |
| 31 | Centralized structured logging | Critical | 6 |
| 32 | Log retention with TTL | High | 6 |
| 33 | Minio file storage integration | Critical | 5 |

### Enhanced Features (v1.1 — Post-Launch)

| # | Feature | Priority |
|---|---------|----------|
| 34 | Cross-domain login (user logs in on any allowed domain) | Medium |
| 35 | Real-time order updates via WebSocket/SSE (replace polling) | Medium |
| 36 | Saved addresses (address book per user) | Medium |
| 37 | Saved packages (package presets per user) | Medium |
| 38 | Order templates (frequently used label configurations) | Low |
| 39 | Batch order retry (create new orders from failed batch) | Medium |
| 40 | Email notifications (order completed, order failed, low balance) | Medium |
| 41 | Two-factor authentication (TOTP) | Medium |
| 42 | API rate limiting dashboard (for admin) | Low |
| 43 | Advanced analytics (orders by domain, revenue trends, user activity) | Medium |
| 44 | Webhook support (notify external systems on order status change) | Low |
| 45 | Multi-language support (i18n) | Low |
| 46 | Dark mode / theme switching | Low |
| 47 | Mobile-responsive PWA | Medium |
| 48 | Bulk address validation before order | Medium |

### Future Products (Separate Apps, Same Database)

| # | Product | Description |
|---|---------|-------------|
| 49 | Admin Dashboard UI | Separate frontend consuming Admin APIs |
| 50 | Marketing & Landing Pages | Separate web app for each domain's public pages |
| 51 | Visitor Behavior & Analytics | Separate web app tracking user sessions and conversions |

---

## 4. Architectural Perspective

### 4.1 System Architecture

```
                    ┌──────────────────────────┐
                    │   DOMAIN A (shipfast.com) │
                    │   Django App Instance     │──┐
                    └──────────────────────────┘  │
                    ┌──────────────────────────┐  │     ┌─────────────┐
                    │  DOMAIN B (labelking.io)  │──┼────>│   MongoDB    │
                    │   Django App Instance     │  │     │ (7 colls)   │
                    └──────────────────────────┘  │     └──────┬──────┘
                    ┌──────────────────────────┐  │            │
                    │   DOMAIN N (future...)    │──┘     ┌──────┴──────┐
                    │   Django App Instance     │        │  Processor   │
                    └──────────────────────────┘        │ (Black Box)  │
                                                        └──────┬──────┘
                    ┌──────────────────────────┐               │
                    │     Admin Dashboard       │        ┌──────┴──────┐
                    │  (Separate App, Future)   │        │    Minio     │
                    │  Uses /api/admin/v1/      │        │  (Labels)    │
                    └──────────────────────────┘        └─────────────┘
```

### 4.2 Key Architectural Decisions

**Decision 1: Single Codebase, Multiple Deployments**
- One Django project deployed N times (one per domain/host)
- Domain detected at runtime from `Host` header
- All instances connect to the same MongoDB
- Avoids code duplication; a bug fix deploys to all domains simultaneously

**Decision 2: API-First Design**
- All business logic lives in service layer, exposed via REST APIs
- User-facing APIs (`/api/v1/`) and Admin APIs (`/api/admin/v1/`) are separate namespaces
- Enables future frontends (React SPA, mobile app, admin dashboard) to consume the same APIs
- OpenAPI/Swagger documentation for every endpoint

**Decision 3: MongoDB as Single Source of Truth**
- All systems (Django apps, processor, admin) read/write the same MongoDB
- No data duplication; no sync problems
- Transactions for multi-document operations (order + balance + log)
- TTL indexes for automatic log cleanup

**Decision 4: Domain Middleware Pattern**
- Every request passes through `DomainMiddleware`
- Middleware reads `Host` header, looks up `domain_settings` from MongoDB (with caching)
- Injects `request.domain` (domain config object) into every request
- All downstream code (views, serializers, services) uses `request.domain` for scoping

**Decision 5: Pricing Waterfall**
- Price resolution: **User custom pricing** → **Domain pricing** → **Global pricing**
- Most specific wins; if user has a custom rate for "usps_priority", use it
- If not, use domain's rate; if not, use global rate
- All rates stored in DB, never hardcoded

**Decision 6: Processor Contract as Boundary**
- Clear, documented contract: "we write orders with these fields and status=pending; processor sets status to processing/completed/failed and writes label path"
- We never call the processor; we never modify its code
- We log every status transition we observe for debugging

### 4.3 Database Schema (7 Collections)

**users:**
- `_id`, `email`, `password_hash`, `first_name`, `last_name`
- `registered_domain`, `allowed_domains[]`
- `credit_balance` (Decimal), `custom_pricing {}`
- `is_active`, `role` (user/admin), `created_at`, `updated_at`
- Indexes: `(domain, email)` unique, `(domain, is_active)`

**orders:**
- `_id`, `user_id`, `domain`
- `sender_address {}`, `recipient_address {}`
- `carrier` (usps/ups), `service` (priority/ground/etc.)
- `weight`, `dimensions {}`, `declared_value`
- `status` (pending/processing/completed/failed/cancelled)
- `pricing {}` (cost breakdown: base, surcharges, total)
- `label_path` (Minio key, set by processor when completed)
- `tracking_number` (set by processor)
- `batch_id` (for bulk orders, links orders in same CSV upload)
- `idempotency_key` (prevent duplicate orders)
- `created_at`, `updated_at`, `completed_at`
- Indexes: `(domain, status)`, `(domain, user_id, created_at)`, `(batch_id)`

**transactions:**
- `_id`, `user_id`, `domain`
- `type` (credit/debit/refund)
- `amount`, `balance_after`
- `reference` (order_id or deposit_id)
- `description`, `created_at`
- Indexes: `(domain, user_id, created_at)`

**domain_settings:**
- `_id`, `domain` (unique)
- `display_name`, `branding {}` (logo_url, primary_color, secondary_color, footer_text)
- `signup_enabled`, `enabled_carriers[]`
- `pricing {}` (per-carrier, per-service rates)
- `custom_settings {}` (extensible)
- `created_at`, `updated_at`

**feature_flags:**
- `_id`, `flag_name`, `domain` (null = global)
- `enabled`, `metadata {}`
- `created_at`, `updated_at`
- Indexes: `(flag_name, domain)` unique

**logs:**
- `_id`, `timestamp`, `level`, `category`
- `domain`, `user_id`, `order_id`
- `action`, `message`, `metadata {}`
- `request_id`, `ip_address`
- Indexes: `(domain, timestamp)`, `(level, timestamp)`, `(user_id, timestamp)`
- TTL indexes per level for automatic cleanup

**sessions:**
- `_id`, `user_id`, `domain`
- `token_hash`, `refresh_token_hash`
- `ip_address`, `user_agent`
- `created_at`, `expires_at`, `revoked`
- Indexes: `(token_hash)`, `(user_id, domain)`

### 4.4 API Design Principles

1. **Consistent response format:**

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100 },
  "errors": []
}
```

2. **Pagination:** Cursor-based for large lists (orders, logs); offset-based for small lists (domains, features)
3. **Filtering:** Query parameters for status, domain, date range, user
4. **Sorting:** `?sort=created_at&order=desc`
5. **Error codes:** Meaningful error codes (e.g. `INSUFFICIENT_BALANCE`, `INVALID_ADDRESS`, `DOMAIN_NOT_FOUND`)
6. **Versioning:** `/api/v1/` from day one; never break existing clients
7. **Rate limiting:** Per-user and per-IP; stricter on auth and order creation endpoints

---

## 5. Improvements & Recommendations

### 5.1 Architecture Improvements

| # | Improvement | Why | Impact |
|---|------------|-----|--------|
| 1 | **Idempotency keys** on order creation | Prevent duplicate orders from retries, double-clicks, or network issues | Critical for billing accuracy |
| 2 | **Optimistic locking** on balance updates | Prevent race conditions when two tabs create orders simultaneously | Prevents negative balances |
| 3 | **Domain config caching** | Don't hit MongoDB on every request for domain_settings; cache with 5-min TTL | 10x fewer DB reads per request |
| 4 | **Request ID middleware** | Generate unique ID per request; include in all logs and error responses | Makes debugging across components trivial |
| 5 | **Correlation IDs** for processor | Pass a correlation ID in the order document; processor includes it in status updates | Trace one order across all systems |
| 6 | **Health endpoints** | `/api/v1/health` and `/api/admin/v1/health` checking DB, Minio, and processor | Enables Coolify/load balancer health checks |
| 7 | **Graceful degradation** | If Minio is down, orders still process; downloads fail gracefully with retry message | Better user experience during partial outages |

### 5.2 Security Improvements

| # | Improvement | Why |
|---|------------|-----|
| 1 | **Refresh token rotation** | On each refresh, issue new refresh token and revoke old one; limits exposure if token is stolen |
| 2 | **Rate limiting on auth** | Max 5 failed login attempts per 15 minutes per IP; prevents brute force |
| 3 | **CORS per domain** | Only allow requests from the matching branded domain; no wildcard CORS |
| 4 | **Input validation layer** | Validate all inputs server-side (not just client-side); prevent NoSQL injection |
| 5 | **Audit trail for admin actions** | Every admin API call logged with admin user, action, target, before/after values |
| 6 | **Secrets management** | All API keys, DB credentials, Minio keys in environment variables; never in code |

### 5.3 UX Improvements

| # | Improvement | Why |
|---|------------|-----|
| 1 | **Real-time status (WebSocket/SSE)** | Replace 5-second polling with push notifications; instant feedback, less server load |
| 2 | **Progress indicator for bulk upload** | Show parsing progress, validation progress, and order creation progress for CSV uploads |
| 3 | **Address autocomplete** | Suggest addresses as user types; reduces errors and speeds up label creation |
| 4 | **Saved addresses (address book)** | Frequent users shouldn't re-type addresses every time |
| 5 | **Order templates** | Save frequently used label configurations (e.g. "Standard US Priority 1lb") for one-click reuse |
| 6 | **Balance top-up reminder** | When balance drops below a threshold, show a non-intrusive reminder |
| 7 | **Keyboard shortcuts** | Power users: Ctrl+N for new label, Ctrl+U for upload CSV, etc. |

### 5.4 Scalability Improvements

| # | Improvement | Why |
|---|------------|-----|
| 1 | **Connection pooling** | Use MongoDB connection pooling (e.g. MongoEngine or motor) to handle concurrent requests |
| 2 | **Read replicas** | For reporting and admin queries, read from MongoDB secondary to reduce load on primary |
| 3 | **CDN for static assets** | Serve branding assets (logos, CSS) from CDN per domain; faster load times globally |
| 4 | **Background tasks** | For CSV processing and ZIP generation, use Celery or Django-Q to avoid blocking web workers |
| 5 | **Horizontal scaling** | Stateless Django apps (sessions in DB, not memory) means we can scale horizontally behind a load balancer |

---

## 6. Risk Analysis

### High Risk

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Processor contract unclear** | High | High | Get written contract (sample payloads, status values, Minio paths) before coding order lifecycle |
| **Scope creep** ("just one more feature") | High | Medium | Define MVP scope in Week 2; anything beyond is v1.1 |
| **MongoDB transaction limitations** | Medium | High | Test multi-document transactions early (Week 1); have fallback plan if django-mongodb-backend has gaps |

### Medium Risk

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **django-mongodb-backend immaturity** | Medium | Medium | Evaluate in Week 1; if too many gaps, consider Djongo or raw PyMongo with a thin ORM layer |
| **Multi-domain testing complexity** | Medium | Medium | Set up local domain aliases (e.g. /etc/hosts) early; automated tests with different Host headers |
| **Crypto payment edge cases** | Medium | Medium | Document every edge case (partial payment, delayed confirmation, double payment); test with processor team |

### Low Risk

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Minio downtime** | Low | Medium | Graceful degradation: orders process normally; downloads show "temporarily unavailable" |
| **Coolify deployment issues** | Low | Low | Test deployment in Week 1; have Docker Compose fallback |

---

## 7. Testing Strategy

### Testing Pyramid

```
        /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
       /    E2E Tests       \        — 10-15 full user journeys
      /   (Playwright/Selenium)\
     /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /   Integration Tests          \   — Every API endpoint, DB transactions, Minio
   /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
  /       Unit Tests                    \ — Models, services, validators, pricing
 /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

### E2E Test Scenarios

1. **New user journey:** Register → Verify → Login → Create single label → Poll until completed → Download label
2. **Returning user journey:** Login → Upload CSV (10 rows) → Fix 2 validation errors → Submit → Poll → Download ZIP
3. **Insufficient balance:** Login → Create label → Blocked ("insufficient balance") → Top up → Create label → Success
4. **Failed order:** Login → Create label → Processor fails → Status shows "failed" → Balance refunded → Transaction shows refund
5. **Admin journey:** Admin login → View all orders → Cancel pending order → View user → Adjust balance → View logs
6. **Multi-domain:** Same test user, different Host header → See different branding, different pricing
7. **Bulk validation:** Upload CSV with intentionally bad addresses → Fix wizard shows errors → Correct and submit
8. **Concurrent orders:** Two tabs creating orders simultaneously → Both succeed, balance correctly deducted twice

### Coverage Targets

- Unit tests: 85%+ on business logic (models, services, validators)
- Integration tests: 100% of API endpoints
- E2E tests: All 8 scenarios above passing
- Security tests: OWASP top 10 checks

---

## 8. AI & Tooling Strategy

### How I Use AI Tools for Development

I actively leverage AI tools to accelerate development without sacrificing quality:

| Task | Approach |
|------|----------|
| Boilerplate generation | Generate Django models, serializers, views from schema descriptions |
| Test generation | Describe the function; generate unit + edge case tests |
| Code review | Scan for security issues, performance concerns, and best practices |
| Documentation | Generate OpenAPI specs, README sections, and inline docstrings |
| Debugging | Analyze error + context; get root cause analysis and apply fix |
| Refactoring | Restructure code to follow clean architecture patterns |

### Multi-Agent Development Strategy

I structure AI usage in four "agent roles" for every feature:

1. **Planner Agent:** Takes a feature description, breaks it into tasks, estimates complexity, identifies dependencies
2. **Coder Agent:** Takes a task, generates implementation code following project conventions
3. **Tester Agent:** Takes implementation, generates unit + integration tests, checks edge cases
4. **Reviewer Agent:** Reviews generated code for security, performance, and maintainability

Each feature goes through all four stages before merge.

### AI Accounts (Provided by Client)

| Tool | Best For | Usage |
|------|----------|-------|
| **Claude Code MAX** | Complex architectural discussions, analyzing large documents, reviewing entire modules | Design decisions, processor contract analysis, large PR reviews |
| **ChatGPT Plus** | Quick lookups, comparing library options, generating diagrams, documentation prose | External information, library comparison, optimization tips |

### MCP Tools Integration

- Automate test runs on every commit
- Automate deployment from terminal — push to staging, verify health check, promote to production
- Query MongoDB directly to verify data during development

---

## 9. Engagement Model

### Proposed Structure

- **Weekly commitment:** 35–40 hours during core development (Phases 1–6); 25–30 hours during testing and post-launch
- **Sprint cadence:** 1-week sprints with demo at end of each sprint
- **Communication:** Daily async updates (Slack/email); weekly sync call (30 min) with working demo
- **Delivery pace:** Expect a working demo every week — not just code, but deployable features

### Weekly Delivery Expectations (What the Client Sees)

| Week | Working Demo |
|------|-------------|
| Week 1 | Project skeleton deployed on Coolify; login/register working on one domain |
| Week 2 | Single label creation with price calculation; order appears in MongoDB |
| Week 3 | Order status polling working; bulk CSV upload with validation |
| Week 4 | Full admin API suite with Swagger docs; billing/credits system |
| Week 5 | Multi-domain with 2 domains running different branding; Minio downloads working |
| Week 6 | Centralized logging; all features integrated end-to-end |
| Week 7 | Full test suite passing (80%+ coverage); security hardening complete |
| Week 8 | Production deployment; documentation; handoff |

### What I Bring

- Production experience building multi-tenant Django applications
- Deep familiarity with React + TypeScript frontends (demonstrated in the BulkShipment Application)
- Experience with MongoDB, REST API design, JWT authentication, and file storage systems
- Strong testing discipline (unit, integration, E2E)
- Efficient use of AI tools for accelerating development while maintaining code quality
- Proven ability to debug and fix production deployment issues rapidly

### Long-Term Vision

This project is the foundation for a broader ecosystem. The architectural decisions we make now (domain middleware, admin APIs, centralized logging, API-first design) directly enable the follow-up products:

- **Admin Dashboard UI:** Consumes the Admin APIs we build in Phase 3 — could be built in 2–3 weeks
- **Marketing/Landing Pages:** Uses domain_settings for branding; shares user auth — 1–2 weeks
- **Analytics Platform:** Reads from the same logs and order collections — 3–4 weeks

Each subsequent product in the ecosystem will be significantly faster to deliver than the first, because the foundation (auth, domain middleware, admin APIs, logging) is already built.

I'm committed to building this foundation properly so that each subsequent product is faster to ship and easier to maintain.

---

## Summary

This is a substantial but well-scoped project. The client has done excellent preparation work (walkthrough, collaboration brief, reference UI, infrastructure). The key to success is:

1. **Lock scope early** (Day 2–3) — MVP vs nice-to-have
2. **Prove the stack early** (Week 1) — Django + MongoDB + domain middleware + auth working
3. **Build end-to-end first** (Week 3) — one label, one domain, full lifecycle
4. **Then widen** — more features, more domains, admin APIs, testing
5. **Demo every week** — weekly working demos, not just code updates

### Final Numbers

| Metric | Value |
|--------|-------|
| **Total Hours** | **294 hours** |
| **Total Duration** | **6–8 weeks** |
| **First Working Demo** | **Week 1** |
| **Full User Flow Working** | **Week 3** |
| **All Features Complete** | **Week 6** |
| **Production Ready** | **Week 8** |
| **Test Coverage** | **80–85%** |

**Estimated delivery: 6–8 weeks (294 hours)** for full v1.0 with testing, documentation, and production deployment.

I'm genuinely excited about this project and ready to start.

---

*This document is a living plan. It will be refined after the discovery phase (Days 1–3) based on what we learn from the existing app and alignment conversations with the client.*
