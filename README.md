# SFS Warehouse

A private warehouse operations pilot for Security Flaw Solutions. Separate **Inventory warehouse** and **Parcel hub** workflows share staffing, area assignments, exceptions, and an audit trail.

Built with React, TypeScript, Vinext, and Cloudflare D1. See [PRODUCT.md](PRODUCT.md) for implemented behavior and the remaining customer-pilot requirements.

## Local development

Requires Node.js 22.13+ (Node 24 recommended), npm, and Git.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_icy_odin.sql
npm run dev
```

Apply each local migration once. The development server prints its loopback URL. With the legacy development configuration, sign-in is simulated by the starter only in development at `/signin-with-chatgpt?return_to=/`. The hosted app now uses Supabase internally; its separate owner-only Sites hosting gate is still present while the audience change awaits owner approval.

```sh
npm test
npm run typecheck
npm run build
```

## Important behavior

- The configured owner initializes the warehouse with fictional sample records, clearly marked in the interface. Invited team accounts share this facility with server-enforced permissions.
- Record changes go through authenticated server commands; browser storage is not the record store.
- A workspace revision guards every write, so concurrent changes cannot silently overwrite one another.
- Receipt and stock operations reject invalid quantities, insufficient stock, reserved-stock conflicts, and exceeded capacities.
- Orders reserve storage stock on release, move it to reserved packing stock after picking, and reduce physical inventory on shipment.
- Parcels must be sorted to the correct lane and loaded on a matching route before dispatch.
- Employees have a separate installable phone view at `/my-assignment`. Server-side roles restrict employees to their own published assignment and acknowledgment; owner and supervisor permissions are separate. Opt-in Web Push sends a generic assignment-change alert. Carrier labels, SMS, and external bookings are not connected.
- CSV exports escape spreadsheet formula prefixes.

## Project layout

- `app/warehouse-app.tsx`: responsive operations interface
- `app/api/workspace/route.ts`: authenticated, revision-checked persistence
- `lib/domain.ts`: validated warehouse and parcel state transitions
- `db/schema.ts`, `drizzle/`: D1 schema and immutable migration history
- `tests/domain.test.mjs`: operational integrity checks
- `.openai/hosting.json`: Sites deployment configuration

Runtime data, credentials, local development state, build output, and dependencies are excluded from Git. Deployment is private by default. A physical iPhone/Android notification test and customer pilot are still required before operational rollout. See PRODUCT.md for limits.

## Employee phone app and account access

1. Configure `WORKSPACE_OWNER_EMAIL` as the owner's verified sign-in email, plus `VAPID_PUBLIC_KEY` and secret `VAPID_PRIVATE_KEY` in the hosting environment. Supabase sign-in additionally requires `AUTH_PROVIDER=supabase`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Hosted values are configured for this Site. Never commit private keys.
2. Sign in as the owner. In **Team access & roles**, add an employee's exact sign-in email and link their employee record, or select Supervisor.
3. Complete the hosting audience and email-delivery setup before inviting employees. The existing private Sites gate currently requires its own viewer permission; standard sign-in without ChatGPT needs an owner-approved public login audience. In either case, creating an identity through Supabase does not grant SFS membership or a role. Supabase email signup requires verification; its default sender is restricted to organization team addresses, so employee email signup requires custom SMTP.
4. The employee opens the app, signs in, adds it to their Home Screen, and enables phone alerts. iPhone requires iOS 16.4+ and a Home Screen installation. Android supports installation through Chrome. This is a PWA, not an App Store/Play Store binary.
5. Publish changed assignments. Registered devices receive a generic alert; opening it requires sign-in and retrieves only that employee's current assignment. Acknowledgment is done by the employee.

Owner can manage access; supervisors can run operations but cannot manage accounts or acknowledge for employees. Revocation blocks all employee endpoints and removes phone registrations. Uninvited users cannot create a workspace or grant themselves a role. Employee HTTP responses never include coworkers, drafts, inventory, exports, or audit history. Nothing private is cached offline.

Push is best-effort: provider acceptance is not proof the phone displayed an alert. Device permissions, Focus settings, connectivity, and expired subscriptions can prevent delivery. Durable outbox records accompany assignment updates atomically; **Retry alerts** handles failed delivery. Acknowledgments are the operational confirmation. There is no continuously running retry scheduler yet.

For local development, use an ignored `.dev.vars` file with `WORKSPACE_OWNER_EMAIL="seedy@sites.test"`. Apply every new migration once, including `drizzle/0001_opposite_rafael_vega.sql`. Configure separate local VAPID keys only when testing push on a supported device.

References: [WebKit Home Screen push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) and [Web Push library](https://github.com/block65/webcrypto-web-push).

The `/privacy` notice is linked from the account screen and describes account, operational and notification data. Set this published URL in Google Auth Platform before making Google sign-in publicly available. Google remains disabled in the app until its provider configuration is complete and verified.

## Scanner, recovery and security expansion

The **Scan & recovery** workspace now supports registered package receiving, inbound load arrivals, parcel sorting/loading, internal Code 128/Zebra ZPL labels, cancellations, inspected returns and second-supervisor count corrections. See [scanner setup](docs/SCANNERS-AND-LABELS.md), [enterprise readiness and sign-in activation](docs/ENTERPRISE-READINESS.md), and [security review](docs/SECURITY-REVIEW.md). This remains a development pilot; see the release review for outstanding security and infrastructure requirements.
