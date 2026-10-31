FORMATTING NOTE FOR THE TEAMMATE: When copying any text from this file back into the master Word document (EquipSync_Final_Report.docx), format it in Times New Roman (select the pasted text and set the font to Times New Roman; keep the document's existing font size, line spacing and heading styles). Paste using "Keep Text Only" so no formatting is carried over. Never delete or replace the existing screenshots. Do not paste images from this file; replace the diagrams with Word's Change Picture, as described in the Figure replacement map.

## How to Use This Document
1. Follow the checklist items in Section 2 to replace stale paragraphs and sections in the master Word document.
2. Replace stale tables using the pre-formatted tab-separated blocks in Section 3 via Word's Convert Text to Table command.
3. Update architecture and database diagrams using the file mappings and aspect ratio guidance in Section 4 without disturbing existing screenshots.

### Legend
- [ ] Unapplied update block. Check the box once copied into EquipSync_Final_Report.docx.
- [x] Applied update block.

---

## 1. Global Terminology Normalization

To ensure complete alignment with the EquipSync product UI and database contracts, perform the following targeted case-sensitive replacements across the master document.

CRITICAL WARNING: Do NOT use "Replace All" across the entire document. The verbatim hackathon problem statement in Section 1 and historical transformation notes intentionally retain the word "institutions". Review each occurrence in Sections 1 and 3 before accepting replacements.

Targeted Find and Replace Mapping (Match Case enabled):
1. Find: "Institution" -> Replace: "Organization"
2. Find: "institution" -> Replace: "organization"
3. Find: "Institutions" -> Replace: "Organizations"
4. Find: "institutions" -> Replace: "organizations"
5. Find: "Organisation" -> Replace: "Organization"
6. Find: "organisation" -> Replace: "organization"
7. Find: "Organisations" -> Replace: "Organizations"
8. Find: "organisations" -> Replace: "organizations"
9. Find: "institution_admin" -> Keep unchanged (this is the immutable PostgreSQL enum identifier).
10. Find: "current_institution_id()" -> Keep unchanged (this is the immutable PostgreSQL security helper).
11. Find: "institution_id" -> Keep unchanged (this is the immutable foreign key column).

---

## 2. Section-by-Section Replacement Blocks

### Section 4: The Proposed Solution (EquipSync)

#### Update Block 1: Pillar 3 and Crown Jewel Architecture
- [ ] Check when applied to master Word document.
Locate: Section 4.1 "The Three Core Pillars of EquipSync", paragraph starting with "Pillar 3 (The Crown Jewel): Cryptographic Chain of Custody & Accountability"
Action: REPLACE
--- BEGIN TEXT ---
Pillar 3 (The Crown Jewel): Cryptographic Chain of Custody & Accountability - Elevates equipment borrowing from an informal handover to a legally defensible, cryptographically verifiable transaction. By coupling physical QR tag verification, client-side SHA-256 photo hashing, immutable write-once storage, spot audits, and automated quality gates, EquipSync establishes an unbroken, tamper-evident audit trail for every asset from sign-out to return.
--- END TEXT ---

#### Update Block 2: Chain of Custody Callout Box
- [ ] Check when applied to master Word document.
Locate: Section 4.1 "The Three Core Pillars of EquipSync", callout box starting with "THE CROWN JEWEL: Under EquipSync, an equipment loan is no longer an act of blind faith."
Action: REPLACE
--- BEGIN TEXT ---
THE CROWN JEWEL: Under EquipSync, an equipment loan is no longer an act of blind faith. It is an immutable, multi-party cryptographic contract. The exact physical unit is verified via QR; its multi-angle visual state is hashed before upload; its accessories are individually audited; and any degradation is algorithmically computed and flagged for administrative inspection. With the addition of the Chain of Custody Hub, independent spot audits can be recorded between reservations, and borrowers can view the previous user's redacted return condition to eliminate false liability claims. Neither the borrower nor the administrator can alter past records, providing complete peace of mind for high-value resource sharing.
--- END TEXT ---

---

### Section 5: The Complete Product Workflow

#### Update Block 3: Ten-Stage Operational Workflow Table Updates
- [ ] Check when applied to master Word document.
Locate: Section 5.1 "Ten-Stage Operational Workflow", Table 6 entries for Stage 1, Stage 2, Stage 4, Stage 5, and Stage 7
Action: REPLACE
--- BEGIN TEXT ---
Stage 1: Register & Onboard. Enterprise organization registers with validated website, contact phone, and official domain proof; admin activates tenant via email OTP; members auto-verify through allowed email domains or enter the manual review queue. Enforced by Register.tsx, handle_new_user trigger, and apply_domain_verification trigger.

Stage 2: Discover. Verified member browses the walled-garden catalog strictly within their tenant; searches by keyword, category, and availability; reviews prerequisite rules. Enforced by Discover.tsx and RLS policy resources_select_authenticated scoped to current_institution_id().

Stage 4: Booking Request. Member submits UTC booking interval and project purpose; resources marked requires_approval=false approve instantly, while governed resources enter pending status with the approval lock engaged. Enforced by request_booking RPC.

Stage 5: Admin Triage & Approval Lock. For governed assets, organization admins review pending requests in a dedicated request queue with conflict warnings and row-level locking; check-out is strictly blocked until approval is granted. Enforced by decide_booking RPC with exclusive row locking.

Stage 7: QR Check-Out with Approval Gate. Handover window opens 15 minutes before booking; system verifies booking is approved and raises booking_pending_approval if locked; borrower scans physical asset QR code to prove in-person presence. Enforced by verify_asset_qr and check_out_booking RPCs.
--- END TEXT ---

---

### Section 6: Features Developed During the Hackathon (The 48-Hour Build)

#### Update Block 4: Feature Group 1 - Smart Reservations & Approval Lock
- [ ] Check when applied to master Word document.
Locate: Section 6.2 "Feature Group 1: Smart Reservations & Mathematical Conflict Prevention", after the exclusion constraint code block
Action: INSERT AFTER
--- BEGIN TEXT ---
Hardened Administrative Approval Pipeline: While ordinary systems treat booking approval as a cosmetic status flag, EquipSync enforces a defensive approval lock across both the database engine and the client application. When a reservation request is submitted for a governed resource, it enters pending status. Any attempt by the borrower or hardware kiosk to trigger verify_asset_qr, start_checkout, or check_out_booking immediately raises a PostgreSQL exception with machine code booking_pending_approval, locking out the camera scanner and interactive handover stepper. In the administrative workspace, the dedicated request queue at /app/institution/requests groups submissions into Pending Check, Approved Upcoming, and History. When an administrator inspects a request, decide_booking executes an exclusive SELECT FOR UPDATE row lock to eliminate administrative race conditions, re-evaluates the GiST temporal overlap constraint, records mandatory decision notes, and commits the state transition atomically. Furthermore, administrators can invoke admin_cancel_booking with a recorded justification to revoke reservations and automatically return capacity to the peer waitlist.
--- END TEXT ---

#### Update Block 5: Feature Group 2 - Chain of Custody Hub & Spot Audits
- [ ] Check when applied to master Word document.
Locate: Section 6.3 "Feature Group 2: Cryptographic Handovers & Chain of Custody", after the Integrity Re-Check Capability paragraph
Action: INSERT AFTER
--- BEGIN TEXT ---
Chain of Custody Hub and Spot Audits: EquipSync broadens custodial accountability beyond standard check-out and return handovers through the Chain of Custody Hub at /app/custody. Built upon the asset_audits table and private asset-audit-photos storage bucket introduced in Migration 0012, authorized custodians can conduct unannounced spot audits on equipment at any time using record_asset_audit. The custodian scans the physical asset QR code, records a 5-tier condition rating, completes the accessory checklist, and captures SHA-256 hashed photographic evidence. The audit record is permanently bound to the asset and protected by the trg_block_asset_audits_mutation trigger, which strictly forbids updates or deletions. In addition, the get_custody_chain RPC provides a complete chronological timeline of every loan, inspection, and spot audit. To protect member privacy while maintaining absolute trust, the timeline implements granular redaction rules: organization administrators see all loan records, borrowers see their own bookings in full, and members inspecting an asset before check-out can view only the return condition and photos of the immediately preceding loan, ensuring pre-existing defects are transparent without revealing previous borrowers' identities.
--- END TEXT ---

#### Update Block 6: Feature Group 4 - B2B Onboarding, Name Integrity & Domain Proof
- [ ] Check when applied to master Word document.
Locate: Section 6.5 "Feature Group 4: Multi-Tenant Organisation Management & Oversight", paragraph beginning with "• Member Verification Queue:"
Action: REPLACE
--- BEGIN TEXT ---
Enterprise Organization Onboarding & Name Integrity: Organization onboarding is governed by a multi-step B2B registration pipeline. When a new administrator registers at /register, the organization_name_available RPC executes a real-time availability check backed by a PostgreSQL unique partial index on normalized active names. This prevents spoofed or duplicate organizations from registering. The administrator provides an official website URL, contact phone, organization type, job title, and optional registration identifier. The handle_new_user trigger validates all inputs, strips control characters, normalizes URLs to secure HTTPS protocols, and initializes the organization in pending_email status. If the administrator's email domain aligns with the verified institutional website host, the organization is automatically awarded the Verified Domain trust badge upon email confirmation. Unconfirmed organizations are strictly isolated and hidden from public search until verified.

Dual-Track Member Verification & Domain Matching: Members affiliate with their organization through a frictionless dual-track verification model. Organizations configure allowed_domains using exact hostnames (e.g. vips.edu) or subdomains (e.g. *.vips.edu), with public commercial email providers strictly prohibited. When a member confirms their account via email OTP, the apply_domain_verification trigger evaluates the user's email domain against the organization's allowed list. If a match is found, the member is instantly auto-verified with verification_method set to domain. Users registering with non-matching or external email addresses remain in pending status with verification_method set to null, entering the administrator's verification queue for manual vetting via verify_member. This architecture guarantees immediate access for verified campus researchers while maintaining strict gatekeeping against unauthorized access.
--- END TEXT ---

---

### Section 7: Technology Stack and System Architecture

#### Update Block 7: Zero-Trust Engineering Rationale & Walled Garden
- [ ] Check when applied to master Word document.
Locate: Section 7.4 "Zero-Trust Engineering Rationale: Why Direct Writes Were Revoked", after the numbered defense-in-depth principles
Action: INSERT AFTER
--- BEGIN TEXT ---
Walled Garden Tenant Isolation: EquipSync enforces a walled garden security perimeter across all database relations and storage buckets. Under this paradigm, every authenticated query is filtered by the caller's active organization UUID derived securely from their session profile via current_institution_id(). Cross-tenant reads return zero rows, and cross-tenant mutations immediately abort with forbidden exceptions. Furthermore, Migration 0013 tightened RLS predicates across the entire catalog and evidence subsystems: resource evidence is completely hidden from non-admin members, user qualifications require current tenant certification, and storage policies enforce strict top-level folder prefix matching against current_institution_id(). Even if an attacker obtains a valid JWT from Organization A, they cannot view, reserve, or upload evidence for assets belonging to Organization B.
--- END TEXT ---

---

### Section 8: Privacy, Security, and Fairness Considerations

#### Update Block 8: Authentication Security & Email OTP Architecture
- [ ] Check when applied to master Word document.
Locate: Section 8.1 "Multi-Tenant Row Level Security & Storage Scoping", after the first paragraph
Action: INSERT AFTER
--- BEGIN TEXT ---
Email OTP Authentication and Recovery: User identity verification and password recovery are powered by Supabase Auth (GoTrue) configured with custom SMTP email delivery. To eliminate reliance on fragile deep-link redirect schemes, sign-up confirmations and password resets utilize secure 6-digit numeric One-Time Passwords (OTP). Users enter the OTP directly within the application at /verify-email or /forgot-password, which verifies the token via supabase.auth.verifyOtp and establishes an authenticated session. This guarantees uninterrupted onboarding across mobile web views and desktop browsers alike.
--- END TEXT ---

---

### Section 10: Known Limitations

#### Update Block 9: Updated Architectural Limitations
- [ ] Check when applied to master Word document.
Locate: Section 10 "Known Limitations", items 1, 3, 5, and 7
Action: REPLACE
--- BEGIN TEXT ---
1. Strict Intra-Organization Sharing Boundary: Multi-tenancy is strictly enforced under the walled garden security model; resources cannot currently be federated or shared across different organizations without independent user registration within each tenant.

3. In-App Realtime Notification Delivery: Operational alerts regarding booking approvals, waitlist promotions, and flagged returns are delivered exclusively through in-app Realtime feeds and topbar popovers. External SMS and mobile push notifications are not configured in this release.

5. Client-Side Hash Computation with Server Spot Audits: Initial SHA-256 digests are computed in the browser using the Web Crypto API before upload. While write-once storage policies and the administrator Verify Integrity re-check mitigate post-upload tampering, malicious clients could theoretically attempt to forge client-side image buffers prior to upload. This risk is actively mitigated by independent administrator spot audits recorded in the Chain of Custody Hub.

7. Searchable Active Organization Directory: To enable seamless member onboarding, active organization names and domains are queryable at registration via the search_institutions RPC. Organizations pending email confirmation or marked inactive are excluded from search results.
--- END TEXT ---

---

### Section 12: Appendix: Testing Instructions & Team Contributions

#### Update Block 10: Judge Testing Flow Update
- [ ] Check when applied to master Word document.
Locate: Section 12.1 "Judge Testing Flow (Step-by-Step Evaluation Guide)", Step 5 and Step 7
Action: REPLACE
--- BEGIN TEXT ---
Step 5: Member. Request booking for governed equipment (e.g. 5-Axis CNC Mill). Submit interval; request enters pending status with the approval lock engaged. Navigate to booking details at /app/bookings/<id>; observe that interactive check-out and QR scanner are locked out, displaying Waiting for Administrator Approval.

Step 7: Admin & Member. Admin navigates to Request queue (/app/institution/requests), reviews booking purpose and past history, and approves the reservation with a decision note. Member refreshes; booking transitions to Approved. Custody pass activates within the 15-minute handover window, unlocking the camera scanner.
--- END TEXT ---

#### Update Block 11: Demo Credentials Table Notice
- [ ] Check when applied to master Word document.
Locate: Section 12.2 "Pre-Configured Demo Credentials", Table 14
Action: REPLACE
--- BEGIN TEXT ---
DEMO CREDENTIALS AND SYNTHETIC TENANT DISCLAIMER: In accordance with competition guidelines, all demonstration tenants, administrator accounts, and member credentials are synthetic demo fixtures created strictly for hackathon evaluation. The primary simulated tenant is Vivekananda Institute of Professional Studies (VIPS), and the secondary cross-tenant isolation reference is Delhi Institute of Engineering & Technology (DIET). No affiliation, endorsement, or institutional sponsorship is claimed. All supervisor names (e.g. Demo Supervisor) and email addresses are simulated test data containing zero real personal information.

Account Type	Email Address	Password	Assigned Role & Tenant	Active Demo State
Organization Admin	[FILL_VIPS_ADMIN_EMAIL]	[FILL_VIPS_ADMIN_PASSWORD]	Organization Admin (VIPS)	Active fleet, pending request queue, spot audit hub
Verified Member	[FILL_VIPS_MEMBER_EMAIL]	[FILL_VIPS_MEMBER_PASSWORD]	Verified Member (VIPS)	Approved booking ready for check-out; pending lock demo
Cross-Tenant Admin	[FILL_DIET_ADMIN_EMAIL]	[FILL_DIET_ADMIN_PASSWORD]	Organization Admin (DIET)	Independent tenant proving zero cross-tenant catalog bleed
Cross-Tenant Member	[FILL_DIET_MEMBER_EMAIL]	[FILL_DIET_MEMBER_PASSWORD]	Verified Member (DIET)	Walled garden member proving zero cross-tenant read access
--- END TEXT ---

---

## 3. Replacement Tables (Tab-Separated Data Blocks)

When updating tables in Microsoft Word, copy the tab-separated blocks below, paste into Word using "Keep Text Only", select the pasted text, and click Table -> Convert -> Convert Text to Table (Separate text at: Tabs).

### Table 7: Build at a Glance: Codebase Engineering Metrics (Section 6.1)

Project Dimension / Artefact	Verified Value	Technical Significance & Repository Location
Database Migrations	13 sequential migrations	Located in supabase/migrations/ (0001_schema through 0013_enterprise_b2b_workflow); fully idempotent SQL DDL/DML.
Database Tables & Views	20 tables, 2 views	20 relational tables including asset_audits, resource_categories, resource_evidence, plus analytics views.
Security Definer RPC Functions	61 SECURITY DEFINER functions	Zero direct client table writes; state changes execute via vetted functions with search_path = ''.
Row Level Security (RLS) Policies	139 active policies	Walled garden multi-tenant isolation enforced at database engine level via public.current_institution_id().
Application Pages & Routes	14 pages, 19 route declarations	React SPA pages including ChainOfCustody, BookingRequests, OrganizationSettings, and BookingCustody.
Modular React Components	63 components	Tailwind CSS + Radix UI primitives, GlassCard containers, QR scanner, and interactive custody steppers.
Total Lines of Source Code (LOC)	42,600 LOC	Breakdown: 17,028 TSX, 7,662 TS, 9,600 SQL, 2,569 MJS test script.
Automated Test Coverage	84 automated test assertions (49 smoke-test, 35 Playwright E2E)	Multi-actor zero-trust API smoke suite (scripts/smoke-test.mjs) + 4 Playwright E2E test specs (e2e/).
Git Commit History	10 commits across 3 active hackathon days	Active sprint: 2026-10-30 to 2026-11-01 on branch main.

---

### Table 9: Granular Role-by-Capability RBAC Permission Matrix (Section 8.2)

Platform Capability / Operation	Anonymous (anon)	Unverified Member	Domain-Verified Member	Admin-Verified Member	Organization Admin
View Public Landing & Directory	ALLOW (Aggregates)	ALLOW	ALLOW	ALLOW	ALLOW
Check Org Name Availability	ALLOW (RPC)	ALLOW	ALLOW	ALLOW	ALLOW
Browse Walled Garden Catalog	DENY (0 rows)	ALLOW (Tenant)	ALLOW (Tenant)	ALLOW (Tenant)	ALLOW (Tenant)
Submit Booking Request	DENY (401)	DENY (not_verified)	ALLOW (request_booking)	ALLOW (request_booking)	ALLOW
Join Waitlist & Peer Slot Claim	DENY (401)	DENY (not_verified)	ALLOW	ALLOW	ALLOW
Perform QR Check-Out Handover	DENY (401)	DENY	ALLOW (If Approved)	ALLOW (If Approved)	ALLOW (If Approved)
View Chain of Custody Timeline	DENY (401)	DENY (forbidden)	ALLOW (Redacted)	ALLOW (Redacted)	ALLOW (Full Timeline)
Approve / Reject Bookings	DENY (401)	DENY (403)	DENY (forbidden)	DENY (forbidden)	ALLOW (decide_booking)
Emergency Cancel Booking	DENY (401)	DENY (403)	DENY (forbidden)	DENY (forbidden)	ALLOW (admin_cancel_booking)
Verify Members & Domains	DENY (401)	DENY (403)	DENY (forbidden)	DENY (forbidden)	ALLOW (verify_member)
Conduct Spot Audits	DENY (401)	DENY (403)	DENY (forbidden)	DENY (forbidden)	ALLOW (record_asset_audit)
Inspect Returns & Resolve Disputes	DENY (401)	DENY (403)	DENY (forbidden)	DENY (forbidden)	ALLOW (inspect_return)

---

### Table 10: EquipSync Threat Model and Security Mitigations (Section 8.3)

Identified Threat Vector	Potential System Impact	Mitigation Strategy	Enforcement Point	Verification Evidence
Cross-Tenant Data Snooping	Organization B views research assets or members of Organization A.	Walled garden RLS predicates filter by current_institution_id(); RPCs assert tenant matching.	PostgreSQL Engine RLS & RPC Preamble	supabase/tests/rls_isolation_test.sql and scripts/smoke-test.mjs.
Unapproved Asset Check-Out	Borrower checks out equipment while booking is still pending admin review.	Approval lock checks booking status; raises booking_pending_approval if pending or rejected.	verify_asset_qr and check_out_booking RPCs	smoke-test.mjs Step 12 asserting booking_pending_approval.
Administrative Concurrency Race	Two admins approve conflicting pending bookings simultaneously.	decide_booking executes SELECT FOR UPDATE row-level lock and re-checks GiST overlap.	PostgreSQL Row Lock & btree_gist Index	decide_booking RPC lines 601-622.
Unauthorized Domain Auto-Join	Malicious user with public webmail auto-joins enterprise tenant.	Allowed domains rejects public providers; requires exact or subdomain matching.	trg_validate_allowed_domains trigger	smoke-test.mjs domain rejection assertions.
Post-Handover Damage Dispute	Borrower claims equipment was pre-damaged by previous user.	Chain of Custody Hub reveals previous borrower's return condition and photos with identity redacted.	get_custody_chain RPC (Migration 0012)	Custody timeline inspection on ChainOfCustody.tsx.
Evidence Tampering (Photo Swap)	Borrower swaps damage photo after return or submits forged image.	Client computes SHA-256 before upload; database validates 64-hex hash; storage is write-once; admin re-hashes.	Web Crypto API, DB Regex, Private Buckets	OwnerInspectionPanel.tsx Verify Integrity re-check.
Tampering with Spot Audit Logs	Dishonest custodian alters historical spot audit reports to hide neglect.	asset_audits table has all mutations blocked by trigger; write-once private storage bucket.	trg_block_asset_audits_mutation trigger	Migration 0012 lines 38-53.

---

### Table 5: Updated Lifecycle Requirement Traceability (Section 4.2)

Lifecycle Element	EquipSync Capability	Database Table / Constraint	Enforcing RPC / Security Layer	Frontend View	Test Coverage
1. Discovery	Walled garden catalog with category filters and availability switches.	resources, resource_categories, resource_availability_windows	RLS resources_select_authenticated via current_institution_id()	Discover.tsx	smoke-test.mjs and e2e/workspace.spec.ts
2. Eligibility Verification	Multi-attribute verification checking user role, lead time, duration, and safety training.	eligibility_rules, resource_required_qualifications, user_qualifications	request_booking checks: not_verified, not_eligible, supervisor_required	Discover.tsx, RequirementBadges.tsx	smoke-test.mjs and e2e/auth.spec.ts
3. Approval Workflow	Hardened admin triage with row-level locking, conflict alerts, and decision notes.	bookings, audit_log	decide_booking (FOR UPDATE row lock) and admin_cancel_booking RPCs	BookingRequests.tsx	smoke-test.mjs approval lock tests
4. Fair Allocation	Mathematical GiST exclusion constraint with FIFO waitlist and peer slot claiming.	bookings_no_overlap GiST exclusion constraint, waitlist_entries, released_slots	join_waitlist, release_booking, claim_released_slot RPCs	UserDashboard.tsx	smoke-test.mjs concurrency tests
5. Physical Check-Out	15m handover window, approval lock check, physical QR validation, photo hashing.	custody_events, custody_photos, resources.qr_identifier	verify_asset_qr (asserts approved), check_out_booking RPCs	BookingCustody.tsx, CustodyStepperFlow.tsx	smoke-test.mjs handover window tests
6. Return & Condition Tracking	Component-by-component accessory checklist and 5-tier condition evaluation.	resource_accessories, custody_events.accessory_checks	check_in_booking (raises accessory_checklist_incomplete, notes_required)	CustodyStepperFlow.tsx	smoke-test.mjs return damage checks
7. Quality Gate Automation	Algorithmic comparison of checkout vs return condition; auto-incident creation.	incidents, notifications	check_in_booking and inspect_return (server-side rank evaluation)	OwnerInspectionPanel.tsx	smoke-test.mjs auto-incident tests
8. Custody Hub & Spot Audits	Unannounced spot audits, immutable photo logs, and redacted custody chain.	asset_audits, custody_events, audit_log	record_asset_audit, get_custody_chain, resolve_asset_qr RPCs	ChainOfCustody.tsx	smoke-test.mjs custody hub tests
9. Dispute & Inspection	Side-by-side Before/After comparison, SHA-256 re-check, three-way adjudication.	incidents.resolution, custody_events	inspect_return, resolve_dispute RPCs	DisputeResolution.tsx	smoke-test.mjs dispute resolution tests
10. Multi-Tenant Governance	Enterprise B2B onboarding, name integrity, domain proof, and walled garden RLS.	institutions, profiles	trg_check_institution_name, apply_domain_verification triggers, RLS	InstitutionDashboard.tsx, OrganizationSettings.tsx	supabase/tests/rls_isolation_test.sql

---

## 4. Figure Replacement Map & New Diagram Insertion Guide

To update figures in Microsoft Word without disturbing formatting or page flow:
1. Locate the target figure in the master Word document.
2. If the figure is a SCREENSHOT, DO NOT TOUCH OR REPLACE IT.
3. If the figure is a DIAGRAM, right-click the existing image in Word, select Change Picture -> From a File..., and browse to the corresponding image file in PROJECT/docs/report-diagrams/ or UPDATES/diagrams/.
4. Check the caption and alt text to confirm proper alignment.
5. If the new diagram has a different aspect ratio, adjust the picture height or width using the recommended dimensions below.

### Existing Diagram Replacements

| Figure # | Current Caption | New Image File | Old Aspect Ratio | New Aspect Ratio | Recommended Display Size | Action & Instructions |
|---|---|---|---|---|---|---|
| Figure 1 | EquipSync 10-Stage User Journey Flowchart Across Roles and Swimlanes | `Figure_01_user_journey.png` | 1.000 (16.6 x 16.6 cm) | 0.158 (Vertical Flowchart) | Width: 16.5 cm, Height: Auto | Right-click -> Change Picture -> From a File -> Select `Figure_01_user_journey.png`. |
| Figure 2 | PostgreSQL Booking Status State Machine and RPC Transition Graph | `Figure_02_state_machine.png` | 1.000 (16.6 x 16.6 cm) | 0.737 (Statechart) | Width: 16.5 cm, Height: 22.4 cm | Right-click -> Change Picture -> From a File -> Select `Figure_02_state_machine.png`. Shows approval lock state. |
| Figure 24 | EquipSync End-to-End System Architecture: Client SPA, Supabase Gateway... | `Figure_24_system_architecture.png` | 0.544 (13.1 x 24.1 cm) | 0.605 (Full Architecture) | Width: 14.5 cm, Height: 24.0 cm | Right-click -> Change Picture -> From a File -> Select `Figure_24_system_architecture.png`. Reflects OTP and custom SMTP. |
| Figure 25 | EquipSync Relational Data Model: High-Level Entity Relationship Overview | `Figure_25_er_overview.png` | 1.790 (16.6 x 9.3 cm) | 2.432 (Panoramic ER) | Width: 16.5 cm, Height: 6.8 cm | Right-click -> Change Picture -> From a File -> Select `Figure_25_er_overview.png`. Shows 20 relational tables. |
| Figure 26 | Domain ER Diagram 1: Identity, Tenancy, Profiles and Member Qualifications | `Figure_26_er_identity.png` | 0.447 (10.1 x 22.7 cm) | 0.378 (Detailed Domain) | Width: 10.5 cm, Height: 24.0 cm | Right-click -> Change Picture -> From a File -> Select `Figure_26_er_identity.png`. Includes B2B onboarding fields. |
| Figure 27 | Domain ER Diagram 2: Resources, Availability Windows, Accessories... | `Figure_27_er_resources.png` | 3.115 (16.3 x 5.2 cm) | 3.112 (Horizontal ER) | Width: 16.5 cm, Height: 5.3 cm | Right-click -> Change Picture -> From a File -> Select `Figure_27_er_resources.png`. Includes categories and evidence. |
| Figure 28 | Domain ER Diagram 3: Bookings, Custody Events, Photos, Incidents... | `Figure_28_er_bookings_custody.png` | 1.000 (16.6 x 16.6 cm) | 1.391 (Custody ER) | Width: 16.5 cm, Height: 11.9 cm | Right-click -> Change Picture -> From a File -> Select `Figure_28_er_bookings_custody.png`. Includes asset_audits table. |
| Figure 29 | Multi-Tenant Data and Storage Boundary Isolation Between Independent... | `Figure_29_tenant_isolation.png` | 0.877 (16.3 x 18.5 cm) | 1.018 (Walled Garden) | Width: 16.5 cm, Height: 16.2 cm | Right-click -> Change Picture -> From a File -> Select `Figure_29_tenant_isolation.png`. Reflects walled garden model. |
| Figure 30 | Role-Based Access Control Evaluation Architecture and Enforcement Gates | `Figure_30_rbac_flow.png` | 0.770 (16.3 x 21.1 cm) | 0.969 (RBAC Evaluation) | Width: 16.5 cm, Height: 17.0 cm | Right-click -> Change Picture -> From a File -> Select `Figure_30_rbac_flow.png`. Shows domain-verified role path. |
| Figure 31 | Unified Full-Column Entity Relationship Diagram for Custody, Bookings... | `Figure_31_er_unified.png` | 1.252 (16.3 x 13.0 cm) | 3.112 (Full Relational Map) | Width: 16.5 cm, Height: 5.3 cm | Right-click -> Change Picture -> From a File -> Select `Figure_31_er_unified.png`. Comprehensive 20-table schema. |

### Preserved Screenshots (DO NOT ALTER OR REPLACE)
- Figures 3, 4, 5, 6, 7 (Discovery and Onboarding UI views)
- Figures 8, 9, 10, 11, 12, 13 (Custody handover, QR tag, and photo capture steps)
- Figures 14, 15, 16, 17, 18, 19, 20, 21, 22, 23 (Administration dashboard, triage, disputes, audit timeline, and dark theme)

### Recommended New Diagrams (Optional Insertions)

| New Figure # | Proposed Caption | Image File | Suggested Location in Report | Rationale & Value |
|---|---|---|---|---|
| Figure 4a | Domain Auto-Verification Sequence: Sign-Up, Email Confirmation Trigger, and Walled Garden Access | `Figure_04a_domain_autoverify_sequence.png` | Section 5.3, after Figure 4 / Figure 5 | Visually explains how student/staff email domains bypass manual admin verification queues while untrusted webmail accounts remain gated. |
| Figure 8a | Hardened Booking Approval Pipeline: Request, Row-Level Locking, Conflict Re-Check, and Approval Lockout | `Figure_08a_booking_approval_pipeline.png` | Section 6.2, after Figure 8 / Figure 9 | Proves the defensive database boundary blocking unapproved equipment check-outs with machine code booking_pending_approval. |

---

## 5. Stale Statements Noticed (Not Rewritten)

The following items in the master Word document were identified as historically outdated or based on early prototype assumptions, but are outside the strict four rewrite areas specified in the prompt:

1. Cover Page Subtitle and Hackathon Problem Statement Title: Mentions "CampusShare" and "Unlock Underused Equipment and Spaces - 48-Hour Build". Kept intentionally as historical context for hackathon grading traceability.
2. Section 1.1 Supported Organisation Types: Lists "University", "College", "Workshop", "Shop", "Community lab", and "Other". While Migration 0013 expanded allowed types to include "School", "Corporate", and "Research Institute", the existing 5 core types remain functionally valid.
3. Section 3.1 Anecdotal Utilization Notes: Mentions general workshop idle time observations. These were identified in earlier audits and flagged with [FILL: ...] for team survey data.
4. Section 6.2 UTC Timezone Normalization: Describes date-fns client-side UTC string conversions. This remains accurate but does not mention daylight saving handling in newer date pickers.
5. Section 9.2 AI-Assisted Development Tools: Mentions Google AI Studio, Antigravity, Claude, and ohmypie CLI agent. This remains accurate as a historical development disclosure for the hackathon build.

---

## 6. Comprehensive Evidence Matrix

Every technical claim in the updated report text is grounded in the codebase and verified through the evidence below:

| Claim in Updated Text | Enforcing Code Artefact | Line / Reference Evidence | Automated Test Verification |
|---|---|---|---|
| Domain Auto-Verification | `supabase/migrations/0011_domain_verification.sql` | `apply_domain_verification()` trigger lines 312-398; sets `verification_method = 'domain'`. | `scripts/smoke-test.mjs` Step 3 & Step 4 (asserts domain matching). |
| Allowed Domains Restrictions | `supabase/migrations/0011_domain_verification.sql` | `trg_validate_allowed_domains()` lines 86-180; rejects public commercial email domains. | `scripts/smoke-test.mjs` Step 4 (verifies gmail.com rejection). |
| Walled Garden Tenant Isolation | `docs/RLS_MATRIX.md`, `supabase/migrations/0005`, `0013` | Every query asserts `institution_id = current_institution_id()`; cross-tenant reads return 0 rows. | `supabase/tests/rls_isolation_test.sql` (cross-tenant suite). |
| Enterprise B2B Registration | `supabase/migrations/0013_enterprise_b2b_workflow.sql` | `handle_new_user()` lines 121-310; validates website, phone, job title, and organization type. | `scripts/smoke-test.mjs` Step 1 (admin onboarding validation). |
| Live Name Availability Check | `supabase/migrations/0013_enterprise_b2b_workflow.sql` | `organization_name_available()` lines 87-115; index `idx_institutions_normalized_active_name`. | `scripts/smoke-test.mjs` Step 2 (duplicate rejection). |
| Booking Approval Lock | `supabase/migrations/0013_enterprise_b2b_workflow.sql` | `check_out_booking()` lines 802-818; raises `booking_pending_approval` if status is pending. | `scripts/smoke-test.mjs` Step 12 (verifies handover block). |
| Row Lock on Approval Decision | `supabase/migrations/0013_enterprise_b2b_workflow.sql` | `decide_booking()` lines 584-630; executes `SELECT * FROM bookings FOR UPDATE`. | `scripts/smoke-test.mjs` Step 13 (hardened decision pipeline). |
| Administrative Revocation | `supabase/migrations/0013_enterprise_b2b_workflow.sql` | `admin_cancel_booking()` lines 662-758; cancels approved/pending slot and logs decision note. | `scripts/smoke-test.mjs` Step 14 (admin cancellation). |
| Chain of Custody Hub & Spot Audits | `supabase/migrations/0012_custody_hub.sql` | `record_asset_audit()` lines 174-338; table `asset_audits` protected by immutability trigger. | `scripts/smoke-test.mjs` Step 18 (spot audit verification). |
| Redacted Custody Chain Timeline | `supabase/migrations/0012_custody_hub.sql` | `get_custody_chain()` lines 345-560; redacts prior borrower identity for inspecting members. | `scripts/smoke-test.mjs` Step 19 (redacted timeline check). |
| QR Code Resolution & Actions | `supabase/migrations/0012_custody_hub.sql` | `resolve_asset_qr()` lines 90-170; returns contextual action array based on asset and booking state. | `scripts/smoke-test.mjs` Step 17 (QR action resolution). |
| Email OTP Authentication Flow | `src/lib/auth.ts`, `src/pages/Register.tsx` | `verifySignUpOtp()` and `verifyRecoveryOtp()` call `supabase.auth.verifyOtp({ type: 'signup' })`. | `e2e/auth.spec.ts` (OTP verification flow). |
