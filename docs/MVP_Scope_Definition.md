# Shipping Label Platform — MVP Scope Definition

**Prepared by:** Dhinesh Muthukaruppan  
**Date:** February 2025  
**Purpose:** Define exactly what is in v1.0 (MVP) vs what is deferred to v1.1+ to prevent scope creep and ensure focused delivery.

---

## Table of Contents

1. [MVP Philosophy](#1-mvp-philosophy)
2. [What's IN v1.0 (Must Have)](#2-whats-in-v10-must-have)
3. [What's IN v1.0 (Should Have)](#3-whats-in-v10-should-have)
4. [What's DEFERRED to v1.1 (Nice to Have)](#4-whats-deferred-to-v11-nice-to-have)
5. [What's OUT OF SCOPE (Separate Projects)](#5-whats-out-of-scope-separate-projects)
6. [Scope Boundary Decisions](#6-scope-boundary-decisions)
7. [MVP Acceptance Criteria](#7-mvp-acceptance-criteria)
8. [Risk of Scope Creep](#8-risk-of-scope-creep)

---

## 1. MVP Philosophy

The MVP must deliver a **fully functional shipping label platform** that:

- Replaces app.printnsend.com for the core user journey
- Supports multi-domain from day one (architecture-level, tested with 2 domains)
- Provides complete admin control via APIs (even if admin UI is built later)
- Has production-grade testing, logging, and monitoring
- Can onboard real users on launch day

**What MVP is NOT:**

- Not a prototype or demo — it's production-ready
- Not feature-complete — v1.1 features are deliberately deferred
- Not the admin dashboard — we build the APIs, not the UI

**Decision Rule:** If a feature is needed for the first paying user to create a label and download it, it's in v1.0. Everything else is v1.1.

---

## 2. What's IN v1.0 (Must Have)

These features are **non-negotiable** for launch. Without any one of these, the platform cannot serve users.

### 2.1 Authentication & User Management

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 1 | User registration (domain-aware) | User can register on a specific domain; email unique per domain; user document created with registered_domain |
| 2 | User login with JWT (3hr access + refresh) | User can login; receives JWT; token expires after 3 hours; refresh flow works |
| 3 | User logout with session revocation | User can logout; session marked as revoked; JWT no longer valid |
| 4 | Password reset via email | User can request reset; receives email with link; can set new password; all sessions invalidated |
| 5 | Domain detection middleware | Every request has domain context injected; correct domain_settings loaded; responses reflect domain branding |

### 2.2 Single Label Creation

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 6 | Label creation form (sender + recipient + package) | User can fill in all address fields and package details; form validates constraints (32 char address, 24 char city, 70 lb weight max) |
| 7 | Address validation (StreetVerify API) | Addresses validated before order creation; invalid addresses rejected; corrected addresses shown to user for confirmation |
| 8 | Carrier and service selection | User can select from domain's enabled carriers; service options update based on carrier |
| 9 | Real-time price calculation | Price displayed before confirmation; price reflects waterfall: user custom → domain → global |
| 10 | Balance check before order | Order rejected if insufficient balance; clear error message with current balance shown |
| 11 | Order creation within MongoDB transaction | Order + balance debit + transaction record + log entry all created atomically; rollback on any failure |
| 12 | Idempotency key on order creation | Double-click or retry does not create duplicate orders |

### 2.3 Bulk CSV Label Creation

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 13 | CSV file upload (max 100 rows) | User can upload .csv file; file parsed correctly; row count enforced |
| 14 | CSV structure validation | Required columns checked; missing/wrong columns reported clearly |
| 15 | Row-by-row validation | Each row validated against address and package rules; results shown per-row (valid/warning/error) |
| 16 | Fix wizard (inline error correction) | User can correct errors inline; re-validation available; batch creation enabled only when all errors fixed |
| 17 | Batch order creation (all-or-nothing) | All orders created within one transaction; if any fails, entire batch rolls back; user balance restored |
| 18 | Batch status tracking | Batch page shows progress of all orders; auto-polls every 5 seconds |

### 2.4 Order Lifecycle

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 19 | Order status tracking (pending → processing → completed/failed) | Status updates reflected in UI within 5-second poll interval |
| 20 | Status polling (5-second interval) | UI automatically polls backend; stops when order reaches terminal state |
| 21 | Order detail page | Shows full order info, status timeline, tracking number (when completed), download link (when completed), error message (when failed) |
| 22 | Auto-refund on failed orders | When status becomes "failed", user balance is credited back automatically; transaction record created; user notified |
| 23 | Order history page | User can see all their orders, filtered by status/date; paginated |

### 2.5 Billing & Credits

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 24 | User balance display | Current balance shown on dashboard and before order creation |
| 25 | Balance deduction on order creation | Balance atomically deducted within order transaction |
| 26 | Transaction history | User can view all credits, debits, and refunds with timestamps and references |
| 27 | Auto-refund on failed orders | Balance restored when order fails; transaction record created |
| 28 | Crypto deposit display | User's wallet address displayed for deposits (actual deposit detection handled by processor) |

### 2.6 File Storage & Downloads

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 29 | Single label download (presigned URL) | Completed order has "Download" button; generates Minio presigned URL (1hr expiry); browser downloads PDF |
| 30 | Bulk label download (ZIP) | Batch page has "Download All" button; generates ZIP of all completed labels; streams to user |
| 31 | Minio integration | Files read via presigned URLs; credentials never exposed to client |

### 2.7 Multi-Domain

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 32 | Domain middleware (Host header detection) | Each domain loads its own settings; tested with at least 2 domains |
| 33 | Per-domain branding (logo, colors, name) | Each domain shows its own visual identity; CSS driven by domain_settings |
| 34 | Per-domain pricing | Each domain can have its own pricing that overrides global |
| 35 | Per-domain carrier availability | Each domain can enable/disable carriers independently |
| 36 | Per-domain signup control | Registration can be enabled/disabled per domain |
| 37 | Domain config caching (5-min TTL) | Domain settings cached to reduce DB reads; cache invalidated within 5 min of admin changes |

### 2.8 Admin APIs

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 38 | Domain management API (CRUD + settings) | Admin can create, read, update, delete domains and their settings via API |
| 39 | User management API (list, status, balance, pricing) | Admin can view users across all domains, suspend/activate, adjust balance, set custom pricing |
| 40 | Order management API (list, cancel, refund) | Admin can view all orders, cancel pending orders, refund completed orders |
| 41 | Pricing management API (global + per-domain) | Admin can set and update pricing at global and domain level |
| 42 | Feature flag management API | Admin can toggle features globally or per domain |
| 43 | Admin authentication (separate JWT) | Admin endpoints require elevated permissions; separate from user auth |
| 44 | OpenAPI/Swagger documentation | All admin endpoints documented with request/response examples |

### 2.9 Logging & Observability

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 45 | Centralized structured logging | Every action logged with domain, user, request_id, timestamp, level, category |
| 46 | Log retention with TTL indexes | debug: 7d, info: 30d, warning: 90d, error: 180d, critical: 365d |
| 47 | Admin log query API | Admin can query logs filtered by domain, level, category, user, date range |
| 48 | Admin log export (CSV/JSON) | Admin can export filtered logs as CSV or JSON |
| 49 | Request ID middleware | Every request gets a unique ID; included in all logs for that request |
| 50 | Sensitive data masking | Passwords, tokens, and card numbers never appear in logs |
| 51 | Health check endpoint | /api/v1/health verifies MongoDB, Minio connectivity |

### 2.10 Infrastructure & Deployment

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 52 | Docker containerization | App runs in Docker; docker-compose for local dev |
| 53 | Coolify deployment | App deployed on Coolify with environment variables and secrets |
| 54 | Staging environment | Staging mirrors production; used for pre-launch testing |
| 55 | Production deployment | Zero-downtime deployment to production |
| 56 | CI/CD pipeline | Push to main → build → test → deploy to staging |

### 2.11 Testing

| # | Feature | Acceptance Criteria |
|---|---------|-------------------|
| 57 | Unit tests (80%+ coverage on business logic) | Models, services, validators, middleware tested |
| 58 | Integration tests (all API endpoints) | Every endpoint tested for success, validation errors, auth failures, permission checks |
| 59 | E2E tests (8 core user journeys) | Full user flows automated with Playwright/Selenium |
| 60 | Security hardening | Rate limiting, CORS, input sanitization, NoSQL injection prevention, JWT rotation |

**Total Must-Have Features: 60**

---

## 3. What's IN v1.0 (Should Have)

These features add significant value and should be included if time allows, but MVP can technically launch without them.

| # | Feature | Why Should Have | Fallback if Deferred |
|---|---------|----------------|---------------------|
| 61 | Feature flags system | Enables gradual rollout and per-domain feature toggling | Hardcode feature availability per domain in settings |
| 62 | System stats API (users, orders, revenue by domain) | Admin needs visibility into system performance | Admin queries MongoDB directly |
| 63 | Maintenance mode toggle | Allows admin to take the platform offline gracefully | Manual deployment pause |
| 64 | Address correction confirmation UI | Show StreetVerify corrections before creating order | Accept all corrections automatically |
| 65 | Low balance warning | Alert user when balance drops below threshold | User sees balance on dashboard |
| 66 | Batch partial download | Download only completed labels from a batch with failed orders | Wait for all or download individually |
| 67 | Order search (by tracking number, recipient) | Users with many orders can find specific ones quickly | Scroll/filter through order history |

---

## 4. What's DEFERRED to v1.1 (Nice to Have)

These are valuable features that are **deliberately deferred** to keep MVP focused. They will be built after launch.

### 4.1 User Experience Enhancements

| # | Feature | Why Deferred | Estimated Effort |
|---|---------|-------------|-----------------|
| 68 | Cross-domain login | Requires complex auth flow changes; not needed for initial domains | 15-20h |
| 69 | Real-time status updates (WebSocket/SSE) | 5-second polling works for MVP; WebSocket is optimization | 15-20h |
| 70 | Saved addresses (address book) | Convenience feature; users can type addresses manually for now | 10-15h |
| 71 | Saved packages (package presets) | Convenience feature; users can type package details for now | 8-12h |
| 72 | Order templates (reusable label configs) | Power user feature; not needed for initial launch | 10-15h |
| 73 | Address autocomplete (as-you-type suggestions) | Nice UX but not critical; StreetVerify validates after entry | 8-12h |
| 74 | Keyboard shortcuts | Power user feature; mouse/touch works fine for MVP | 5-8h |
| 75 | Dark mode / theme switching | Visual preference only; default theme is sufficient | 8-12h |

### 4.2 Operational Enhancements

| # | Feature | Why Deferred | Estimated Effort |
|---|---------|-------------|-----------------|
| 76 | Email notifications (order completed, failed, low balance) | Users check status via polling for now; email is enhancement | 15-20h |
| 77 | Two-factor authentication (TOTP) | Security enhancement; password + JWT is sufficient for MVP | 12-15h |
| 78 | Batch retry (create new orders from failed batch) | Users can re-upload CSV or create individual labels for now | 10-15h |
| 79 | API rate limiting dashboard (for admin) | Rate limiting exists but no dashboard to monitor it | 8-10h |
| 80 | Advanced analytics (trends, revenue charts) | Basic stats API exists; rich analytics is enhancement | 20-30h |
| 81 | Webhook support (notify external systems) | No external integrations needed for MVP | 15-20h |
| 82 | Multi-language support (i18n) | English only for MVP; international expansion is v1.1+ | 20-30h |
| 83 | Mobile-responsive PWA | Responsive design yes; full PWA (offline, push notifications) is v1.1 | 15-20h |
| 84 | Bulk address pre-validation (validate before showing prices) | CSV validation catches most issues; pre-validation is optimization | 8-12h |

### v1.1 Estimated Total: 160–230 additional hours

---

## 5. What's OUT OF SCOPE (Separate Projects)

These are **never** part of this project. They are separate applications or responsibilities.

| Item | Why Out of Scope | Owner |
|------|-----------------|-------|
| Admin Dashboard UI | Separate web app; we build the APIs it consumes | Future project |
| 3rd Party Processor | Already exists; black box; we don't modify it | External team |
| Carrier APIs (USPS, UPS) | Handled by processor; we never call carriers directly | Processor |
| Crypto payment detection | Handled by processor; we just read the updated balance | Processor |
| Marketing & Landing Pages | Separate web app; different design, different audience | Future project |
| Visitor Behavior & Analytics Platform | Separate web app; reads from shared DB | Future project |
| Mobile native app (iOS/Android) | Not planned; web app is responsive | N/A |
| Payment gateway (Stripe, PayPal) | Crypto-only for now; processor handles payments | Processor |

---

## 6. Scope Boundary Decisions

These are specific decisions where the scope boundary was ambiguous and a clear choice was made.

### Decision 1: Frontend Technology

**Decision:** Django Templates + HTMX + Alpine.js (as specified in walkthrough)  
**Alternative considered:** React SPA  
**Rationale:** Client specified Django Templates + HTMX + Alpine.js in the tech stack. If client prefers React, this can be discussed during discovery (Phase 0).  
**Impact if changed:** Adds 1-2 weeks to Phase 1 (frontend setup) but no impact on backend.

### Decision 2: Email Notifications

**Decision:** DEFERRED to v1.1  
**Rationale:** Users can check order status via polling. Email setup requires SMTP configuration, email templates, and queue management — all of which add complexity without enabling the core user journey.  
**Impact if included:** Adds 15-20h to MVP; requires email service setup (SendGrid, SES, etc.)

### Decision 3: Cross-Domain Login

**Decision:** DEFERRED to v1.1, but **architecture prepared** in v1.0  
**Rationale:** The user document already has `allowed_domains[]` field. The login flow in v1.0 only checks the current domain. Enabling cross-domain login is a small change in v1.1.  
**Impact if included:** Adds 15-20h; requires careful testing of domain-scoped data isolation.

### Decision 4: Real-Time Updates (WebSocket/SSE)

**Decision:** DEFERRED to v1.1; use 5-second polling in v1.0  
**Rationale:** Polling works reliably and is simpler to implement and debug. WebSocket adds infrastructure complexity (connection management, reconnection, auth). Polling at 5-second intervals is acceptable UX for label creation (typically completes in 10-60 seconds).  
**Impact if included:** Adds 15-20h; requires WebSocket infrastructure (Django Channels, Redis).

### Decision 5: Address Autocomplete

**Decision:** DEFERRED to v1.1; StreetVerify validation only in v1.0  
**Rationale:** StreetVerify catches invalid addresses at submission time. Autocomplete is a UX enhancement that doesn't prevent errors — it just makes entry faster.  
**Impact if included:** Adds 8-12h; requires address autocomplete API (Google Places, SmartyStreets, etc.)

### Decision 6: Saved Addresses / Address Book

**Decision:** DEFERRED to v1.1  
**Rationale:** Users can type addresses manually. Saved addresses are a convenience for power users with repeat shipments. Not needed for first user experience.  
**Impact if included:** Adds 10-15h; new MongoDB collection, CRUD API, UI integration.

### Decision 7: File Retention / Cleanup Policy

**Decision:** INCLUDED in v1.0 as configuration; actual cleanup is optional  
**Rationale:** Define the policy (e.g. archive after 90 days) but don't implement the cleanup job unless there's a storage cost concern. Labels stay in Minio indefinitely unless explicitly cleaned up.  
**Impact:** Minimal; just a documented policy and optional cron job.

### Decision 8: Admin API Rate Limiting

**Decision:** INCLUDED in v1.0 (basic rate limiting); dashboard DEFERRED to v1.1  
**Rationale:** Rate limiting is a security requirement. A dashboard to monitor it is nice-to-have.  
**Impact:** Rate limiting config adds 1-2h; dashboard adds 8-10h.

---

## 7. MVP Acceptance Criteria

The MVP is considered **complete and ready for launch** when ALL of the following are true:

### 7.1 Functional Criteria

- [ ] A new user can register on Domain A (e.g. shipfast.com)
- [ ] The same user cannot register on Domain A with the same email
- [ ] A different user can register on Domain B (e.g. labelking.io) with the same email
- [ ] User can login and receives a valid JWT (3hr expiry)
- [ ] User can reset their password via email
- [ ] User can see their balance on the dashboard
- [ ] User can create a single shipping label (USPS or UPS, based on domain)
- [ ] Address is validated via StreetVerify before order creation
- [ ] Price is calculated correctly (user custom → domain → global waterfall)
- [ ] Balance is deducted atomically with order creation
- [ ] Order shows as "pending" immediately after creation
- [ ] Order status updates to "processing" and then "completed" or "failed" (via processor)
- [ ] Completed order shows tracking number and download button
- [ ] Failed order auto-refunds user balance
- [ ] User can download a completed label as PDF
- [ ] User can upload a CSV with up to 100 rows
- [ ] CSV validation shows errors per row
- [ ] Fix wizard allows inline correction
- [ ] Batch order creation is all-or-nothing (atomic)
- [ ] Batch page shows progress with per-order status
- [ ] User can download all completed labels as ZIP
- [ ] Transaction history shows all credits, debits, and refunds
- [ ] Order history shows all orders with status filters

### 7.2 Multi-Domain Criteria

- [ ] Domain A shows Domain A branding (logo, colors, name)
- [ ] Domain B shows Domain B branding (different from A)
- [ ] Domain A has different pricing than Domain B
- [ ] Domain A has USPS+UPS; Domain B has USPS only
- [ ] Domain A has signup enabled; Domain B has signup disabled
- [ ] Users on Domain A cannot see Domain B users' orders

### 7.3 Admin API Criteria

- [ ] Admin can create a new domain with settings via API
- [ ] Admin can view all users across all domains
- [ ] Admin can suspend a user via API
- [ ] Admin can adjust a user's balance via API
- [ ] Admin can set custom pricing for a user
- [ ] Admin can view all orders across all domains
- [ ] Admin can cancel a pending order (with refund)
- [ ] Admin can refund a completed order
- [ ] Admin can update global and domain pricing
- [ ] Admin can toggle feature flags
- [ ] Admin can query logs by domain, level, category, date range
- [ ] Admin can export logs as CSV
- [ ] All admin actions are logged in the audit trail
- [ ] Swagger/OpenAPI documentation is available for all admin endpoints

### 7.4 Quality Criteria

- [ ] Unit test coverage is 80%+ on business logic
- [ ] All API endpoints have integration tests
- [ ] 8 E2E test scenarios pass
- [ ] Rate limiting is configured on auth and order endpoints
- [ ] CORS is configured per domain
- [ ] No sensitive data appears in logs
- [ ] Health check endpoint returns healthy
- [ ] Application runs in Docker container
- [ ] Deployed to Coolify (staging + production)
- [ ] Zero critical security vulnerabilities

### 7.5 Documentation Criteria

- [ ] OpenAPI/Swagger docs for all APIs
- [ ] Deployment runbook (how to deploy, rollback, monitor)
- [ ] Developer onboarding guide (how to set up locally, run tests)
- [ ] Architecture decision records for key technical choices

---

## 8. Risk of Scope Creep

### 8.1 Common Scope Creep Triggers

| Trigger | Example | Prevention |
|---------|---------|------------|
| "Just one more feature" | "Can we add email notifications before launch?" | Check against this document: is it in v1.0? If not, it's v1.1. |
| "The UI should be perfect" | "Let's redesign the order history page" | Good enough for launch; UX polish is continuous post-launch |
| "What about edge case X?" | "What if two admins edit the same user simultaneously?" | Document it; handle with optimistic locking if simple, defer if complex |
| "Competitor has feature Y" | "Competitor has address autocomplete" | Check this doc: it's in v1.1. We can add it in 8-12h post-launch. |
| "Can we also build the admin dashboard?" | "It would be nice to have the UI too" | It's out of scope. We build the APIs. Admin UI is a separate project. |

### 8.2 How to Handle Scope Requests

```
New feature request arrives:
  1. Check: Is it in v1.0 Must Have? → YES → Already planned
  2. Check: Is it in v1.0 Should Have? → YES → Include if time allows
  3. Check: Is it in v1.1? → YES → Acknowledge, confirm it's planned for post-launch
  4. Not in any list? → Evaluate:
     a. Is it critical for the first user to create a label? → Add to v1.0
     b. Is it a nice-to-have? → Add to v1.1 list with estimate
     c. Is it out of scope entirely? → Document and reject
```

### 8.3 Scope Change Process

If a scope change is needed:

1. Document the change request (what, why, who requested)
2. Estimate the impact (hours, timeline, dependencies)
3. Identify what gets pushed out (if anything) to accommodate
4. Get client approval before starting
5. Update this document

---

## Appendix: Feature Count Summary

| Category | v1.0 Must Have | v1.0 Should Have | v1.1 Deferred | Out of Scope |
|----------|---------------|-----------------|---------------|-------------|
| Auth & Users | 5 | 0 | 2 | 0 |
| Single Label | 7 | 1 | 2 | 0 |
| Bulk CSV | 6 | 1 | 1 | 0 |
| Order Lifecycle | 5 | 1 | 1 | 0 |
| Billing | 5 | 1 | 0 | 1 |
| File Storage | 3 | 0 | 0 | 0 |
| Multi-Domain | 6 | 0 | 1 | 0 |
| Admin APIs | 7 | 2 | 2 | 1 |
| Logging | 7 | 0 | 0 | 0 |
| Infrastructure | 5 | 0 | 1 | 0 |
| Testing | 4 | 0 | 0 | 0 |
| **TOTAL** | **60** | **7** | **17** | **8** |

---

*This document is the single source of truth for MVP scope. Any feature not listed in v1.0 Must Have or Should Have is not part of the initial delivery. Refer to this document when evaluating any new feature request.*
