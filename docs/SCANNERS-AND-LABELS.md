# Scanner and label implementation

SFS implements documented behavior independently; it does not copy proprietary application code or probe third-party services.

## Research and choices

- [Microsoft Dynamics 365: GS1 barcodes](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/gs1-barcodes): the mobile scanner delivers text, the selected task gives it meaning, and application identifiers can provide additional fields. SFS resolves a record within the selected receiving, arrival, sorting, or loading task, then validates the transition on the server.
- [Zebra DataWedge keystroke output](https://techdocs.zebra.com/datawedge/latest/guide/output/keystroke/): scanner results can enter an application as keyboard input. This is SFS's first handheld integration; native Android Intent output is not implemented.
- [Odoo receipts and deliveries](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/barcode/operations/receipts_deliveries.html?highlight=barcode): scans operate within a receipt/delivery workflow. SFS registers expected packages against receipts and prevents over-receipt.
- [GS1 SSCC](https://www.gs1.org/standards/id-keys/sscc): logistic units have unique identifiers. SFS generates internal Code 128 labels; it does not invent GS1 company prefixes or claim its internal IDs are GS1 SSCCs.

## Zebra handheld setup

1. Install/open SFS in Chrome or Enterprise Browser on the handheld. Sign in with an authorized supervisor account. Employees remain restricted to their own assignments.
2. In a DataWedge profile associated with that browser, enable barcode input and **Keystroke output**. Enable Enter as the scan suffix. Do not enable a second output path that sends duplicate scans.
3. Enable Code 128. Preserve barcode text; no case conversion or arbitrary prefix/suffix except Enter. SFS accepts an optional `]C0` prefix for ordinary Code 128.
4. Open **Scan & recovery → Scan station**, select the task, fill the route/trailer context if needed, and focus **Scan barcode**.
5. Register package contents before scanning. An inbound load arrival changes load status only; receiving each registered package changes inventory. Duplicate package receipt is rejected even with a new request ID.
6. A successful scan clears and refocuses the field. Do not continue if the screen reports failure. This version requires connectivity; it does not queue offline inventory mutations.

A registered package represents one SKU and an integer quantity. Mixed-SKU pallets, lot/serial tracking, expiration rules, nested license plates, native intents, RFID, and background scan capture are not implemented.

## Labels

The authenticated label endpoint produces Code 128 SVG and Zebra ZPL at 203 or 300 dpi on 4×6 stock. The print/reprint action is audited; it does not change the identifier or stock. ZPL encodes all variable field text as hex to prevent printer-command injection. IDs for these templates are restricted to 24 ASCII letters/digits/dot/underscore/hyphen/slash, to keep the barcode inside the printable width at a two-dot module size.

Internal codes use `SFS:<kind>:<id>` with kind I=item, U=package/pallet, L=inbound load, P=parcel, B=location, T=trailer, R=receipt, O=order. Long-form kind names are also accepted on input. Existing supplier barcodes can be mapped to records. Standalone GS1 AI (00) SSCC-18 and AI (01) GTIN-14 are parsed and check-digit validated; composite GS1 strings are explicitly rejected pending a configured parser/mapping.

Use **Print 4×6 label** with a configured printer driver at actual size, or download ZPL and send it using the printer's approved utilities. Browser-to-printer discovery, silent printing, Browser Print installation, printer readiness checks, and print-job acknowledgments are not implemented. A “prepared” audit entry means a print/download was requested, not proof the printer produced a label. Test both the physical print and rescan on the intended Zebra models before operational use.

These are internal warehouse labels. They do not purchase postage or replace UPS/FedEx/carrier-certified shipping labels. A carrier integration needs its own account, API credentials, rating/purchase/refund workflows and sandbox validation.
