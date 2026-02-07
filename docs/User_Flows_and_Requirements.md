# Shipping Label Platform — User Flows & Requirements

**Prepared by:** Dhinesh Muthukaruppan  
**Date:** February 2025  
**Source:** Project Walkthrough, Product Collaboration Brief, app.printnsend.com exploration  

---

## Table of Contents

1. [User Roles](#1-user-roles)
2. [Authentication Flows](#2-authentication-flows)
3. [Single Label Creation Flow](#3-single-label-creation-flow)
4. [Bulk CSV Label Creation Flow](#4-bulk-csv-label-creation-flow)
5. [Order Lifecycle & Status Tracking](#5-order-lifecycle--status-tracking)
6. [Billing & Credit System Flows](#6-billing--credit-system-flows)
7. [File Download Flows](#7-file-download-flows)
8. [User Dashboard & Order History](#8-user-dashboard--order-history)
9. [Multi-Domain User Experience](#9-multi-domain-user-experience)
10. [Admin Flows (via API)](#10-admin-flows-via-api)
11. [Validation Rules](#11-validation-rules)
12. [Error Scenarios & Edge Cases](#12-error-scenarios--edge-cases)
13. [System Interactions (Processor, Minio, MongoDB)](#13-system-interactions)

---

## 1. User Roles

### 1.1 End User (Customer)

- Registers on a specific branded domain (e.g. shipfast.com)
- Buys discounted shipping labels (USPS, UPS)
- Manages their balance (crypto deposits)
- Views order history and downloads labels
- Domain-aware: user is tied to the domain they registered on

### 1.2 Admin (via Admin Panel — separate app)

- Manages ALL domains from a centralized dashboard
- Manages users across all domains (activate, suspend, adjust balance)
- Controls pricing globally, per-domain, and per-user
- Toggles feature flags per domain
- Views all orders across all domains
- Queries centralized logs
- Issues cancellations and refunds

### 1.3 3rd Party Processor (Black Box — not built by us)

- Polls MongoDB for pending orders
- Claims and processes orders
- Calls carrier APIs (USPS, UPS)
- Generates label files and uploads to Minio
- Updates order status in MongoDB
- Detects crypto payments

---

## 2. Authentication Flows

### 2.1 Registration

```
User visits branded domain (e.g. shipfast.com)
  → Checks: Is signup_enabled for this domain? (from domain_settings)
    → NO: Show "Registration is currently closed for this domain" message
    → YES: Show registration form

Registration Form:
  - Email address (required, valid format, unique per domain)
  - Password (required, min 8 chars, bcrypt hashed)
  - First name (required)
  - Last name (required)

Submit:
  → Validate all fields server-side
  → Check email uniqueness within this domain
  → Create user document in MongoDB:
    {
      email, password_hash, first_name, last_name,
      registered_domain: "shipfast.com",
      allowed_domains: ["shipfast.com"],
      credit_balance: 0.00,
      custom_pricing: {},
      is_active: true,
      role: "user",
      created_at: now
    }
  → Log: category=auth, action=user_registered, domain=shipfast.com
  → Issue JWT (3hr access token + refresh token)
  → Create session record in MongoDB
  → Redirect to dashboard
```

**Edge Cases:**
- Email already exists on this domain → "Email already registered"
- Email exists on a different domain → Still allowed (domain-scoped uniqueness)
- Signup disabled for domain → Show clear message, no registration form
- Weak password → Show validation error with requirements
- Network error during registration → Show retry option

### 2.2 Login

```
User visits branded domain login page
  → Show login form (email + password)

Submit:
  → Find user by (domain + email)
    → NOT FOUND: "Invalid email or password" (don't reveal which)
    → FOUND but is_active=false: "Your account has been deactivated. Contact support."
    → FOUND and is_active=true:
      → Verify password (bcrypt compare)
        → WRONG: "Invalid email or password"
        → Log: category=auth, action=login_failed, domain, email, ip
        → CORRECT:
          → Issue JWT (3hr access + refresh token)
          → Create session in MongoDB (user_id, domain, token_hash, ip, user_agent, expires_at)
          → Log: category=auth, action=login_success, domain, user_id, ip
          → Redirect to dashboard
```

**Edge Cases:**
- Brute force → Rate limit: max 5 failed attempts per 15 min per IP
- Expired JWT → Use refresh token to get new access token
- Expired refresh token → Redirect to login page
- User deactivated between requests → JWT still valid but middleware checks is_active on each request
- Cross-domain login (FUTURE): user registered on domain A can login on domain B if B is in their allowed_domains

### 2.3 Logout

```
User clicks "Logout"
  → Revoke session in MongoDB (set revoked=true)
  → Clear JWT from client (cookie/localStorage)
  → Log: category=auth, action=logout, domain, user_id
  → Redirect to login page
```

### 2.4 Password Reset

```
User clicks "Forgot Password" on login page
  → Show email input form

Submit:
  → Find user by (domain + email)
    → NOT FOUND: Show "If this email is registered, you'll receive a reset link" (no reveal)
    → FOUND:
      → Generate secure reset token (random, hashed in DB, expires in 1 hour)
      → Send email with reset link: https://{domain}/reset-password?token=xxx
      → Log: category=auth, action=password_reset_requested, domain, user_id

User clicks reset link:
  → Validate token (exists, not expired, not used)
    → INVALID: "This link has expired or is invalid"
    → VALID: Show new password form

Submit new password:
  → Hash new password with bcrypt
  → Update user document
  → Invalidate all existing sessions for this user
  → Log: category=auth, action=password_reset_completed, domain, user_id
  → Redirect to login with "Password updated successfully" message
```

---

## 3. Single Label Creation Flow

### 3.1 Main Flow

```
User navigates to "Create Label" page
  → Check: domain has enabled_carriers (from domain_settings)
  → Show label creation form

STEP 1: Sender Address (Ship From)
  - Name (required, max 32 chars)
  - Company (optional, max 32 chars)
  - Address Line 1 (required, max 32 chars)
  - Address Line 2 (optional, max 32 chars)
  - City (required, max 24 chars)
  - State (required, US state select)
  - ZIP Code (required, 5 or 9 digits)
  - Phone (optional)

STEP 2: Recipient Address (Ship To)
  - Same fields as sender

STEP 3: Package Details
  - Weight (required, max 70 lbs)
  - Length, Width, Height (dimensions)
  - Carrier (select from domain's enabled_carriers: USPS, UPS, or both)
  - Service type (dropdown based on selected carrier):
    - USPS: Priority Mail, First Class, Ground Advantage, Priority Express, etc.
    - UPS: Ground, 2nd Day Air, Next Day Air, etc.

STEP 4: Review & Price
  → Client sends address + package details to pricing API
  → Pricing engine resolves rate:
    1. Check user.custom_pricing for this carrier+service → use if exists
    2. Check domain_settings.pricing for this carrier+service → use if exists
    3. Use global pricing for this carrier+service
  → Display price breakdown to user
  → Display current balance

STEP 5: Confirm & Create
  → User clicks "Create Label"
  → Server-side validation:
    1. Validate all address fields (lengths, formats)
    2. Validate address with StreetVerify API (correct format, deliverable)
    3. Validate package details (weight within limits, dimensions reasonable)
    4. Check user balance >= label price
    5. Generate idempotency key (prevent duplicate orders on double-click)
  → Within MongoDB transaction:
    a. Debit user.credit_balance by label price
    b. Create order document (status: "pending")
    c. Create transaction document (type: "debit", reference: order_id)
    d. Create log entry (category: "order", action: "order_created")
  → Return order_id to client
  → Redirect to order status page
```

### 3.2 Address Validation (StreetVerify)

```
Before order creation:
  → Send sender address to StreetVerify API
  → Send recipient address to StreetVerify API
  → Responses:
    - VALID: Address confirmed, proceed
    - CORRECTED: Address slightly adjusted (e.g. ZIP+4 added) → show corrected version, ask user to confirm
    - INVALID: Address cannot be verified → show error, ask user to correct
    - API ERROR: StreetVerify unavailable → allow order with warning in log
```

---

## 4. Bulk CSV Label Creation Flow

### 4.1 CSV Upload

```
User navigates to "Bulk Upload" page
  → Show file upload area (drag & drop or file picker)
  → Accepted: .csv files only, max 100 rows, max file size TBD

User uploads CSV file:
  → Parse CSV (handle encoding, delimiters)
  → Validate CSV structure:
    - Required columns present? (sender_name, sender_address1, sender_city, sender_state, 
      sender_zip, recipient_name, recipient_address1, recipient_city, recipient_state, 
      recipient_zip, weight, carrier, service)
    - Column headers match expected names?
    - Row count <= 100?
  → If structure invalid: show error with specific column issues
```

### 4.2 Row-by-Row Validation

```
For each row in CSV:
  → Validate sender address fields (same rules as single label)
  → Validate recipient address fields
  → Validate package details (weight, carrier, service)
  → Mark row as: VALID, WARNING, or ERROR

Display validation results:
  → Summary: "85 valid, 10 warnings, 5 errors"
  → Table showing each row with status:
    - GREEN rows: all fields valid
    - YELLOW rows: minor issues (e.g. address corrected by StreetVerify)
    - RED rows: critical errors (missing required field, invalid format)
```

### 4.3 Fix Wizard

```
User sees validation results with inline errors
  → For each ERROR row:
    - Show the specific field(s) with errors
    - Allow inline editing to correct the issue
    - Re-validate on change
  → For each WARNING row:
    - Show the correction suggestion
    - Allow user to accept or modify
  → User fixes all errors
  → "Re-validate" button to check all rows again
  → When all rows are VALID or WARNING-accepted:
    - Show total price (sum of all labels)
    - Show current balance
    - Enable "Create All Labels" button
```

### 4.4 Batch Order Creation

```
User clicks "Create All Labels":
  → Check total price <= user balance
    → INSUFFICIENT: "You need $X more credits. Current balance: $Y"
  → Generate batch_id (links all orders in this upload)
  → Within MongoDB transaction:
    a. Debit user.credit_balance by total price
    b. Create order document for EACH row (status: "pending", batch_id: batch_id)
    c. Create single transaction document (type: "debit", amount: total, reference: batch_id)
    d. Create log entry (category: "order", action: "bulk_order_created", metadata: {count: N, batch_id})
  → If ANY order creation fails → rollback entire transaction, refund balance
  → Return batch_id to client
  → Redirect to batch status page
```

### 4.5 Batch Status Tracking

```
Batch status page shows:
  → Batch summary: total orders, completed, processing, pending, failed
  → Progress bar: X/N completed
  → Individual order list with status badges
  → Auto-poll every 5 seconds for updates
  → When ALL orders are completed:
    - Show "Download All (ZIP)" button
  → When SOME orders have failed:
    - Show which failed, with error messages
    - Failed labels auto-refunded (see billing flow)
    - Offer "Download completed labels" for successful ones
```

---

## 5. Order Lifecycle & Status Tracking

### 5.1 Status Flow

```
PENDING → PROCESSING → COMPLETED
                    → FAILED
PENDING → CANCELLED (admin only)
```

### 5.2 Status Details

| Status | Set By | Meaning | UI Color | User Action |
|--------|--------|---------|----------|-------------|
| `pending` | Our app | Order created, waiting for processor | Yellow | Wait |
| `processing` | Processor | Processor has claimed the order | Blue | Wait |
| `completed` | Processor | Label generated, file uploaded to Minio | Green | Download |
| `failed` | Processor | Carrier rejected, or processing error | Red | Balance auto-refunded, create new order |
| `cancelled` | Admin API | Admin cancelled a pending order | Grey | Balance refunded |

### 5.3 Status Polling (User-Facing)

```
After order creation, user lands on order status page:
  → Display: order details, current status, status timeline
  → UI polls backend every 5 seconds:
    GET /api/v1/orders/{order_id}/status/
    → Returns: { status, tracking_number (if completed), label_path (if completed), error_message (if failed) }
  → On status change:
    - Update UI badge and timeline
    - If COMPLETED: show "Download Label" button, show tracking number
    - If FAILED: show error message, show "Balance has been refunded" notice
  → Stop polling when status is terminal (completed, failed, cancelled)
```

### 5.4 What Happens at Each Stage

```
PENDING (our app creates order):
  → Order document written to MongoDB with status="pending"
  → User balance already deducted
  → Log: order_created

PROCESSING (processor claims order):
  → Processor polls MongoDB for status="pending" orders
  → Processor atomically sets status="processing" and claims the order
  → We detect this via status poll

COMPLETED (processor finished):
  → Processor called carrier API, got label
  → Processor uploaded label file to Minio: /{domain}/{user_id}/{order_id}/label.pdf
  → Processor set status="completed", label_path, tracking_number in MongoDB
  → We detect this via status poll → show download button

FAILED (processor encountered error):
  → Carrier rejected the order, or processing error occurred
  → Processor set status="failed", error_message in MongoDB
  → We detect this via status poll → trigger auto-refund:
    a. Credit user.credit_balance by label price
    b. Create transaction (type: "refund", reference: order_id)
    c. Log: category=payment, action=auto_refund
  → Show user: "This order failed. Your balance has been refunded."

CANCELLED (admin action):
  → Admin calls POST /api/admin/v1/orders/{id}/cancel/
  → Only works on "pending" orders (not processing or completed)
  → Set status="cancelled"
  → Credit user balance (refund)
  → Create transaction + log
```

---

## 6. Billing & Credit System Flows

### 6.1 Credit Balance Model

```
User has a credit_balance field (Decimal) in their user document.
All label purchases are deducted from this balance.
There is no direct payment per label — user pre-loads credits.

Balance Operations:
  - CREDIT: Crypto deposit detected by processor → balance increased
  - DEBIT: Label created → balance decreased
  - REFUND: Failed order → balance restored
  - ADMIN CREDIT: Admin adds credits manually
  - ADMIN DEBIT: Admin removes credits manually
```

### 6.2 Crypto Deposit Flow

```
User navigates to "Add Funds" / "Deposit" page:
  → Display user's unique crypto wallet address (generated per user)
  → Display supported currencies: USDC, USDT (Ethereum)
  → Display current balance

User sends crypto to the wallet address:
  → Processor detects payment on blockchain (THIS IS OUT OF SCOPE — processor handles it)
  → Processor updates user.credit_balance in MongoDB
  → Processor creates transaction record (type: "credit", description: "crypto deposit")
  → Our app detects the balance change on next poll/request
  → Log: category=payment, action=crypto_deposit_detected

User sees updated balance on refresh/next page load.
```

### 6.3 Balance Check Before Order

```
When user creates a single label or bulk order:
  → Calculate total price (single label price, or sum of all CSV labels)
  → Fetch user.credit_balance from MongoDB
  → IF balance < total_price:
    - Reject order creation
    - Show: "Insufficient balance. You need $X more. Current balance: $Y"
    - Show link to deposit page
  → IF balance >= total_price:
    - Proceed with order creation
    - Debit balance atomically within the same transaction as order creation
```

### 6.4 Transaction History

```
User navigates to "Transaction History" / "Billing" page:
  → Fetch transactions from MongoDB, filtered by user_id, sorted by created_at desc
  → Display table:
    | Date/Time | Type | Amount | Balance After | Reference | Description |
    |-----------|------|--------|---------------|-----------|-------------|
    | Feb 5, 2:30 PM | Credit | +$50.00 | $125.50 | deposit_abc | Crypto deposit |
    | Feb 5, 3:00 PM | Debit | -$4.50 | $121.00 | order_123 | USPS Priority label |
    | Feb 5, 3:05 PM | Refund | +$4.50 | $125.50 | order_123 | Order failed - auto refund |
  → Pagination (20 per page)
  → Filters: type (credit/debit/refund), date range
```

---

## 7. File Download Flows

### 7.1 Single Label Download

```
Order status is "completed":
  → Order document has label_path: "/{domain}/{user_id}/{order_id}/label.pdf"
  → User clicks "Download Label" button
  → Backend generates presigned URL from Minio (1-hour expiry)
  → Redirect user to presigned URL → browser downloads the PDF
  → Log: category=order, action=label_downloaded, order_id
```

### 7.2 Bulk Label Download (ZIP)

```
Batch has all orders completed (or some completed, some failed):
  → User clicks "Download All Labels (ZIP)"
  → Backend:
    1. Fetch all orders in batch with status="completed"
    2. For each order, get label_path from order document
    3. Fetch each file from Minio
    4. Stream into ZIP archive
    5. Return ZIP to user as download
  → File naming in ZIP: {recipient_name}_{tracking_number}.pdf
  → Log: category=order, action=bulk_labels_downloaded, batch_id
```

### 7.3 Re-download from Order History

```
User navigates to "Order History" page:
  → Fetch orders for this user, sorted by created_at desc
  → For each completed order: show "Download" button
  → Clicking download → same presigned URL flow as single label
  → Old labels (if cleanup policy exists) may show "Label expired" if files have been archived
```

---

## 8. User Dashboard & Order History

### 8.1 Dashboard (Landing Page After Login)

```
User logs in → Redirected to dashboard
  → Display:
    - Current balance (prominent)
    - Quick actions: "Create Label", "Bulk Upload", "Add Funds"
    - Recent orders (last 5-10) with status badges
    - Quick stats: total labels this month, total spent this month
```

### 8.2 Order History Page

```
User navigates to "Order History" / "My Orders":
  → Fetch orders for this user from MongoDB
  → Display table:
    | Date | Order ID | Carrier | Service | From → To | Status | Tracking | Actions |
    |------|----------|---------|---------|-----------|--------|----------|---------|
    | Feb 5 | #123 | USPS | Priority | NYC → LA | Completed | 9400... | Download |
    | Feb 5 | #124 | UPS | Ground | NYC → CHI | Failed | — | — |
    | Feb 4 | Batch #B5 | Mixed | Mixed | — | 8/10 Done | — | Download ZIP |
  → Filters: status, carrier, date range
  → Pagination (20 per page)
  → Click on order → Order detail page
```

### 8.3 Order Detail Page

```
Shows full order details:
  - Order ID, created date, batch ID (if bulk)
  - Carrier + service
  - Sender address (full)
  - Recipient address (full)
  - Package details (weight, dimensions)
  - Price paid
  - Status with timeline:
    ✓ Created (Feb 5, 3:00 PM)
    ✓ Processing (Feb 5, 3:00 PM)
    ✓ Completed (Feb 5, 3:02 PM)
  - Tracking number (if completed)
  - Download button (if completed)
  - Error message (if failed)
  - "Balance refunded" notice (if failed/cancelled)
```

---

## 9. Multi-Domain User Experience

### 9.1 Domain Detection

```
User visits shipfast.com:
  → DomainMiddleware reads Host header → "shipfast.com"
  → Lookup domain_settings from MongoDB (cached 5 min)
  → Inject request.domain into every request
  → All pages render with shipfast.com's branding:
    - Logo, primary color, secondary color
    - Display name ("Ship Fast")
    - Footer text
    - Enabled carriers (USPS + UPS)
    - Pricing specific to this domain

User visits labelking.io:
  → Same app, different branding
  → Different logo, colors ("LabelKing")
  → Different enabled carriers (USPS only)
  → Different pricing
  → Different users (domain-scoped)
```

### 9.2 What Changes Per Domain

| Element | Per-Domain? | Source |
|---------|------------|--------|
| Logo | Yes | domain_settings.branding.logo_url |
| Primary color | Yes | domain_settings.branding.primary_color |
| Secondary color | Yes | domain_settings.branding.secondary_color |
| Display name | Yes | domain_settings.display_name |
| Footer text | Yes | domain_settings.branding.footer_text |
| Available carriers | Yes | domain_settings.enabled_carriers |
| Pricing | Yes (waterfall) | user → domain → global |
| Signup enabled | Yes | domain_settings.signup_enabled |
| Users | Yes (scoped) | users.registered_domain |
| Orders | Yes (scoped) | orders.domain |
| Logs | Yes (scoped) | logs.domain |
| Feature flags | Yes | feature_flags.domain |

### 9.3 Cross-Domain Login (Future Feature)

```
CURRENT: User registered on shipfast.com can ONLY login on shipfast.com.

FUTURE: User registered on shipfast.com can also login on labelking.io
  IF labelking.io is in user.allowed_domains.
  
  Flow:
    → User visits labelking.io login page
    → Enters email + password
    → System finds user by email across all domains
    → Checks: is "labelking.io" in user.allowed_domains?
      → YES: Login succeeds, show labelking.io branding
      → NO: "You don't have access to this domain"
    → User's orders are still domain-scoped (only sees orders created on the current domain)
```

---

## 10. Admin Flows (via API)

All admin actions are performed via Admin APIs consumed by a separate Admin Dashboard (out of scope for this project — we only build the APIs).

### 10.1 Domain Management

```
Add new domain:
  POST /api/admin/v1/domains/
  → Create domain_settings document
  → Configure: display_name, branding, signup_enabled, enabled_carriers, pricing
  → Log: category=admin, action=domain_created

Update domain settings:
  PUT /api/admin/v1/domains/{domain}/settings/
  → Update branding, pricing, carrier config, signup control
  → Changes take effect immediately (domain_settings cache refreshes within 5 min)
  → Log: category=admin, action=domain_settings_updated

Disable domain:
  → Set signup_enabled=false (no new users)
  → Optionally deactivate all users on this domain
```

### 10.2 User Management

```
View all users:
  GET /api/admin/v1/users/?domain=shipfast.com&status=active
  → Paginated, filterable by domain, status, email search

Adjust user balance:
  POST /api/admin/v1/users/{id}/balance/
  → Body: { "type": "credit", "amount": 50.00, "description": "Manual credit" }
  → Updates user.credit_balance
  → Creates transaction record
  → Log: category=admin, action=balance_adjusted

Suspend user:
  PUT /api/admin/v1/users/{id}/status/
  → Body: { "status": "suspended" }
  → Sets is_active=false
  → User's active sessions are revoked
  → Log: category=admin, action=user_suspended

Set custom pricing:
  PUT /api/admin/v1/users/{id}/pricing/
  → Body: { "usps_priority": 3.50, "ups_ground": 5.00 }
  → Overrides domain and global pricing for this user
  → Log: category=admin, action=custom_pricing_set
```

### 10.3 Order Management

```
View all orders:
  GET /api/admin/v1/orders/?domain=shipfast.com&status=failed&date_from=2025-02-01
  → Paginated, filterable by domain, status, user, date range, carrier

Cancel pending order:
  POST /api/admin/v1/orders/{id}/cancel/
  → ONLY works if status="pending" (not processing/completed/failed)
  → Set status="cancelled"
  → Refund user balance
  → Create transaction (type: "refund", description: "Admin cancelled")
  → Log: category=admin, action=order_cancelled

Refund completed order:
  POST /api/admin/v1/orders/{id}/refund/
  → ONLY works if status="completed"
  → Credit user balance by order amount
  → Create transaction (type: "refund", description: "Admin refund")
  → Log: category=admin, action=order_refunded
```

### 10.4 Pricing Management

```
View global pricing:
  GET /api/admin/v1/pricing/
  → Returns pricing for all carriers and services

Update global pricing:
  PUT /api/admin/v1/pricing/
  → Body: { "usps_priority": 4.50, "usps_first_class": 3.00, "ups_ground": 6.00 }
  → Updates global pricing (affects all domains without domain-specific override)
  → Log: category=admin, action=global_pricing_updated

View/update domain pricing:
  GET/PUT /api/admin/v1/pricing/{domain}/
  → Domain-specific pricing that overrides global for that domain
```

### 10.5 Feature Flags

```
Toggle feature per domain:
  PUT /api/admin/v1/features/{flag}/
  → Body: { "domain": "shipfast.com", "enabled": true }
  → Example flags: "bulk_upload", "ups_carrier", "address_autocomplete"
  → Log: category=admin, action=feature_toggled
```

### 10.6 Log Queries

```
Query logs:
  GET /api/admin/v1/logs/?domain=shipfast.com&level=error&category=order&date_from=2025-02-01
  → Paginated, filterable by: domain, level, category, user_id, action, date range
  → Returns structured log entries

Export logs:
  GET /api/admin/v1/logs/export/?format=csv&domain=shipfast.com&date_from=2025-02-01
  → Returns CSV or JSON file download
```

---

## 11. Validation Rules

### 11.1 Address Field Constraints

| Field | Max Length | Required | Format |
|-------|-----------|----------|--------|
| Name | 32 chars | Yes | Alphanumeric + spaces |
| Company | 32 chars | No | Alphanumeric + spaces |
| Address Line 1 | 32 chars | Yes | Alphanumeric + spaces, #, - |
| Address Line 2 | 32 chars | No | Alphanumeric + spaces, #, - |
| City | 24 chars | Yes | Alphabetic + spaces |
| State | 2 chars | Yes | US state abbreviation |
| ZIP Code | 5 or 10 chars | Yes | 5-digit or ZIP+4 format |
| Phone | 15 chars | No | Numeric + dashes |

### 11.2 Package Constraints

| Field | Constraint |
|-------|-----------|
| Weight | Max 70 lbs |
| Carrier | Must be in domain's enabled_carriers |
| Service | Must be valid for selected carrier |

### 11.3 Bulk Upload Constraints

| Constraint | Value |
|-----------|-------|
| Max rows per CSV | 100 |
| File format | .csv only |
| Required columns | sender_name, sender_address1, sender_city, sender_state, sender_zip, recipient_name, recipient_address1, recipient_city, recipient_state, recipient_zip, weight, carrier, service |

### 11.4 System Constraints

| Constraint | Value |
|-----------|-------|
| JWT access token expiry | 3 hours |
| Refresh token expiry | TBD (7-30 days) |
| Status poll interval | 5 seconds |
| Presigned URL expiry | 1 hour |
| Failed login rate limit | 5 attempts per 15 min per IP |
| Domain config cache TTL | 5 minutes |

---

## 12. Error Scenarios & Edge Cases

### 12.1 Order Creation Errors

| Scenario | User Sees | System Action |
|----------|-----------|---------------|
| Insufficient balance | "You need $X more. Balance: $Y" | Order rejected, no balance change |
| Invalid address (StreetVerify) | "Address could not be verified. Please check and try again." | Order rejected, no balance change |
| Duplicate order (idempotency key match) | "This order was already submitted." | Return existing order, no duplicate |
| StreetVerify API down | Warning: "Address could not be verified. Proceeding at your risk." | Order created with warning flag |
| MongoDB transaction failure | "Something went wrong. Please try again." | Full rollback, no balance change |
| User deactivated mid-session | Redirect to login: "Your account has been deactivated." | Session revoked |

### 12.2 Order Processing Errors

| Scenario | User Sees | System Action |
|----------|-----------|---------------|
| Carrier rejects label | "This order failed: [carrier error message]" | Status=failed, auto-refund |
| Processor timeout | "This order failed: Processing timeout" | Status=failed, auto-refund |
| Minio upload failure (processor side) | "This order failed: File upload error" | Status=failed, auto-refund |
| Order stuck in "processing" > 10 min | "Order is still processing..." | Log warning; admin alert |

### 12.3 Billing Edge Cases

| Scenario | Behavior |
|----------|----------|
| Balance goes to exactly $0.00 after order | Allowed; order proceeds |
| Two orders submitted simultaneously (race condition) | Optimistic locking on balance; second order may fail if balance insufficient |
| Crypto deposit arrives during order creation | No conflict; deposit and order debit are independent operations |
| Admin credits balance while user is creating order | No conflict; balance increases, order debit proceeds |
| Partial crypto deposit (less than expected) | Processor handles; partial credit added to balance |
| Double crypto payment | Processor handles; both payments credited |

### 12.4 Multi-Domain Edge Cases

| Scenario | Behavior |
|----------|----------|
| User tries to login on wrong domain | "Invalid email or password" (user doesn't exist on this domain) |
| Domain settings change while user is on the page | Old settings until page refresh or cache expires (5 min) |
| Domain disabled (signup_enabled=false) | Existing users can still login; new registrations blocked |
| Domain completely removed | 404 or "This domain is not configured" — existing users lose access |

---

## 13. System Interactions

### 13.1 Our App ↔ MongoDB

```
WRITES:
  - User documents (registration, profile updates)
  - Order documents (status: pending)
  - Transaction documents (credits, debits, refunds)
  - Session documents (login, logout)
  - Log documents (every action)

READS:
  - User authentication (login, JWT verification)
  - Domain settings (every request, via cache)
  - Order status (polling, order history)
  - User balance (before order creation, dashboard)
  - Transaction history (billing page)
  - Feature flags (feature checks)
```

### 13.2 Our App ↔ Minio

```
READS ONLY:
  - Generate presigned URLs for label downloads
  - Fetch files for ZIP generation (bulk download)

We NEVER write to Minio directly.
The processor writes labels to Minio.
We only read via presigned URLs.

Path convention: /{domain}/{user_id}/{order_id}/label.pdf
```

### 13.3 Our App ↔ 3rd Party Processor

```
NO DIRECT INTERACTION.

Our app writes orders to MongoDB (status: pending).
Processor polls MongoDB, picks up pending orders.
Processor updates order status in MongoDB.
Processor writes label files to Minio.

We observe the processor's work by reading MongoDB.
We never call the processor via HTTP, RPC, or any other protocol.
The processor is a complete black box.
```

### 13.4 Our App ↔ StreetVerify API

```
OUTBOUND CALLS:
  - Validate sender address before order creation
  - Validate recipient address before order creation
  - Response: valid / corrected / invalid

HANDLING:
  - Valid → proceed
  - Corrected → show corrected version to user, ask to confirm
  - Invalid → reject, show error
  - API down → log warning, allow order with flag
```

### 13.5 Our App ↔ Admin Panel (Future, Separate App)

```
Admin Panel is a SEPARATE web application.
It consumes our Admin APIs (/api/admin/v1/).
We build the APIs; someone else builds the Admin Panel UI.

Our APIs must support everything the admin needs:
  - Domain CRUD + settings
  - User management (view, suspend, balance, pricing)
  - Order management (view, cancel, refund)
  - Pricing management (global, per-domain)
  - Feature flag management
  - Log query and export
  - System health and stats
```

---

*This document captures every user-facing and system-facing interaction in the Shipping Label Platform. It serves as the definitive reference for implementing each feature and testing every scenario.*
