# EquipSync – Hackathon Judge Demonstration Script & Security Defense Runbook

**Target Audience:** Hackathon Judges, Enterprise Evaluators & Technical Reviewers  
**Target Runtime:** 6 to 8 Minutes  
**Primary Demo Organization:** Vivekananda Institute of Professional Studies (VIPS)  
**Secondary Demo Organization:** Delhi Institute of Engineering & Technology (DIET)  

> ⚠️ **DISCLAIMER & INTEGRITY NOTICE:**  
> "Vivekananda Institute of Professional Studies (VIPS)" and "Delhi Institute of Engineering & Technology (DIET)" are simulated demonstration tenants created strictly for this hackathon evaluation. No affiliation, endorsement, sponsorship, or institutional relationship is claimed. All accounts, borrower identities, supervisor names (e.g., "Demo Supervisor"), and telemetry records are synthetic demo fixtures containing zero real personal data.

---

## 1. Pre-Demo Verification Checklist

Complete this checklist 15 minutes before presenting to the judges:

- [ ] **Dual Browser Profiles / Windows Ready:**
  - **Window A (Primary - VIPS):** Profile 1 (VIPS Admin: `[FILL_VIPS_ADMIN_EMAIL]`) and Profile 2 (VIPS Member: `[FILL_VIPS_MEMBER_EMAIL]`).
  - **Window B (Secondary - DIET):** Profile 3 (DIET Admin: `[FILL_DIET_ADMIN_EMAIL]`) and Profile 4 (DIET Member: `[FILL_DIET_MEMBER_EMAIL]`).
- [ ] **Fresh Active Booking:** Ensure at least one approved booking for VIPS exists whose start window is within the handover threshold (starts within 15 minutes or active now). If needed, generate with `node scripts/demo-seed.mjs --refresh-slots`.
- [ ] **Pending Booking Ready:** At least one booking in `pending` status for the approval lock demonstration.
- [ ] **Browser DevTools Open:** Keep Network and Console tabs docked on the right side of the borrower window to showcase real HTTP 400 `booking_pending_approval` exception codes.
- [ ] **Local Artifacts at Hand:** `docs/RLS_MATRIX.md` open in a tab, and `supabase/tests/rls_isolation_test.sql` ready to show.

---

## 2. Minute-by-Minute Demonstration Script (6 to 8 Minutes)

```
0:00 ─── 1:45  Step 1: Enterprise Onboarding & Name Integrity
1:45 ─── 3:15  Step 2: The Approval Lock & Defensive State Machine
3:15 ─── 4:45  Step 3: Administrative Request Queue & Hardened Approval
4:45 ─── 6:30  Step 4: The Walled Garden Proof (Cross-Tenant Isolation)
6:30 ─── 7:30  Step 5: Cryptographic Chain of Custody & Handover
7:30 ─── 8:00  Judge Q&A & Architecture Wrap-Up
```

---

### Step 1: Enterprise Onboarding & Name Integrity (0:00 – 1:45)

**Objective:** Demonstrate B2B registration validation, live name availability check, and the website-domain trust alignment badge.

1. **Exact Clicks:**
   - Navigate to `/register` in an incognito window.
   - Click the **"Organization Admin"** tab.
   - In Step 1 (Organization), type `Vivekananda Institute of Professional Studies` into the Organization Name field.
   - Observe the live badge: `Name already registered` (or red duplicate warning).
   - Change the name to a unique test name: `VIPS Advanced Robotics Lab`. Observe the live green badge: `✓ Name available`.
   - Select Organization Type: `University`.
   - Enter Official Website URL: `https://vips.edu`.
   - Enter Contact Phone: `+91 11 2734 3401`.
   - Click **"Continue to Administrator Details"**.
   - In Step 2 (Administrator), type Full Name: `Alex Rivera (Demo Admin)`, Title: `Director of Research Labs`.
   - Enter Email: `director@vips.edu`.
   - Point out the **Live Domain Alignment Hint**:
     > *"Your email matches your website. After you confirm your email your organization gets a Verified domain badge."*
   - Change email to `director@gmail.com`. Point out the adaptive warning:
     > *"Use an email on your organization's domain to earn the Verified domain badge. You can continue without it."*
   - Change back to `director@vips.edu`, enter a compliant password, and click **"Review & Confirm"**.
   - Show the summary card with edit shortcuts, and explain the OTP email activation gate.

* **What to Say:**
  > *"EquipSync is built specifically for institutional trust. When an enterprise signs up, our database enforces strict name uniqueness and validates that official domains align with website hosts. If the admin's email domain matches the institutional web host, the platform automatically grants a Verified Domain badge upon email confirmation. Unconfirmed organizations are strictly isolated and invisible to member search."*

