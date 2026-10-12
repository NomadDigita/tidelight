# Tidelight email setup

Tidelight uses Resend in two separate, server-side paths:

- Supabase Auth sends signup confirmation, sign-in links and codes, password recovery, reauthentication and enabled account notifications through the configured Resend SMTP connection.
- The Tidelight server sends explicitly opted-in Nightwatch signals, paper fills, risk reviews, linked research briefs and daily summaries through the Resend API. Passkey changes use the transactional `security@tidelight.app` identity.

No email is sent directly from a browser. Nightwatch email is off by default; a person must enable each class in the Nightwatch control surface. Security notifications are transactional and do not include unsubscribe links. Queue rows contain an event key, category, minimal rendered content, attempts and Resend message ID; they never contain provider credentials. Queue rows are private to the server role. Retries are bounded and use Resend idempotency keys; a lease allows recovery if a worker stops while sending.

## Secrets and provider setup

1. Create or reuse a Resend API key with only the email sending permission for the verified `tidelight.app` domain. Add it to the **Vercel project** as the server-only `RESEND_API_KEY` in Production, Preview and Development as appropriate. Do not prefix it with `NEXT_PUBLIC_` and do not commit it.
2. In **Supabase Dashboard → Authentication → SMTP Settings**, first record the current settings. Configure Resend SMTP using host `smtp.resend.com`, port `465` (SSL) or `587` (STARTTLS), username `resend`, the Resend API key as the SMTP password, sender address `no-reply@tidelight.app`, and sender name `Tidelight`. This setting is project-wide; keep the already configured receiving MX records and website DNS unchanged.
3. In **Supabase Dashboard → Authentication → Email Templates**, copy the subject and HTML from the matching files under `supabase/templates/` into confirmation, magic link, recovery, email change and reauthentication. Enable the password changed, email changed, MFA enrolled and MFA unenrolled notification types with the matching files. Confirm the dashboard's OTP length matches the sign-in form's currently configured length before enabling email-code sign-in. The local `supabase/config.toml` points local Supabase development at these templates; do not push it to hosted auth configuration unless the existing hosted settings have first been pulled and preserved.
4. Ensure the existing protected `CRON_SECRET` and Supabase server secret remain set in Vercel. The Nightwatch API processes queued messages immediately after a user action; `/api/cron/email-delivery` is a protected recovery sweep for retries and interrupted workers.
5. Use a dedicated safe test account with an owned mailbox to test signup, magic link/code, recovery, a passkey security notice, and each opted-in Nightwatch preference. Check Resend's delivery events and Supabase Auth logs. Do not use real customers as test recipients.

Resend's SMTP connection has a single configured sender identity. Therefore Supabase Auth messages, including its built-in password/email/MFA notices, use `no-reply@tidelight.app`; the application uses `security@tidelight.app` for its own verified passkey-change notices. Supabase's Send Email Hook would replace SMTP sending entirely, so it is not enabled here. Do not turn it on as a way to change sender identity without deliberately migrating and testing the complete Auth email path.

## Operational behavior

- Nightwatch delivery preferences default to off and are stored per user with row-level security.
- Queue event keys are unique; duplicate Nightwatch events do not create duplicate messages.
- Resend errors are reduced to provider status codes, never recipient or message text. Failed sends retry with exponential backoff, at most eight attempts.
- Bounces and provider suppression are handled by Resend. Users can stop optional Nightwatch email by turning off the corresponding control in Nightwatch; account security email remains transactional.
- Email notifications never place live exchange orders. Nightwatch email describes research and simulated paper activity only.
