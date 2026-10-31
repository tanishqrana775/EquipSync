# EquipSync Tenant Isolation & Row Level Security (RLS) Matrix

**Document Classification:** Security Architecture & Enforcement Contract  
**Database:** PostgreSQL 15 on Supabase  
**Tenant Enforcement Paradigm:** Strict Multi-Tenant Row-Level Security (`current_institution_id()`) + Role Authorization (`(select auth.uid())` / `is_institution_admin()`).  
**Last Updated:** Migration `0013_enterprise_b2b_workflow.sql`.

---

## 1. Executive Summary & Security Model

EquipSync implements defense-in-depth tenant isolation across all tables, views, and storage buckets:
1. **Zero Client Direct Writes on Critical State:** Tables controlling core workflow state (`bookings`, `waitlist_entries`, `released_slots`, `custody_events`, `custody_photos`, `asset_audits`, `incidents`, `audit_log`) have `INSERT`, `UPDATE`, and `DELETE` revoked from `anon` and `authenticated`. All state transitions execute exclusively through hardened `SECURITY DEFINER` RPCs with `search_path = ''`.
2. **Defensive Tenant Predicates:** Every client-readable row is scoped by `institution_id = public.current_institution_id()` in addition to user-role checks. Cross-tenant reads return zero rows.
3. **Defensive Trigger-Free Guarantee:** Every client-writable table (`resources`, `qualifications`, `user_qualifications`, `resource_categories`, `eligibility_rules`, `resource_accessories`, `resource_availability_windows`, `resource_evidence`) enforces `WITH CHECK (institution_id = public.current_institution_id() AND public.is_institution_admin(institution_id))`.

---

## 2. Table-by-Table RLS Matrix

