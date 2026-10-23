# Security review — 2026-10-13

Status: hardened development pilot; **not a clean security sign-off**.

The full npm advisory audit initially flagged 30 packages (one critical, 21 high, seven moderate, one low). Patched framework, React server components, Vite, Wrangler/Cloudflare tooling and transitive packages reduced this to **eight high dependency entries**, with zero critical/moderate/low entries remaining. These eight entries trace to the `braces` advisory GHSA-vfj7-8cjw-p6xm through micromatch, fast-glob, the lint toolchain and Vinext build plugins. No safe supported patched braces version was offered by the registry audit. A suggested framework downgrade is not accepted as a security fix. Build-pattern denial-of-service exposure is different from an established exploit against SFS's operational endpoints; it remains an unresolved finding and release gate.

The audit is point-in-time, advisory-based and not proof that other vulnerabilities are absent. Do not expose the development server to the internet or process untrusted build glob patterns. A complete independent penetration test was not performed.

## Verified controls

- Server-enforced owner/supervisor/employee permissions; labels and operational APIs deny employee access.
- An explicit employee response projection, forged acknowledgment rejection, membership-revocation checks and facility isolation tests.
- Atomic stock/event/outbox writes, conditional revisions, duplicate request receipts and one-time package/return receiving.
- Cancellation and inspection workflows preserve quantity conservation and prevent returned stock from becoming available prematurely.
- Stock corrections require a distinct reviewer and reject stale counts.
- Cross-origin mutation rejection, JSON-only bounded streaming request bodies, prepared SQL, constrained label IDs and hex-encoded ZPL field data.
- Security response headers, private/no-store API responses and no offline caches of private warehouse data.
- Managed authentication adapter validates provider identity and verified email. Activation/real-provider end-to-end checks remain outstanding. Google OAuth, email delivery, recovery and production hosting are not verified.
- Existing Web Push endpoint host allowlist and encrypted generic notification contents retained.

## Validation evidence

36 automated domain/access/push/persistence/migration tests passed at implementation time, including concurrent supervisor writes, conflicting idempotency keys, rollback and append-only protections. Local end-to-end API checks passed for scan stock updates, retry deduplication, stale revisions, cross-origin/body limits, unauthenticated access, SVG/ZPL responses, employee projection, forged acknowledgments, supervisor restrictions and revoked access.

Type checking, lint and production packaging results are recorded with the release. Physical Zebra scan/print testing, real separate-user sessions, external identity configuration, backup restoration, load testing and external penetration testing remain required.

## Account sign-in follow-up

The account screen now supports self-registration without granting membership, verified email/password identities, Google (enabled separately), password recovery and per-device sign-out. Eight additional authentication tests cover missing/invalid configuration, unverified identities, injected role fields, rate limiting, password updates, callback destinations and provider errors. These tests use a simulated identity provider. Supabase is now connected and enabled internally. Its real password policy rejected a deliberately weak signup with `422 weak_password`, and the account count remained zero. Real email delivery, completed Google sign-in, recovery and authenticated production sessions remain unverified. The current private deployment still uses its existing platform gate. See ENTERPRISE-READINESS.md for the remaining activation steps.
