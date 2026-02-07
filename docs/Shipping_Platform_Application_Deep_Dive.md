# Shipping Label Platform — Application Deep Dive

This document explains the **Shipping Label Platform** (rebuild of app.printnsend.com) in depth: product purpose, architecture, data model, APIs, order lifecycle, and design principles. It is intended for developers, product, and stakeholders who need a single reference for the full system.

---

## Table of Contents

1. [Product Overview](#1-product-overview)  
2. [Why Rebuild](#2-why-rebuild)  
3. [High-Level Architecture](#3-high-level-architecture)  
4. [Multi-Domain Ecosystem](#4-multi-domain-ecosystem)  
5. [Components in Detail](#5-components-in-detail)  
6. [Database Structure](#6-database-structure)  
7. [API Structure](#7-api-structure)  
8. [Order Lifecycle](#8-order-lifecycle)  
9. [Billing & Credits](#9-billing--credits)  
10. [Authentication & Sessions](#10-authentication--sessions)  
11. [Logging & Observability](#11-logging--observability)  
12. [Tech Stack](#12-tech-stack)  
13. [Validation & Business Rules](#13-validation--business-rules)  
14. [Critical Design Principles](#14-critical-design-principles)  
15. [In Scope vs Out of Scope](#15-in-scope-vs-out-of-scope)  

---

## 1. Product Overview

### What It Is

The **Shipping Label Platform** is a **complete rebuild** of **app.printnsend.com** — a platform where users buy **discounted shipping labels** (USPS, UPS) for parcels. The rebuild preserves existing business logic and workflows while elevating UX, adding real-time visibility, and enabling multi-domain, multi-brand deployment.

### Core User Journey

1. **User** signs up / logs in on a **branded website** (e.g. shipfast.com, labelking.io).  
2. **User** creates a shipping label (single or bulk via CSV).  
3. **User** pays (credit-based; credits are topped up via crypto, e.g. USDC/USDT).  
4. **System** submits the order to a **3rd party processor** (black box) that talks to carrier APIs and generates the label.  
5. **User** sees order status (pending → processing → completed/failed) and **downloads the label** when ready (e.g. from Minio via presigned URL).

### Key Characteristics

- **Multi-domain:** Same codebase runs on multiple hosts; each host is a “brand” (different domain, optional branding, pricing, feature flags).  
- **Central database:** One MongoDB instance holds users, orders, domain settings, logs — single source of truth.  
- **Admin control:** A separate Admin Panel (separate app) manages domains, users, pricing, features, and orders via **Admin APIs**.  
- **Processor as black box:** The platform does **not** call carrier APIs directly; it writes “pending” orders and reads status/results. A 3rd party processor polls, claims, processes, and updates orders.

---

## 2. Why Rebuild

### Current Problems (Existing app.printnsend.com)

- **No order visibility** — users submit and hope; little or no status tracking.  
- **No status tracking** — no clear pending/processing/completed/failed flow.  
- **Outdated, clunky UI** — poor hierarchy, usability, and responsiveness.  
- **Hardcoded behavior** — pricing, features, and settings not controllable via admin or API.

### Goals of the Rebuild

- **Real-time order visibility and tracking** — users see status and can download labels when ready.  
- **Modern, responsive UI** — clear hierarchy, better UX, alignment with reference (e.g. Lovable).  
- **Full admin control via APIs** — domains, users, pricing, features, orders manageable without code changes.  
- **Multi-domain, multi-brand support** — same system powers multiple branded sites from one codebase and one database.

---

## 3. High-Level Architecture

### System Overview (Top View)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        BRANDED WEBSITE INSTANCES                                  │
│                   (Same codebase, different host/domain)                          │
│                                                                                   │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│   │ shipfast.com│    │ labelking.io│    │quickship.net│    │ Future...   │      │
│   │   (Host A)  │    │   (Host B)  │    │   (Host C)  │    │   (Host N)  │      │
│   │  Django App │    │  Django App │    │  Django App │    │  Django App │      │
│   │  + Branding │    │  + Branding │    │  + Branding │    │  + Branding │      │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘      │
│          │                  │                  │                  │              │
│          └──────────────────┴────────┬─────────┴──────────────────┘              │
└──────────────────────────────────────┼──────────────────────────────────────────┘
                                       ▼
              ████████████████████████████████████████████████████████
              █              CENTRAL MONGODB DATABASE                █
              █              (Single Source of Truth)                █
              █  • Users (with domain)    • Feature Flags            █
              █  • Orders • Transactions  • Domain Settings          █
              █  • Logs (centralized)    • Pricing Rules            █
              ████████████████████████████████████████████████████████
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
   ┌─────────────────────────┐  ┌────────────────┐  ┌─────────────────────────┐
   │      MINIO STORAGE       │  │  ADMIN PANEL   │  │  3RD PARTY PROCESSOR   │
   │   (Label PDFs/PNGs)      │  │ (Separate App) │  │       (Black Box)       │
   │  /{domain}/{user}/       │  │  • ALL domains │  │  • Polls pending orders │
   │     /{order}/label.pdf   │  │  • ALL users   │  │  • Calls carrier APIs   │
   │                          │  │  • Via Admin   │  │  • Generates labels     │
   │                          │  │    API         │  │  • Updates order status │
   └─────────────────────────┘  └────────────────┘  └─────────────────────────┘
```

### Data Flow (Simplified)

1. **User** interacts with a **branded Django app** (e.g. shipfast.com).  
2. **Django app** reads/writes **MongoDB** (users, orders, domain_settings) and calls **Admin API** when needed (e.g. pricing, feature flags).  
3. **3rd party processor** polls MongoDB for **pending** orders, claims them, calls **carrier APIs** (USPS, UPS), uploads label files to **Minio**, and updates order status in MongoDB.  
4. **User** (via same Django app) polls or refreshes to see status and gets a **presigned URL** from Minio to download the label.  
5. **Admin Panel** (separate app) uses **Admin APIs** to manage domains, users, orders, pricing, features, and view **centralized logs**.

---

## 4. Multi-Domain Ecosystem

### Concept

- **One codebase** — same Django application.  
- **Multiple hosts** — each host has its own domain (e.g. shipfast.com, labelking.io).  
- **Domain detected at runtime** — e.g. from `Host` header or config; every request is bound to a **domain**.  
- **All data is domain-scoped** — users, orders, logs, and settings are tied to a domain (or list of allowed domains for cross-domain login).

### What Varies by Domain

| Setting           | Controlled By      | Example                          |
|-------------------|--------------------|----------------------------------|
| Branding          | Domain config      | Blue vs gold theme, logo, name   |
| Pricing           | Admin API          | $4.50 vs $5.00 per label         |
| Services          | Feature flags      | USPS only vs USPS + UPS          |
| Signup            | Admin API          | Open vs closed registration      |

### Users and Domains

- Users have a **registered_domain** (where they signed up).  
- **Future:** Users may have **allowed_domains** and log in from any of them (cross-domain login).  
- All queries (orders, balance, logs) are scoped by domain so that one brand cannot see another’s data.

---

## 5. Components in Detail

### 5.1 Branded Django Web Apps

- **Role:** User-facing site per brand (shipfast.com, labelking.io, etc.).  
- **Responsibilities:** Auth, create order, view status, download label, billing (view balance, add credits).  
- **Stack (from Walkthrough):** Django 5.x, Django Templates, HTMX, Alpine.js. (Alternative: separate SPA consuming same APIs.)  
- **Data:** Reads/writes MongoDB; domain comes from request.  
- **Integration:** Writes orders as `pending`; reads status and Minio presigned URLs; no direct carrier or processor API calls.

### 5.2 Central MongoDB Database

- **Role:** Single source of truth for users, orders, transactions, domain settings, feature flags, and logs.  
- **Collections (conceptual):** Users, Orders, Transactions, Domain Settings, Feature Flags, Logs (and any other domain-scoped entities).  
- **Critical:** All writes for orders and balance changes should be **transactional** where multiple collections are updated (e.g. order create + balance debit + log).

### 5.3 Admin Panel (Separate Application)

- **Role:** Manage the entire ecosystem (all domains, all users, all orders, pricing, features, logs).  
- **Scope:** Separate project; not part of the main “rebuild” codebase.  
- **Integration:** Uses **Admin APIs** only (`/api/admin/v1/`).  
- **Capabilities:** Add/remove domains, set branding, enable/disable signup, manage users (status, balance, custom pricing), set global/per-domain/per-user pricing, toggle features, view/cancel/refund orders, view centralized logs.

### 5.4 3rd Party Processor (Black Box)

- **Role:** Poll MongoDB for pending orders, call carrier APIs (USPS, UPS), generate labels, upload to Minio, update order status; also handles crypto payment detection and refunds.  
- **Interaction with this project:**  
  - **We do:** Write orders with status `pending`; read order status and label file path/URL from MongoDB (or Minio presigned URL).  
  - **We do not:** Call the processor directly; modify processor code; implement carrier APIs ourselves.  
- **Contract:** Clear document shape for “pending” order and possible status values (e.g. pending, processing, completed, failed, cancelled) and where to read the label path/URL.

### 5.5 Minio (S3-Compatible Storage)

- **Role:** Store generated label files (PDF/PNG).  
- **Path pattern (example):** `/{domain}/{user_id}/{order_id}/label.pdf`  
- **Access:** Presigned URLs (e.g. 1-hour expiry); never expose storage credentials to the frontend.  
- **Scope:** This project integrates with Minio (generate presigned URLs, possibly write path back to order document after processor upload).

---

## 6. Database Structure

### Domain-Aware Design

Every major entity has a **domain** (or equivalent) so that:

- Queries can filter by domain.  
- Admin can aggregate or filter by domain.  
- Future products (marketing, analytics) can use the same DB with clear boundaries.

### Example Document Shapes (Conceptual)

**users (simplified):**

```json
{
  "email": "user@example.com",
  "registered_domain": "shipfast.com",
  "allowed_domains": ["shipfast.com", "labelking.io"],
  "credit_balance": 125.50,
  "custom_pricing": { "usps_priority": 4.25 },
  "is_active": true
}
```

**domain_settings (simplified):**

```json
{
  "domain": "shipfast.com",
  "display_name": "Ship Fast",
  "primary_color": "#0066CC",
  "signup_enabled": true,
  "enabled_carriers": ["usps", "ups"],
  "pricing": { "usps_priority": 4.50 }
}
```

**orders:**  
- Must include at least: `_id`, `domain`, `user_id`, `status`, `created_at`, `updated_at`, and (when completed) reference to label file (e.g. path or Minio key).  
- Status values align with processor contract (e.g. pending, processing, completed, failed, cancelled).

### Collections (Summary)

- **Users** — identity, domain(s), balance, custom pricing, active flag.  
- **Orders** — per-order data, status, carrier, service, label reference.  
- **Transactions** — credit/debit history (e.g. top-up, purchase, refund).  
- **Domain Settings** — per-domain branding, signup, carriers, pricing.  
- **Feature Flags** — per-domain or global toggles.  
- **Logs** — centralized, domain-scoped, with level and retention (see Logging).

---

## 7. API Structure

### User-Facing API: `/api/v1/`

- **auth/** — register, login, logout, refresh (and optionally profile).  
- **orders/** — create order, list my orders, get order detail, get download URL for label.  
- **billing/** — get balance, add credits (e.g. initiate crypto flow), list transactions.

All endpoints are **domain-aware** (domain from request or token) and **user-scoped** (authenticated user).

### Admin API: `/api/admin/v1/`

- **domains/** — list/add domains; get/put/delete domain; domain settings (branding, signup, services).  
- **users/** — list users (all domains); user status (activate, deactivate, suspend); balance (credit, debit); custom pricing.  
- **orders/** — list/filter orders; cancel; refund.  
- **pricing/** — global pricing.  
- **features/** — feature flags.  
- **logs/** — query centralized logs (by domain, user, level, time range).  
- **system/** — health, stats, maintenance.

Admin endpoints are **authenticated and authorized** (admin-only); responses can span domains unless filtered.

### Important Details

- **Versioning:** Keeping `/api/v1/` and `/api/admin/v1/` from day one avoids breaking future clients.  
- **Idempotency:** For order creation and balance operations, support idempotency keys where applicable.  
- **Documentation:** OpenAPI/Swagger for both namespaces recommended.

---

## 8. Order Lifecycle

### Status Flow

```
PENDING  →  PROCESSING  →  COMPLETED
                ↓
            FAILED
                +
            CANCELLED (e.g. by user or admin)
```

- **PENDING:** Order created and written to DB; processor has not yet claimed it.  
- **PROCESSING:** Processor has claimed the order; carrier API call in progress.  
- **COMPLETED:** Label generated and stored (e.g. Minio); order has label path/URL; user can download.  
- **FAILED:** Processor or carrier reported failure; no retry (user may create a new order).  
- **CANCELLED:** Order cancelled by user or admin before completion.

### End-to-End Flow

1. User submits label request (addresses, weight, service, etc.).  
2. App validates, checks balance, applies pricing (domain + user).  
3. App writes order to MongoDB with status **pending** and (if applicable) debits balance in the same transaction.  
4. Processor polls MongoDB, claims pending orders (e.g. atomic status update to **processing**).  
5. Processor calls carrier API, uploads label to Minio, updates order to **completed** (and writes label path/URL).  
6. If failure: processor sets status to **failed**; business rules may trigger refund/credit.  
7. UI polls (e.g. every 5 seconds) or uses real-time channel; when **completed**, user gets presigned URL and downloads the label.

---

## 9. Billing & Credits

- **Model:** Credit-based. User tops up (e.g. crypto USDC/USDT) → credits added; creating a label debits credits.  
- **Pricing:** Can be global, per-domain, or per-user (custom_pricing). Resolved in order of user → domain → global.  
- **Refunds:** If order fails or is cancelled, credits are refunded per business rules.  
- **Integrity:** Balance changes (credit/debit/refund) should be in **transactions** and, where applicable, inside MongoDB transactions with order creation/update.

---

## 10. Authentication & Sessions

- **Method:** Custom JWT (e.g. 3-hour access token).  
- **Passwords:** bcrypt (or equivalent).  
- **Sessions:** Stored in DB (no Redis in scope).  
- **Future:** Cross-domain login (user can log in on domain B if allowed_domains includes B).  
- **Recommendation:** Include domain (or allowed_domains) in token so APIs can enforce domain scope without a DB lookup on every request.

---

## 11. Logging & Observability

- **Centralized:** All domains write to the same log store (e.g. same collection or same pipeline).  
- **Domain- and user-scoped:** Every log entry should have domain (and ideally user_id, order_id where relevant).  
- **Structured:** JSON with level, timestamp, action, domain, user_id, order_id, message, and optional request_id/trace_id.  
- **Categories (examples):** auth, order, payment, admin, system.  
- **Retention (examples):** debug 7 days, info 30 days, warning 90 days, error 180 days, critical/admin 365 days.  
- **Sensitive data:** Never log full payment credentials or tokens; mask or omit.

---

## 12. Tech Stack (From Walkthrough)

| Layer      | Technology                          |
|-----------|--------------------------------------|
| Backend   | Django 5.x                           |
| Database  | MongoDB (e.g. django-mongodb-backend)|
| Frontend  | Django Templates + HTMX + Alpine.js  |
| Storage   | Minio (S3-compatible)                |
| Auth      | Custom JWT (3hr sessions)            |
| Payments  | Ethereum (USDC/USDT)                 |

*Note: Product Collaboration doc also mentions Supabase, PostgreSQL, Coolify — used for infrastructure and possibly auth/analytics; MongoDB remains the primary app DB for this project.*

---

## 13. Validation & Business Rules

Examples from the Walkthrough (to be refined with product):

- **Address:** e.g. 32 chars; city 24; name 32.  
- **Weight:** e.g. max 70 lbs.  
- **Bulk:** e.g. max 100 labels per CSV.  
- **Polling:** e.g. UI polls every 5 seconds for order status.  
- **Failed orders:** No retry; user creates a new order.

All such rules should be enforced in the backend and documented; admin may override some via API.

---

## 14. Critical Design Principles

1. **Everything is domain-scoped** — users, orders, logs, pricing all have domain context.  
2. **Admin API = full control** — anything the admin panel needs to do must be possible via Admin API.  
3. **MongoDB is the single source of truth** — all systems read/write the same DB; no duplicate sources of truth.  
4. **Processor is a black box** — we only write pending orders and read status/results; we do not modify or replace the processor.  
5. **No hardcoding** — pricing, features, and settings come from DB and API, not code.  
6. **Centralized logging is mandatory** — every important action is logged with domain (and user/order where relevant); admin can view/filter/search across domains.

---

## 15. In Scope vs Out of Scope

### In Scope (This Project)

- Django web apps (one codebase, multiple hosts).  
- User-facing APIs (`/api/v1/`).  
- Admin APIs (`/api/admin/v1/`) — robust and complete for admin needs.  
- MongoDB schema, queries, and transactional patterns.  
- Minio integration (presigned URLs, path storage).  
- Domain-aware data model and request handling.  
- Centralized, domain-aware logging.  
- Rebuild of user flows (create label, pay, poll, download) with improved UX.

### Out of Scope (Separate Projects or External)

- Admin Panel **UI** (separate project consuming Admin API).  
- 3rd party processor implementation or modification.  
- Carrier APIs (USPS, UPS) — called only by the processor.  
- Crypto payment processing logic inside the processor (we may initiate or record; processor detects and confirms).  
- Marketing/landing pages, analytics platform — future products, same core system and DB.

---

## Summary

The Shipping Label Platform is a **multi-domain rebuild** of app.printnsend.com: same codebase for many branded sites, **one MongoDB** as single source of truth, **Admin APIs** for full control, and a **processor black box** for label generation. Orders move from **pending → processing → completed/failed/cancelled**; users pay with **credits** and download labels from **Minio**. Success depends on **domain-scoped data**, **clear API and processor contracts**, **centralized logging**, and **no hardcoding** of pricing or features. This document should serve as the single deep reference for the application’s design and scope.
