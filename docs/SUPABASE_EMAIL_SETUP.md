# Supabase Email & OTP Configuration Guide

This operational guide provides step-by-step instructions for configuring custom SMTP, 6-digit One-Time Passcodes (OTP), and email templates in the Supabase Dashboard for EquipSync.

---

## 1. Custom SMTP Configuration (Production)

> **Security Guard**: Never commit SMTP host credentials, passwords, or API keys to repository code or environment templates. All credentials must be entered directly in the Supabase Dashboard.

1. Navigate to your Supabase Project Dashboard: **Project Settings** &rarr; **Authentication** &rarr; **SMTP Settings**.
2. Enable **Enable Custom SMTP**.
3. Fill in your institutional transactional email provider credentials:
   - **Sender email**: `noreply@your-institution.edu` (or verified sending domain)
   - **Sender name**: `EquipSync Equipment Sharing`
   - **Host**: e.g., `smtp.sendgrid.net`, `smtp.postmarkapp.com`, or `email-smtp.us-east-1.amazonaws.com`
   - **Port**: `587` (TLS) or `465` (SSL)
   - **Username**: Enter your SMTP API key username
   - **Password**: Enter your secret SMTP token or password
4. Click **Save Changes**.

---

## 2. Authentication & Rate Limit Settings

In **Authentication** &rarr; **Configuration** &rarr; **Auth Providers** &rarr; **Email**:

| Setting | Required Value | Purpose |
| :--- | :--- | :--- |
| **Enable Email Signup** | `Enabled` | Allows institutional members and admins to create accounts |
| **Confirm Email** | `Enabled` | Enforces OTP verification before account activation |
| **Minimum Password Length** | `8` | Ensures password complexity meets security policy |
| **OTP Expiry** | `600 seconds` (10 minutes) | Enforces 10-minute token validity window |
| **OTP Length** | `6` | 6-digit numeric codes compatible with `InputOTP` |
| **Email Rate Limit** | `30 per hour` | Mitigates burst abuse and protects provider reputation |
| **Max Verification Attempts** | `5` | Enforces client & server lockout on brute-force attempts |

---

## 3. Email Templates Setup

In **Authentication** &rarr; **Email Templates**:

### A. Reset Password Template
- **Template**: **Reset Password**
- **Subject**: `Your EquipSync password reset code`
- **Body**: Paste the complete contents of `docs/email-templates/reset-password.html`.
- **Key Placeholder**: Enforce that the template uses `{{ .Token }}` in large monospace typography. No link carrying credentials should be included.

### B. Confirm Sign-up Template
- **Template**: **Confirm Signup**
- **Subject**: `Confirm your EquipSync account`
- **Body**: Paste the complete contents of `docs/email-templates/confirm-signup.html`.
- **Key Placeholder**: Enforce that the template uses `{{ .Token }}` to display the 6-digit confirmation code.

---

## 4. Verification & Testing Checklist

Before deploying to staging or production, execute the following smoke verification tests:

- [ ] **Sign-up Confirmation Flow**:
  - Register a new member account with an accessible email.
  - Verify receipt of email with subject `"Confirm your EquipSync account"`.
  - Enter 6-digit code into `Register.tsx` OTP screen; verify immediate activation.
  - Confirm wrong code surfaces `"Invalid verification code"`.
  - Test 60-second resend countdown timer.

- [ ] **Password Recovery Flow**:
  - Visit `/forgot-password` and submit registered email address.
  - Verify receipt of email with subject `"Your EquipSync password reset code"`.
  - Verify 6-digit code renders clearly in light and dark email clients.
  - Enter code in `PasswordRecoveryWizard`; assert transition to Step 3 (Reset Password).
  - Verify Step 3 enforces minimum 8 characters and matching confirmation passwords.
  - On successful update, confirm user is signed out and redirected to `/login`.

- [ ] **Security & Guard Verification**:
  - Confirm `/update-password` permanently redirects to `/forgot-password`.
  - Confirm attempting to visit `/app/*` while in recovery mode redirects to `/forgot-password`.
  - Confirm 5 consecutive wrong OTP attempts resets wizard to Step 1.
