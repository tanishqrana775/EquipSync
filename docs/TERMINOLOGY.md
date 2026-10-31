# EquipSync Terminology Architecture & Identifier Audit

This document records the normalization of user-visible terminology to **"Organization"** (American English) and documents every remaining intentional `institution` identifier preserved across backend schemas, APIs, and routing contracts.

---

## 1. User-Visible Terminology Policy

All user-facing copy across the platform uses American spelling:
- **"Organization"** (replaces legacy "institution", "institution(s)", and British "organisation").
- **"Recognized"** (replaces "recognised").
- **"Anonymized"** (replaces "anonymised").
- **"Catalog"** / **"Catalogued"** (normalized across inventory).

The primary verification toast reads:
> `"Your account is pending verification by your organization's admin."`

---

## 2. Intentional Remaining `institution` Identifiers

In accordance with architectural stability and contract preservation rules, internal symbols, database entities, storage paths, and programmatic APIs deliberately retain `institution` to prevent regressions:

| Category | Identifier / Symbol | Context & Rationale |
| :--- | :--- | :--- |
| **Database Table** | `public.institutions` | Core multi-tenant organization entity table created in Migration 0001. |
| **Foreign Keys** | `institution_id` | Foreign key column present on `profiles`, `resources`, `bookings`, `released_slots`, `custody_events`, `incidents`, `qualifications`, `resource_categories`, `asset_audits`, and `audit_log`. |
| **Postgres Enum** | `user_role ('institution_admin', 'member')` | Core role enum value for tenant administrators. |
| **RLS Helper RPC** | `public.current_institution_id()` | `SECURITY DEFINER` stable helper returning caller's tenant UUID. |
| **RLS Helper RPC** | `public.is_institution_admin(inst uuid)` | `SECURITY DEFINER` stable helper verifying administrator privilege for a tenant. |
| **Directory RPC** | `public.search_institutions(p_query text)` | `SECURITY DEFINER` directory query called by autocomplete component. |
| **Metrics RPC** | `public.institution_stats(p_institution_id uuid)` | Administrative KPI aggregation RPC. |
| **Storage Paths** | `<institution_id>/...` | Tenant-scoped top-level directory prefix across `custody-photos`, `resource-images`, `resource-evidence`, and `asset-audit-photos`. |
| **Frontend Routes** | `/app/institution/*` | Route hierarchy for tenant administrative workspace (`/app/institution`, `/app/institution/resources`, `/app/institution/disputes`, `/app/institution/settings`). |
| **Frontend Hook** | `useInstitutionStats()` | TanStack Query administrative hook loading metrics and audit logs. |
| **Frontend Role Type** | `UserRole = 'institution' \| 'user'` | Internal client state differentiator mapping `institution_admin` to `'institution'`. |
| **Exception Code** | `'invalid_institution'` | Machine error code returned during user signup when tenant UUID does not exist. |

---

## 3. SQL Notification & Error Message Updates

User-facing exception and notification strings previously mentioning "institution" have been updated via Migration `0011_domain_verification.sql` to reference "organization":
- `request_booking` notification: `"A new booking request was submitted for your organization."`
- `apply_domain_verification` notification: `"You've been verified automatically for <organization> through your <domain> email address."`