* **Fallback:**
  - If network lag delays name check, explain that `organization_name_available` is a lightweight, rate-limit friendly RPC executing directly on PostgreSQL with an immutable regex normalization index.

---

### Step 2: The Approval Lock & Defensive State Machine (1:45 – 3:15)

**Objective:** Prove that client-side controls are strictly enforced at the database level. An unapproved booking CANNOT be checked out, and QR scanning is locked out.

1. **Exact Clicks:**
   - Switch to Window A (logged in as VIPS Member).
   - Navigate to `/app/bookings`.
   - Locate the reservation for the **"High-Precision Laser Cutter"** in `Pending admin check` status.
   - Click **"View Custody Details"** (`/app/bookings/<id>`).
   - Observe the prominent amber banner:
     > **Waiting for Administrator Approval**  
     > *"Waiting for admin approval. You can check out once your request is approved."*
   - Show that the 4-step interactive checkout flow and camera scanner are **completely hidden/unrendered**.
   - Open Browser DevTools Console.
   - Paste the deep-link checkout test snippet or trigger the RPC directly:
     ```javascript
     await supabase.rpc('check_out_booking', {
       p_booking_id: '<pending_id>',
       p_photos: [],
       p_condition: 'good',
       p_notes: '',
       p_accessory_checks: [],
       p_qr_identifier: 'EQS-TEST'
     });
     ```
   - Show the returned exception in console:
     `PostgresError: booking_pending_approval`.

* **What to Say:**
  > *"In EquipSync, UI disabled buttons are not security boundaries. Even if an attacker manipulates the DOM or issues raw API calls via Postman, our PostgreSQL function `check_out_booking` executes `FOR UPDATE` and raises a machine code `booking_pending_approval`. The hardware locker or custodian camera scanner will refuse handover until an authorized administrator signs off."*

* **Fallback:**
  - If DevTools is awkward to display, direct judges to the Alert banner rendered on `/app/bookings/<id>` and show the same locked state when scanning the physical asset tag in the Chain of Custody hub.

---

### Step 3: Administrative Request Queue & Hardened Approval (3:15 – 4:45)

**Objective:** Demonstrate the admin approval pipeline, overlap conflict warning, decision notes, and waitlist revocation.

1. **Exact Clicks:**
   - Switch to VIPS Admin window.
   - In the sidebar, point to **"Request queue"** showing the pending badge count.
   - Navigate to `/app/institution/requests`.
   - Show the three tabs: **Pending Check**, **Approved Upcoming**, and **History**.
   - Show the Overlap Warning chip on conflicting requests:
     > *"Overlap Warning: This time slot conflicts with an existing approved booking."*
   - Click a pending request row. A detail inspection Sheet opens on the right.
   - Review the borrower's past equipment history and stated purpose.
   - Click **"Approve Reservation"**.
   - Enter an optional decision note: `Approved. Please wear safety goggles and sign the physical logbook.`
   - Click **"Confirm Approval"**.
   - Switch back to the Member window and refresh:
     - The reservation immediately transitions to **"Approved"**.
     - The `BookingLifecycle` stepper lights up step 3 ("Approved") with the exact admin timestamp and note: *"Approved. Please wear safety goggles and sign the physical logbook."*

* **What to Say:**
  > *"When an admin reviews requests, our database automatically checks for double-booking collisions using GiST range constraints and concurrency locks. The administrator can approve with tailored safety instructions, which are delivered immediately via real-time notifications and permanently recorded in the immutable audit log."*

* **Fallback:**
  - If real-time websocket latency occurs, click the manual Refresh button on the member page; state changes are instantly reflected from the database.

---

### Step 4: The Walled Garden Proof (Cross-Tenant Isolation) (4:45 – 6:30)

**Objective:** Prove strict multi-tenancy. A user from Organization B cannot view or access ANY data belonging to Organization A.

1. **Exact Clicks:**
   - Copy the Resource ID or Booking ID from VIPS (`Organization A`).
     Example: `https://equipsync.app/app/bookings/bk-vips-1234`
   - Switch to Window B (logged in as DIET Member or DIET Admin).
   - Paste the VIPS URL into the DIET browser window.
   - Press Enter.
   - Observe the immediate fallback:
     > **Reservation Not Found**  
     > *"This reservation could not be found or you do not have permission to view its custody record."*
   - Open Network tab: show the HTTP 200 response returning `data: []` (zero rows) or HTTP 403 `forbidden`.
   - Open `/app/discover` in DIET:
     - Show that the equipment catalog contains ONLY DIET's resources. Not a single VIPS laser cutter, cleanroom pass, or microscope appears.
   - Open `docs/RLS_MATRIX.md` or display the output of `supabase/tests/rls_isolation_test.sql`:
     - Show that every SELECT, INSERT, UPDATE, DELETE policy across 17 public tables strictly mandates `institution_id = current_institution_id()`.

