# Alegra Type C Invoice Generator

## Project Overview

This application is a lightweight internal tool that allows the client to recreate existing Alegra invoices as **Type C** invoices.

Instead of importing invoices from Excel, the application connects directly to the Alegra account, fetches existing invoices, allows the user to select which invoices should be recreated, and generates new Type C invoices using the appropriate Number Template.

The UI should closely resemble the native Alegra Sales Invoice page to minimize the learning curve for the client.

---

# Primary Goal

Convert existing Type B invoices into Type C invoices.

The application **does not modify** existing invoices.

Instead it:

- Fetches existing invoices
- Lets the user select which invoices to recreate
- Creates new Type C invoices
- Exports the generated invoices in the same format provided by Alegra

---

# User Flow

```
Login
    ↓
Authenticate with Alegra
    ↓
Fetch Sales Invoices
    ↓
Display Invoice Table
    ↓
User Selects Invoices
    ↓
Generate Type C Invoices
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

- Username (Email)
- API Token / Password

After successful authentication:

- Verify credentials
- Store session securely
- Load invoices

Status

- [x] Completed

---

## Phase 2 — Fetch Sales Invoices

### Goal

Retrieve invoices directly from Alegra.

Display information similar to the native Alegra interface.

Columns

- Type
- Number
- Client
- Creation
- Due Date
- Total
- Status

Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed

---

## Phase 3 — Invoice List UI

### Goal

Create a UI that closely matches:

https://app.alegra.com/invoice

Features

- Search
- Filters
- Pagination
- Checkbox selection
- Select All

Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed

---

## Phase 4 — Selection

### Goal

Allow the user to decide which invoices should be recreated.

Selection methods

- Individual selection
- Select All

Only the selected invoices should be recreated.

Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed

---

## Phase 5 — Client Resolution

For every selected invoice

```
Read Original Invoice
        ↓
Find Existing Client
        ↓
Reuse Client ID
```

No duplicate contacts should be created.

Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed

---

## Phase 6 — Generate Type C Invoices

Workflow

```
Original Invoice
        ↓
Copy Invoice Data
        ↓
Use Type C Number Template
        ↓
Create New Invoice
```

Requirements

- Same Client
- Same Products
- Same Prices
- Same Taxes
- Same Dates (where applicable)
- Type C Number Template

Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed

---

## Phase 7 — Results

Display

- Original Invoice
- New Invoice
- Client
- Status
- Errors

Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed

---

## Phase 8 — Export

Allow exporting the generated invoices.

Target

Replicate Alegra's native Export functionality as closely as possible.

Possible formats

- Excel (.xlsx)
- CSV (if supported)

The exported file should include the newly generated Type C invoices.

Status

- [ ] Not Started
- [ ] In Progress
- [ ] Completed

---

# Future Improvements

- Retry failed invoice generation
- Bulk PDF download (ZIP)
- Download individual PDFs
- Invoice comparison (Original vs Type C)
- Background processing for large batches
- Audit logs

---

# Progress Tracker

| Feature | Status |
|----------|--------|
| Authentication | ✅ |
| Fetch Invoices | ⬜ |
| Invoice Table UI | ⬜ |
| Invoice Selection | ⬜ |
| Client Resolution | ⬜ |
| Generate Type C | ⬜ |
| Results Screen | ⬜ |
| Export | ⬜ |

---

# Development Rules

- Complete one phase before starting the next.
- Test every feature before marking it complete.
- Do not duplicate clients.
- Preserve original invoice data.
- Never modify existing invoices.
- Always create new Type C invoices.
- Use reusable components.
- Handle API errors gracefully.
- Keep the UI visually close to Alegra's invoice page.

# Development Progress

## ✅ Phase 1 Completed

Implemented:

- Server Actions authentication
- HTTP-only cookie session
- Auto login after refresh
- Re-authentication flow
- Credential persistence
- Automatic session validation

Next:

➡️ Phase 2 — Fetch Sales Invoices