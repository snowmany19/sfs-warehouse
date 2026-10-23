# SFS Warehouse — development pilot

The product has two separate operating workflows with shared people, areas, exceptions, and an audit history. The initial workspace contains clearly labeled fictional records. This is a working development pilot, not a production-ready warehouse management system.

## Implemented

- Staffing: add employees, record trained areas, mark presence, plan area assignments, set staffing targets, publish assignment updates, and see employee acknowledgments. Publishing is separate from planning. New published versions invalidate old acknowledgments. Absent or untrained employees cannot receive new area assignments.
- Inventory warehouse: item catalog, storage locations and capacity, inbound receipts with partial receiving, put-away and stock moves, stock reservation, physical counts with reasons, one-item orders, pick / pack / ship transitions, and shipment references.
- Parcel hub: keyboard-scanner-compatible barcode entry, unique parcel IDs, destination routes, lane verification, route-matched loading, trailer capacity, dock occupancy, departure confirmation, and manifests.
- Shared operations: staffing overview, stock shortage indicators, exceptions and resolution notes, timestamped audit history, search, CSV exports, responsive desktop/mobile interfaces.
- Persistent D1 storage scoped to the authenticated owner. Conditional revision updates prevent simultaneous edits from silently overwriting each other. Every successful command updates the state and audit together.

- Roles: owner manages account access, supervisor runs operations, and employees see and acknowledge only their own published assignment. Membership and role checks run on every server request; the manager preview is read-only. Revocation blocks access and removes phone registrations.
- Phone app: installable PWA, opt-in encrypted Web Push, generic lock-screen alerts, durable delivery outbox committed with assignment updates, expired-device cleanup, stale-alert cancellation, and manual retry. No private records are cached offline.

## What is still needed for a customer pilot

- Named employee onboarding in both app membership and private Sites viewer access, physical iPhone/Android installation and notification testing, account role editing/reactivation, and customer acceptance testing.
- Automatic scheduled push retries and delivery monitoring. Push delivery is best-effort and manual retry is available. Native app-store packages and SMS are not implemented.
- Real shifts, dates, breaks, availability, configurable operating areas, and certification expiration.
- Multi-line orders, purchase order integration, returns, cancellations, lot/serial/expiry tracking, units of measure, inventory holds, and replenishment.
- Carrier label/rate APIs, parcel manifest import, routing rules, and printer/device integration. Shipping references are recorded manually; no carrier booking occurs.
- Production-scale normalized storage, retention/backup policy, bulk import validation, monitoring, and customer acceptance testing. The pilot stores a versioned workspace document and audit in a single database row, making writes atomic but unsuitable for large facilities without further work.

## Validation goals

1. Observe a supervisor assign the floor, publish a change, and find an unacknowledged assignment.
2. Receive goods, put them away, release an order, pick, pack, and ship it without a stock discrepancy.
3. Scan a parcel, reject the wrong lane/trailer, load the right trailer, and dispatch it.
4. Measure time spent compared with the current workflow and identify who controls software purchasing.

Workflow references: [Microsoft warehouse management overview](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-management-overview) and [inventory-to-deliver process](https://learn.microsoft.com/en-us/dynamics365/guidance/business-processes/inventory-to-deliver-areas).