* **What to Say:**
  > *"EquipSync operates as a true walled garden. Discovery, bookings, audit records, and custody photos are partitioned at the database layer using Postgres Row Level Security. Even if a user discovers another institution's UUID, the database evaluates `current_institution_id()` from the caller's JWT and returns zero rows. Cross-tenant leakage is mathematically impossible under this policy model."*

* **Fallback:**
  - Show the unit test file `supabase/tests/rls_isolation_test.sql` in VS Code where automated assertions test cross-tenant access and assert 0 rows across all tables.

---

### Step 5: Cryptographic Chain of Custody & Handover (6:30 – 7:30)

**Objective:** Showcase multi-angle photo proof, client-side SHA-256 verification, and prior return privacy protection.

1. **Exact Clicks:**
   - In the approved VIPS booking, demonstrate the check-out handover flow.
   - Show the 4 required photo slots: `front`, `back`, `left`, `right`.
   - Point out that every uploaded photo calculates a browser-side SHA-256 cryptographic hash before upload.
   - Navigate to `/app/custody` (Chain of Custody Hub).
   - Show the Asset Chains view:
     - 5-point condition rating meter (Good, Minor wear, Damaged, Non-functional).
     - Prior return photo inspection: note that borrower identity from previous loans is redacted for privacy, while equipment condition proof is preserved.

* **What to Say:**
  > *"Every equipment handover is cryptographically sealed with multi-angle photo proofs and tamper-evident SHA-256 hashes. Future borrowers can verify prior return condition without compromising previous students' privacy."*

---

## 3. What Could Go Wrong & Mitigation Table

| Potential Demo Glitch | Immediate Fallback Action | Technical Explanation for Judges |
| :--- | :--- | :--- |
| **Email confirmation takes too long / SMTP throttling** | Use pre-seeded verified accounts (`[FILL_VIPS_ADMIN_EMAIL]`). | The demo script provides pre-confirmed accounts with valid sessions to bypass public SMTP delivery delays. |
| **Camera permission blocked in browser** | Use the manual physical Asset Tag input fallback in the QR dialog. | EquipSync supports both live camera streams and high-speed industrial barcode/tag keyboard wedge input. |
| **Active booking window has elapsed** | Run `node scripts/demo-seed.mjs --refresh-slots` in terminal (takes 3s). | Generates a fresh approved booking starting 5 minutes in the future. |
| **Websocket realtime notification delayed** | Manually refresh the member page. | Postgres RLS queries always fetch ground-truth database state on page load. |
| **Judge asks to test raw API attack** | Offer to run queries in Supabase SQL editor or browser console. | Every authorization rule is defined inside `SECURITY DEFINER` RPCs and RLS policies, not in React. |

---

## 4. Judge Q&A Cheat Sheet

### Q1: How do you prevent borrower impersonation during handover?
> **Answer:** *"EquipSync uses a three-factor verification gate: (1) An active authenticated session verified by the institutional JWT; (2) Physical presence verification by scanning the unique equipment asset QR tag; and (3) A dynamic one-time handover passcode matched by the custodian locker desk."*

### Q2: What prevents double-booking if two users submit simultaneously?
> **Answer:** *"PostgreSQL native GiST exclusion constraints with `tstzrange(start_at, end_at, '[)')` combined with row-level `FOR UPDATE` pessimistic locking in the `decide_booking` and `request_booking` RPCs. It is impossible for overlapping approved bookings to be saved to disk, even under high concurrency."*

### Q3: Who can see what in the custody timeline?
> **Answer:** *"The institution administrator has full unredacted audit access across all equipment and incident reports. Active borrowers can only see their own active loan details and the prior return photo of that specific asset to verify incoming condition. Personal borrower identities, supervisor names, and private notes from previous loans are strictly redacted by the `get_custody_chain` RPC."*

### Q4: What is automated versus human in the onboarding pipeline?
> **Answer:** *"Domain verification and name uniqueness checks are fully automated: if an administrator registers with an email matching their institution's web domain, domain proof is verified upon email confirmation. Member verification is automated when registering with an allowed domain, while non-domain or external affiliate accounts enter the administrator's review queue for manual vetting."*
