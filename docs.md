# Alegra Type C Invoice Generator

## Project Overview

This application is a lightweight internal tool that allows the client to recreate existing Alegra invoices as **Type C** invoices.

Instead of importing invoices from Excel, the application connects directly to the Alegra account via API, fetches existing invoices, allows the user to select which invoices should be recreated, and generates new Type C invoices using the appropriate Number Template.

The UI strictly replicates the native Alegra Sales Invoice page to minimize the learning curve.

---

# Primary Goal

Convert existing Type B invoices into Type C invoices.

The application **does not modify** existing invoices.

Instead it:

* Fetches existing invoices via API
* Lets the user select which invoices to recreate
* Reads client/item data from selected invoices and directly generates new Type C invoices
* Exports the generated invoices in the same format provided by Alegra

---

# User Flow

```
Login
    ↓
Authenticate with Alegra
    ↓
Fetch Sales Invoices & Render Table with Selection
    ↓
User Selects Invoices
    ↓
Recreate Invoices (Direct Client Resolution & Type C Generation)
    ↓
View Results
    ↓
Export Generated Invoices
```

---

# Features

## Phase 1 — Authentication

### Goal

Authenticate the user with Alegra.

The application should require:

* Username (Email)
* API Token / Password

After successful authentication:

* Verify credentials
* Store session securely
* Load invoices

Status

* [x] Completed

---

## Phase 2 — Fetch Sales Invoices, Table Display & Row Selection

### Goal

Retrieve invoices directly from Alegra and display them using a Shadcn/TanStack Data Table styled identically to native Alegra UI, enabling multi-row selection.

Columns

* **Select Checkbox** (Select All & Individual selection)
* **Type** (Derived from `subDocumentType`, e.g., `INVOICE_C` $\rightarrow$ `C`)
* **Number** (`numberTemplate.fullNumber` or `number`)
* **Client** (`client.name`)
* **Creation** (`date`)
* **Expiration** (`dueDate`, with past-due red styling)
* **Total** (`total`, formatted currency)
* **To be charged** (`balance`, formatted currency)
* **Status** (`open` $\rightarrow$ Pending, `draft` $\rightarrow$ Draft, `closed` $\rightarrow$ Paid, `void` $\rightarrow$ Void)
* **Actions** (Contextual row buttons)

Features

* Client-side search filtering by Client Name
* Full native Alegra color palette, badges, icons, and layout structure
* Multi-row select with counter and batch action trigger

Status

* [x] Completed

---

## Phase 3 — Selection & Type C Generation

### Goal

Allow the user to decide which invoices should be recreated. Only the selected invoices should be recreated.


Read data directly from selected existing invoices and immediately create corresponding **Type C** invoices.

Since data is pulled directly from the live Alegra API, client and item IDs are guaranteed to exist, eliminating redundant existence checks.

Workflow

```
Selected Original Invoice
        ↓
Extract Client ID, Items, Prices, Taxes & Dates
        ↓
Apply Type C Number Template
        ↓
POST New Invoice to Alegra API

```

Requirements

* Reuse existing Client ID (zero duplicate contacts)
* Retain original Items, Quantities, Unit Prices, and Taxes
* Retain relevant dates
* Apply Type C Number Template
* PDF download option available per invoice

Status

* [x] Completed

---

## Phase 4 — Generation Summary

### Goal

Display a concise summary immediately after the Type C invoice generation process completes.

The summary only represents the current generation job.

Display

```text
✅ Generation Complete

Successfully created 17 Type C invoices.

Failed: 0

[ Export XLSX ]
[ Download Generation Manifest ]
[ Close ]
```

### Generation Manifest

Alongside the generated invoices, the application creates a machine-readable CSV manifest containing the relationship between every original invoice and its corresponding generated Type C invoice.

The manifest is intended for future automation tasks and serves as a portable mapping file.

Columns