| Table | Role | Operation | Permitted? | Predicate / Condition |
| :--- | :--- | :---: | :---: | :--- |
| **`institutions`** | `anon` | SELECT | ❌ | No policy (DENIED) |
| | `member` | SELECT | ✅ | `id = current_institution_id() AND status = 'active'` |
| | `admin` | SELECT | ✅ | `id = current_institution_id() OR is_institution_admin(id)` |
| | `authenticated` | INSERT | ❌ | REVOKED from client; handled via `handle_new_user` trigger |
| | `admin` | UPDATE | ✅ | `id = current_institution_id() AND is_institution_admin(id)` |
| | `authenticated` | DELETE | ❌ | REVOKED from client |
| **`profiles`** | `anon` | ALL | ❌ | No policy (DENIED) |
| | `member` | SELECT | ✅ | `id = auth.uid() AND (institution_id = current_institution_id() OR institution_id IS NULL)` |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| | `member` / `admin` | UPDATE | ✅ | `id = auth.uid()` (columns restricted to `full_name`, `avatar_url`, `job_title`) |
| | `authenticated` | INSERT / DELETE | ❌ | Handled via auth triggers; client write revoked |
| **`resources`** | `anon` | ALL | ❌ | No policy (DENIED) |
| | `member` | SELECT | ✅ | `institution_id = current_institution_id()` |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id()` |
| | `admin` | INSERT | ✅ | `WITH CHECK (institution_id = current_institution_id() AND is_institution_admin(institution_id))` |
| | `admin` | UPDATE | ✅ | `USING / WITH CHECK (institution_id = current_institution_id() AND is_institution_admin(institution_id))` |
| | `admin` | DELETE | ✅ | `USING (institution_id = current_institution_id() AND is_institution_admin(institution_id))` |
| **`resource_categories`** | `member` | SELECT | ✅ | `institution_id = current_institution_id()` |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id()` |
| | `admin` | INSERT | ✅ | `WITH CHECK (institution_id = current_institution_id() AND is_institution_admin(institution_id))` |
| | `admin` | DELETE | ✅ | `USING (institution_id = current_institution_id() AND is_institution_admin(institution_id))` |
| **`qualifications`** | `member` | SELECT | ✅ | `institution_id = current_institution_id()` |
| | `admin` | ALL | ✅ | `institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| **`user_qualifications`**| `member` | SELECT | ✅ | `user_id = auth.uid() AND qualification's institution_id = current_institution_id()` |
| | `admin` | SELECT | ✅ | `qualification's institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| | `member` | INSERT | ✅ | `user_id = auth.uid() AND status = 'pending' AND qualification in current_institution_id()` |
| | `authenticated` | UPDATE / DELETE | ❌ | Verification managed exclusively via `verify_qualification` RPC |
| **`eligibility_rules`** | `member` | SELECT | ✅ | Resource belongs to `current_institution_id()` |
| | `admin` | ALL | ✅ | Resource belongs to `current_institution_id()` AND `is_institution_admin(r.institution_id)` |
| **`resource_accessories`**| `member`| SELECT | ✅ | Resource belongs to `current_institution_id()` |
| | `admin` | ALL | ✅ | Resource belongs to `current_institution_id()` AND `is_institution_admin(r.institution_id)` |
| **`resource_availability_windows`** | `member` | SELECT | ✅ | Resource belongs to `current_institution_id()` |
| | `admin` | ALL | ✅ | Resource belongs to `current_institution_id()` AND `is_institution_admin(r.institution_id)` |
| **`resource_evidence`** | `member` | ALL | ❌ | Hidden from member (DENIED) |
| | `admin` | ALL | ✅ | Resource belongs to `current_institution_id()` AND `is_institution_admin(r.institution_id)` |
| **`bookings`** | `anon` | ALL | ❌ | No policy (DENIED) |
| | `member` | SELECT | ✅ | `user_id = auth.uid() AND institution_id = current_institution_id()` |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Managed via `request_booking`, `decide_booking`, `cancel_booking`, `admin_cancel_booking` |
| **`waitlist_entries`** | `member` | SELECT | ✅ | `user_id = auth.uid() AND resource in current_institution_id()` |
| | `admin` | SELECT | ✅ | Resource in `current_institution_id()` AND `is_institution_admin(resource)` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Managed via `join_waitlist`, `leave_waitlist` |
| **`released_slots`** | `member` | SELECT | ✅ | `(released_by = auth.uid() OR claimed_by = auth.uid())` OR `(status = 'open' AND is_verified_member() AND institution_id = current_institution_id())` |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Managed via `release_booking`, `claim_released_slot`, `admin_cancel_booking` |
| **`custody_events`** | `member` | SELECT | ✅ | `is_booking_participant(booking_id)` AND booking belongs to `current_institution_id()` |
| | `admin` | SELECT | ✅ | Booking belongs to `current_institution_id()` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Immutable audit log written only via checkout/checkin/audit RPCs |
| **`custody_photos`** | `member` | SELECT | ✅ | `is_booking_participant(booking_id)` AND booking belongs to `current_institution_id()` |
| | `admin` | SELECT | ✅ | Booking belongs to `current_institution_id()` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Written via checkout/checkin RPCs |
| **`asset_audits`** | `member` | ALL | ❌ | No policy (DENIED) |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Written via `record_asset_audit` RPC; immutable trigger blocks client mutation |
| **`incidents`** | `member` | SELECT | ✅ | `institution_id = current_institution_id() AND (reported_by = auth.uid() OR booking.user_id = auth.uid())` |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Managed via `report_incident`, `resolve_incident` |
| **`notifications`** | `member` / `admin` | SELECT | ✅ | `user_id = auth.uid() AND profile in (current_institution_id() OR NULL)` |
| | `member` / `admin` | UPDATE | ✅ | `user_id = auth.uid()` (only `read_at` column) |
| | `authenticated` | INSERT / DELETE | ❌ | REVOKED from client; written only by definer triggers & RPCs |
| **`audit_log`** | `member` | ALL | ❌ | No policy (DENIED) |
| | `admin` | SELECT | ✅ | `institution_id = current_institution_id() AND is_institution_admin(institution_id)` |
| | `authenticated` | INSERT/UPDATE/DELETE| ❌ | **REVOKED.** Append-only internal ledger |

---

## 3. Storage Buckets RLS Matrix

| Storage Bucket | Role | Operation | Permitted? | Predicate / Condition |
| :--- | :--- | :---: | :---: | :--- |
| **`resource-images`** | `anon` | ALL | ❌ | No policy (DENIED) |
| | `member` | SELECT | ✅ | `folder[1] = current_institution_id()` |
| | `admin` | SELECT | ✅ | `folder[1] = current_institution_id()` |
| | `admin` | INSERT/UPDATE/DELETE| ✅ | `folder[1] = current_institution_id() AND is_institution_admin(folder[1])` |
| **`custody-photos`** | `member` | SELECT | ✅ | `folder[1] = current_institution_id() AND (participant(booking) OR can_read_prior_return_photo())` |
| | `admin` | SELECT | ✅ | `folder[1] = current_institution_id() AND is_institution_admin(folder[1])` |
| | `member` | INSERT | ✅ | `folder[1] = current_institution_id() AND booking.user_id = auth.uid() AND status IN ('approved', 'checked_out')` |
| | `authenticated` | UPDATE / DELETE | ❌ | **NO POLICY (DENIED).** Immutable evidence photos cannot be overwritten or deleted. |
| **`asset-audit-photos`** | `member` | ALL | ❌ | No policy (DENIED) |
| | `admin` | SELECT | ✅ | `folder[1] = current_institution_id() AND is_institution_admin(folder[1])` |
| | `admin` | INSERT | ✅ | `folder[1] = current_institution_id() AND is_institution_admin(folder[1])` |
| | `authenticated` | UPDATE / DELETE | ❌ | **NO POLICY (DENIED).** Immutable audit photos cannot be overwritten or deleted. |
| **`resource-evidence`** | `member` | ALL | ❌ | No policy (DENIED) |
| | `admin` | ALL | ✅ | `folder[1] = current_institution_id() AND is_institution_admin(folder[1])` |
| **`qualification-docs`** | `member` | SELECT / INSERT | ✅ | `folder[1] = current_institution_id() AND folder[2] = auth.uid()` |
| | `admin` | SELECT | ✅ | `folder[1] = current_institution_id() AND is_institution_admin(folder[1])` |

---

## 4. Public API & RPC Exposure Summary

| Endpoint / RPC | Role Allowed | Returned Data Scope |
| :--- | :--- | :--- |
| `search_institutions(p_query)` | `anon`, `authenticated` | Only `id`, `name`, `type`, `domain_proof` for `status = 'active'` |
| `organization_name_available(p_name)` | `anon`, `authenticated` | Single `boolean` flag; zero tenant data exposed |
| `match_organization_by_email(p_email)` | `anon`, `authenticated` | Only `id`, `name` if exactly one unambiguous active match |
| `get_public_stats()` | `anon`, `authenticated` | Aggregated count figures only |
| All other RPCs | `authenticated` only | Scoped strictly to caller's `current_institution_id()` |
