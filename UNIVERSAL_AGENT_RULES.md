# 🛡️ UNIVERSAL AGENT RULES — ZERO HALF-MEASURES & 360° END-TO-END EXECUTION

> **Scope**: Universal guideline for all AI coding agents across all repositories.  
> **Core Directive**: An AI agent must **NEVER** perform partial ("half-baked") work. Any requested change, fix, or feature must be executed across the **entire stack** (from UI to Backend, Database, Export engines, PDF generators, and Auxiliary portals).

---

## 🚨 1. THE CARDINAL LAW: ZERO HALF-WORK (NO LOCAL HORIZON BIAS)

AI agents frequently suffer from **"Local Horizon Bias"** — modifying only the active file or visual UI component while ignoring export engines, PDF templates, backend handlers, and companion portals.

### 🛑 STRICT PROHIBITION:
- **NEVER** modify a UI component without checking and updating its corresponding **PDF template, print stylesheets, vector generators, or export services**.
- **NEVER** add or update a frontend form field without updating the **backend API routes, request validation, database schemas/models, and data migrations**.
- **NEVER** fix a bug in one place (e.g., student module) and leave identical flawed logic in related places (e.g., staff/teacher modules).
- **NEVER** assume a task is finished just because the code compiles. You must verify the complete end-to-end data lifecycle.

---

## 🌐 2. THE 6-LAYER SURFACE AREA MAPPING (MANDATORY TRACE)

Whenever the user asks to add, fix, modify, or restyle any entity (e.g. ID card, fee receipt, attendance record, profile field, auth token), the agent **MUST systematically trace and update all 6 layers**:

| Layer | Surface Area | What Must Be Checked & Updated |
| :--- | :--- | :--- |
| **Layer 1: UI Presentation** | Frontend Components, Modals, Forms, Previews | Colors, layouts, form inputs, typography, responsive preview states. |
| **Layer 2: Document & Export** | PDF Generators (`pdfTemplate`, Puppeteer, wkhtmltopdf), Print CSS (`@media print`), Canvas, SVG, Excel/CSV Exporters | PDF vector rendering, barcode/QR encoders, print media visibility, margins, paper sizing (A4, CR80, thermal). |
| **Layer 3: Client State & IPC** | React hooks, Redux/Zustand, Electron IPC, WebSocket handlers | State synchronization, payload assembly, cache invalidation. |
| **Layer 4: Backend API & Validation** | REST endpoints, GraphQL resolvers, Express/Fastify routes, Joi/Zod validators | Input sanitation, route handlers, error responses, status codes. |
| **Layer 5: Database & Persistence** | MongoDB Mongoose models, SQL schemas, default values, query indexing, migration scripts | Schema fields, fallback values, relations, cascade rules. |
| **Layer 6: Peripheral & Portals** | Mobile PWAs, Parent/Student/Staff portals, Hardware push listeners, Notification engines (SMS/WhatsApp) | Secondary portals displaying the entity, webhook listeners, push alerts. |

---

## 🔍 3. THE MANDATORY PRE-COMPLETION GREP AUDIT

Before declaring ANY task complete, the agent **MUST run programmatic searches (`grep_search`)** to discover all parallel implementations and references across the codebase.

### Example Search Pattern Checklist:
If the user says: *"Update the staff ID card QR code and colors"*:
1. `grep "StaffIdCard"` -> Find all UI components rendering staff cards.
2. `grep "pdfTemplate"` / `grep "printToPDF"` -> Find all vector/PDF generation templates.
3. `grep "QRCode"` / `grep "Barcode"` -> Find all QR encoders to ensure encoded payload format matches everywhere.
4. `grep "@media print"` -> Find CSS rules controlling physical printing.
5. `grep "handleScan"` / `grep "scanner"` -> Find kiosk/scanner desk listeners to ensure scanner expects the same QR format.

> **Rule**: If an entity is rendered in `Component.jsx` AND exported via `template.cjs` / `exportService.py`, **BOTH MUST BE UPDATED SIMULTANEOUSLY**. Leaving one behind is considered a critical agent failure.

---

## 🖨️ 4. THE DUAL-SYNC MANDATE (SCREEN PREVIEW ⮂ PHYSICAL PRINT/PDF)

Users expect that **what they see on screen is 100% identical to what prints or exports to PDF**.

1. **Colors & Gradients**: If the card/document is changed to Blue & White with Red headers on the UI, the PDF generator must use the identical hex codes (`#2563eb`, `#dc2626`).
2. **QR / Barcode Encodings**: If the UI QR encodes `STAFF_101`, the PDF export QR MUST encode `STAFF_101` (never raw `101` in one and prefixed in the other).
3. **Dimensions & Margins**: Physical dimensions (e.g. CR80 55.26mm × 86.58mm) must be mathematically synchronized between CSS pixels and PDF millimeter bounding boxes.
4. **Duplex / Double-Sided Alignment**: Verify front and back faces align properly when flipped along the short or long edge.

---

## 🧪 5. SCRIPT-FIRST AUTOMATED VERIFICATION GATE

Never claim a task is fixed based on visual guesswork.

1. **Write Standalone Verification Script**: Create a short diagnostic script in `scratch/verify_*.js` / `.py`.
2. **Execute & Assert**:
   - For backend/data changes: Send mock requests or query mock records and assert return types and values.
   - For PDF/HTML changes: Generate sample HTML, inspect the output string for exact expected CSS values, SVG path data, and encoded text.
3. **Run Pre-Flight Audit / Test Suite**: Run the repository's test suite or audit scripts (`npm test`, `verify_all_api.js`, `master-production-audit.js`).
4. **Clean Up Scratch Files**: Delete temporary test scripts before concluding.

---

## 📋 6. AGENT PRE-FINISH SELF-INTERROGATION CHECKLIST

Before writing the final response to the user, the agent MUST ask itself these 6 questions:

- [ ] **Did I only fix the UI?** If yes, where is the PDF/print/export logic? Go fix it now.
- [ ] **Did I only fix the backend?** If yes, did I update the frontend form and table columns? Go update them now.
- [ ] **Are there duplicate/parallel roles or entities?** (e.g. Student vs Staff vs Teacher). If I changed one, does the other need the same improvement?
- [ ] **Did I search the codebase for all occurrences of the feature?** (`grep_search`).
- [ ] **Did I prove it works with automated execution or a verification test?**
- [ ] **Did I avoid making assumptions?** If something is underspecified, verify against active code patterns rather than guessing.

---

## 🔒 7. UNIVERSAL SAFETY & COMPLIANCE CONSTRAINTS

- **No Blind Overwrites**: Never replace entire files when only localized changes are needed.
- **Preserve Unrelated Comments & Configs**: Do not wipe existing configuration, environment variables, or third-party auth directories.
- **Git & Build Protection**: Never run `git push`, publish releases, or execute destructive deployment scripts without explicit, real-time user confirmation.
- **Version Lock Compliance**: Adhere strictly to the project's locked version number unless specifically told to bump it.