* Original Invoice ID
* Original Invoice Number
* Generated Invoice ID
* Generated Invoice Number
* Client ID
* Client Name
* Generation Status (Success / Failed)
* Error Message (if failed)
* Generated At (Timestamp)

Example

```csv
originalInvoiceId,originalNumber,generatedInvoiceId,generatedNumber,clientId,clientName,status,error,generatedAt
12345,B-001,98765,C-001,456,John Doe,Success,,2026-07-21T10:35:12Z
12346,B-002,98766,C-002,457,Jane Smith,Success,,2026-07-21T10:35:14Z
12347,B-003,,,,,Failed,"Tax condition missing",2026-07-21T10:35:15Z
```

### Purpose

The Generation Manifest enables future automation without requiring a database.

Examples include:

* Bulk deletion of generated Type C invoices.
* Bulk regeneration after fixing failed invoices.
* Auditing original-to-generated invoice relationships.
* Running custom scripts against previously generated invoices.
* Importing the manifest into other internal tools.

Notes

* The manifest is generated for the current execution only.
* The application does not maintain generation history.
* Users should download and retain the manifest if future automation is required.

Status

* [x] Completed

---

## Phase 5 — Export

Export generated invoices matching Alegra's native 32-column `.csv` format (`sep=;` header).

Capabilities
* **Export Selected**: Export checked rows from the data table.
* **Date Range Export**: Fetch and export invoices by start and end dates directly from Alegra.
* **Post-Generation Export**: Instant export of newly created Type C invoices from the summary modal.
* **Line-Item Expansion**: Expands multi-item invoices into individual export rows.

Status
* [x] Completed
Status

* [x] Completed

---

# Progress Tracker

| Feature Phase | Status |
| --- | --- |
| Phase 1: Authentication | ✅ |
| Phase 2: Fetch Sales Invoices, Table Display & Row Selection | ✅ |
| Phase 3: Selection & Type C Generation | ✅ |
| Phase 4: Results Screen | ✅ |
| Phase 5: Export | ✅ |

---

# Development Rules

* Complete one consolidated phase before starting the next.
* Test every feature before marking it complete.
* Do not duplicate clients (reuse existing Client IDs fetched directly from API).
* Preserve original invoice data.
* **Never modify or delete existing invoices.**
* Always create new Type C invoices.
* Handle API errors gracefully.
* Keep the UI visually identical to Alegra's invoice page.

---

# Development Progress Log

## ✅ Phase 1 Completed

* Server Actions authentication
* HTTP-only cookie session
* Auto login & re-authentication logic

## ✅ Phase 2 Completed

* Connected to `GET /v1/invoices` endpoint
* Shadcn/TanStack Data Table with exact Alegra branding & styling
* Accurate column mappings (`subDocumentType`, `balance`, `status` normalization)
* Search filter & multi-select state engine

## ✅ Phase 3 Completed

* Implemented `recreateAsTypeC` server action for batch generation
* Preserved client IDs, item references, quantities, prices, taxes, and dates
* Added target document type selector in the table action bar
* Added "Download PDF" action in the row dropdown menu

## ✅ Phase 4 Completed

* Implemented `GenerationSummaryDialog` modal triggered immediately post-generation.
* Generated machine-readable CSV manifest (`originalInvoiceId`, `generatedInvoiceId`, timestamps, status, and errors).
* Configured primary CTA to directly download the native Alegra CSV export of newly created Type C invoices.

## ✅ Phase 5 Completed

* Created `mapInvoiceToAlegraExportRow` utility mapping function in `src/lib/export-utils.ts`.
* Implemented native 32-column Alegra CSV exporter with line-item expansion and `sep=;` separator header.
* Implemented flexible export modes inside `ExportDialog`: export currently selected rows OR fetch by Start/End Date Range.
* Fixed Alegra API limit boundary (`limit=30`) for batch/paginated fetching.
* Integrated primary CSV export trigger directly inside `GenerationSummaryDialog`.

---

## ➡️ Next Task
