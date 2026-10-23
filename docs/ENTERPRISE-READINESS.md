# Enterprise readiness — development pilot

This release is not certified enterprise-ready and does not warrant zero vulnerabilities.

## Implemented database changes

D1 migrations 0002 and 0003 preserve the previous facility data in a recovery snapshot and split active operations into indexed, facility-scoped records. Stock balances have dedicated SKU/location rows and nonnegative/reservation constraints. The facility row now holds small metadata, a revision and an internal transaction token rather than the entire warehouse JSON document.

Each accepted action atomically commits the facility revision, changed records, stock balances, stock-ledger deltas, audit event, request receipt and assignment notification jobs in a D1 batch transaction. A failed comparison or revoked membership cannot write the following rows. Request IDs are facility-scoped and bound to the actor and canonical command hash. Reusing a key for another command is rejected. Database triggers prohibit updates/deletes to operational audit, stock ledger and request-receipt history. Database administrators can still alter these protections; this is not externally notarized/tamper-proof storage.

The migration retains a recovery snapshot and opening stock-ledger balances, without pretending to reconstruct missing historical stock movements. Audit reads show the most recent 200 entries; older history remains stored. General records are stored individually as typed JSON, not yet fully relational rows with foreign keys for every operational relationship.

Multiple invited supervisors share the owner's facility. Server checks enforce roles, membership version and facility ownership. Two-supervisor collision, revoked access, and synthetic second-facility isolation are tested. Employees receive only their own published assignment and cannot access labels, warehouse records, or account administration.

## Required before enterprise contracts

- Choose production hosting, identity provider, region and data residency. Provision managed email/password and Google sign-in; verify callback allowlists, invitation/verification/reset flows, account recovery and Google consent setup. Add MFA/SSO/SCIM if required by the contract.
- Provision a dedicated production database with approved backup retention, point-in-time recovery, encryption/key requirements, measured RPO/RTO, and a demonstrated restore drill. No production backup contract or recovery test has been performed by this release.
- Model organizations and multiple facilities per organization. This pilot supports one facility per deployment; membership email/user links are globally unique within it. It is not a finished multi-tenant SaaS control plane.
- Benchmark realistic shift-change, receiving and shipment workloads. The service still loads facility records into memory and serializes writes through a facility revision. Add paginated queries, narrower transactional locks/aggregate boundaries, queues, indexes validated against real workload, and retention policies before high-volume use. Supabase PostgreSQL is provisioned for identity; warehouse operations still use D1. Migrating operational records to PostgreSQL remains future work.
- Add independent append-only export/retention controls, security-event auditing for membership changes, operational monitoring, alerts, scheduled outbox retries and incident procedures. Current push retry is request-driven.
- Complete the outstanding dependency remediation, static/dynamic assessment and independent penetration test. Validate RBAC and tenant isolation using real separate accounts and devices, including the newly configured identity service.
- Establish contractual SLA/support, privacy/data processing terms, deletion and retention policy, accessibility/device validation, and any requested compliance attestation. No SOC 2/ISO/HIPAA certification is asserted.

## Standard authentication activation in progress

The source includes Supabase SSR sessions, email/password sign-in, account registration, Google OAuth, email verification callback, password reset/update, secure HttpOnly/SameSite cookies, server-side user verification and a bounded sign-in attempt counter. Passwords are passed to the identity provider, never saved in SFS tables. Roles come from SFS membership, not browser claims or OAuth profile metadata.

Activation requires `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in runtime configuration, an operational Supabase project and Google provider configuration. Set `GOOGLE_AUTH_ENABLED=true` only after that provider is configured and tested. Configure SMTP/delivery and password policies at the identity provider. The app uses a public/publishable provider key, never a service-role key in browser code. Anyone can register an identity; registration does not create a facility membership or grant a role. Only verified emails can bind to owner-approved membership records. Switching providers must be staged and tested; existing memberships keep their facility link.

Supabase project `uktjxddguiewbkyuwowa` is connected in `us-east-1`, and runtime environment revision 3 enables `AUTH_PROVIDER=supabase`. Its Site URL is the SFS deployment, with exact `/auth/complete` and `/auth/complete?reset=1` redirects. Email confirmation stays enabled; the provider enforces a 12-character minimum and secure password changes. A real provider request with a deliberately short password returned `422 weak_password` without creating an account. Successful signup, verification, recovery and signed-in sessions still need end-to-end checks.

Google Cloud project `sfs-warehouse` has been created under the selected Google account. Its branding registration is saved and the Web client form is prepared with the SFS origin and Supabase callback. Client credential creation awaits approval. Google remains disabled in Supabase and `GOOGLE_AUTH_ENABLED=false`. Custom SMTP is not configured; Supabase's default email service only permits organization team addresses and is not ready for employee signup.

The current private `chatgpt.site` URL has a platform login gate outside this application. Changing an application form cannot remove that gate. Removing it requires an explicitly owner-approved audience change. That approval is pending; application sign-in has switched to Supabase, while the hosting gate remains owner-only. The `/privacy` notice is available in the app and linked from login, ready to add to Google branding when the public login audience is approved.
