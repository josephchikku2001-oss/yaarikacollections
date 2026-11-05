# Catalog Reset & Real-Time Admin Product Management Plan

Clean out all existing hardcoded and sample products from the website, provide a minimal blank catalog state, establish permanent live publishing when the admin adds products, ensure permanent removal when products are deleted, and add a floating quick-access button for the Admin Portal.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following requirements and user choices are integrated into this plan:

- **Confirmed Decision 1 (Empty State)**: Minimal blank catalog section until the first product is added by the admin. When zero products exist, display a clean, quiet boutique note ("Curating New Collection · Inquiries Open") with an authentic WhatsApp contact link, without any distracting clutter or mock data.
- **Confirmed Decision 2 (Admin Portal Access)**: Floating quick-access button at the bottom of the screen (`bottom-6 right-6`), styled with subtle Kerala boutique gold and dark accents, allowing rapid access to the Admin Portal on both desktop and mobile.
- **Permanent Live Persistence**: When the admin adds a product, it is immediately written to both server-side JSON storage (`/api/products`) and Cloud SQL PostgreSQL (if configured), plus client IndexedDB/localStorage. It becomes live for all visitors immediately.
- **Permanent Deletion Setup**: When the admin deletes a product, it is deleted from server disk, deleted from the database table (`DELETE FROM products WHERE id = $1`), purged from client stores, and blacklisted from legacy cache resurrection.

---

## 1. Overview & Core Concept

- **What It Does**: Wipes out all hardcoded sample items (`prod-sample-01` through `05` and verification test items) to give the store owner a clean slate. Provides seamless live publishing so whatever the admin uploads or edits via the Admin Portal stays permanently live on the website across browser refreshes, tabs, and visitor sessions. When any product is deleted in the admin portal, it is immediately and permanently purged from the live catalog.
- **Target Audience**: Yaarika Boutique administrator managing custom handcrafted Kerala ensembles (Sarees, Co-ord Sets, Churidar Sets, Fusion Wear) and customers browsing the storefront.
- **Key Value**: 100% genuine inventory control with zero ghost items, instant live updates, and dependable server-persisted storage.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[ Visitor View ] 
       │
       ├─── If 0 Products: Quiet minimal state ("Curating New Collection") + WhatsApp Inquiry
       └─── If Products Exist: Luxury 3-column / 2-column grid with image-led cards, price, size picker
       
[ Admin User ]
       │
       ├─── Clicks Floating Admin Button (bottom-right floating badge)
       ├─── Logs into Admin Portal (Master Credentials or Firebase Auth)
       ├─── Adds Product (Photo upload/URL, Title, Category, Price, Sizes, Stock)
       │       └──> Click "Save" ──> Instantly live on website & persisted in backend
       └─── Deletes Product
               └──> Click "Delete" ──> Confirmed ──> Permanently removed from server & site
```

### Visual Identity & Theme
- **Color Palette**: 
  - Primary Canvas: Ivory & warm paper (`#FAF7F2` / `#FFFFFF`)
  - Primary Typography: Deep charcoal slate (`#1C1917` / `#292524`)
  - Accent Tones: Authentic Kerala Gold (`#B78103` / `#D4AF37`) & Deep Temple Maroon (`#7F1D1D`)
- **Typography**: Refined high-contrast serif (`Playfair Display`) paired with clean modern body typography (`Plus Jakarta Sans`), with monospace tabular figures (`font-mono tabular-nums`) for currency and inventory counts.
- **Floating Admin Button**: Refined circular/pill floating button with a discreet lock/settings icon, luxury gold border, subtle backdrop blur, and accessible touch target ($\ge 44\text{px}$).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Emptying Hardcoded Catalogs & Storage Keys**
  - *Chosen Approach*: Clear `src/data/initialProducts.ts` to `[]`, clear `products.json` and `public/products.json` to `[]`, and introduce a cache invalidation migration flag in `src/services/storage.ts` so browsers clean out stale demo items.
  - *Why*: Ensures sample test items never re-appear if a user opens the page in incognito or clears storage.
- **Decision 2: Complete Server-Side Deletion & Sync**
  - *Chosen Approach*: Add `DELETE /api/products/:id` to `server.ts` and modify `saveDbProducts` / `/api/products` POST handler to perform full synchronization with the PostgreSQL database (deleting rows that are no longer in the catalog, rather than only doing `ON CONFLICT DO UPDATE`).
  - *Why*: Previously, deleted products remained stored in PostgreSQL and were reloaded into memory whenever the server restarted.
- **Decision 3: Zero-State Layout**
  - *Chosen Approach*: Minimal, elegant boutique placeholder in `src/App.tsx` when `products.length === 0`.
  - *Why*: Matches the user's explicit preference ("Minimal blank catalog section until first product is added") while maintaining high luxury standards.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Storefront (React + Vite)                │
│                                                             │
│   ┌───────────────────────┐       ┌──────────────────────┐  │
│   │   Catalog Section     │       │ Floating Admin CTA   │  │
│   │ (Live Products Grid)  │       │ (Bottom-Right Fixed) │  │
│   └───────────▲───────────┘       └───────────┬──────────┘  │
└───────────────┼───────────────────────────────┼─────────────┘
                │ Broadcast Event               │ Opens
                │ (yaarika_products_updated)    │
┌───────────────┴───────────────────────────────▼─────────────┐
│               Admin Portal & Product Storage                │
│   • Add Product / Bulk Import / Multi-Layer Creator         │
│   • Edit Details & Live Inventory Steppers                  │
│   • Delete Product (Confirmation Modal)                     │
└───────────────┬───────────────────────────────┬─────────────┘
                │ Fetch / Sync                  │ POST / DELETE
                ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Express Server (/server.ts)                 │
│                                                             │
│   GET  /api/products       -> Read JSON file / SQL DB       │
│   POST /api/products       -> Atomic write to products.json │
│                                & public/products.json       │
│                                & Cloud SQL PostgreSQL sync  │
│   DELETE /api/products/:id -> Delete from products.json &   │
│                                SQL DB table                 │
└─────────────────────────────────────────────────────────────┘
```

### Component & File Modification Plan

1. **`src/data/initialProducts.ts`**:
   - Set `INITIAL_PRODUCTS = []`.
2. **`products.json` & `public/products.json`**:
   - Reset contents to clean empty array `[]`.
3. **`server.ts`**:
   - Implement `DELETE /api/products/:id` route handler.
   - Update `saveDbProducts` to delete rows from PostgreSQL `products` table where `id NOT IN (...)` (or truncate and re-insert active products) so deleted products don't resurrect from SQL.
   - Update `POST /api/products` to accept empty array `[]` cleanly when all products are cleared.
4. **`src/services/storage.ts`**:
   - Update `loadInitialCatalog` so it returns `[]` when no items are present, without injecting legacy sample items.
   - Invalidate old cache version (`yaarika_products_v12`) to ensure any visitor with old sample items cached in localStorage has their cache cleared.
   - Ensure `deleteProduct(id)` fires `DELETE /api/products/${id}` to the server in addition to updating local IndexedDB and localStorage.
   - Ensure `addProduct` and `updateProduct` save to `/api/products` immediately.
5. **`src/App.tsx`**:
   - Render the minimal blank catalog placeholder when `products.length === 0`.
   - Add the floating quick-access Admin Portal button fixed at `bottom-6 right-6`.
6. **`src/components/AdminPortal.tsx`**:
   - Ensure deleting a product cleanly calls `ProductStorage.deleteProduct` and refreshes both local and parent app state.
   - Ensure adding a product immediately pushes to the live catalog without requiring manual steps.

---

## 5. Verification Steps

1. **Compilation Check**: Run `compile_applet` to verify no TypeScript or lint regressions.
2. **Catalog Empty State**: Verify that visiting the home page shows zero sample products and displays the minimal clean zero-state section.
3. **Floating Admin Button**: Verify the floating button appears at the bottom-right and opens the Admin Portal smoothly.
4. **Live Product Creation**: Add a test product in the Admin Portal, verify it appears instantly on the live website and persists after a full browser reload.
5. **Live Product Deletion**: Delete the product from the Admin Portal, verify it vanishes immediately from the website, does not return after reload, and is erased from server storage.
