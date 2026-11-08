import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'server_data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SHEET_CONFIG_FILE = path.join(DATA_DIR, 'sheet_config.json');

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper functions for file storage
function readProductsFromFile(): any[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading products file:', err);
  }
  return [];
}

function writeProductsToFile(products: any[]): void {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing products file:', err);
  }
}

interface SheetConfig {
  spreadsheetId: string;
  appsScriptUrl?: string;
  sheetTab: string;
  autoSync: boolean;
  lastSync: string | null;
  lastUpdated?: string;
}

function readSheetConfig(): SheetConfig {
  try {
    if (fs.existsSync(SHEET_CONFIG_FILE)) {
      const raw = fs.readFileSync(SHEET_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading sheet config:', err);
  }
  return { spreadsheetId: '', appsScriptUrl: '', sheetTab: 'Sheet1', autoSync: true, lastSync: null };
}

function writeSheetConfig(config: Partial<SheetConfig>): SheetConfig {
  try {
    const current = readSheetConfig();
    const updated = {
      ...current,
      ...config,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(SHEET_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Error writing sheet config:', err);
    return readSheetConfig();
  }
}

// Convert Product object to Google Sheet row
function productToRow(p: any): (string | number)[] {
  const sizes = Array.isArray(p.sizes) ? p.sizes.join(', ') : 'M, L, XL, XXL';
  return [
    p.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    p.title || '',
    p.category || 'Traditional Sarees',
    typeof p.price === 'number' ? p.price : (parseFloat(String(p.price)) || 999),
    p.originalPrice ? (typeof p.originalPrice === 'number' ? p.originalPrice : parseFloat(String(p.originalPrice)) || '') : '',
    sizes,
    p.description || '',
    p.fabricDetails || '',
    p.imageUrl || '',
    p.inStock !== false ? 'TRUE' : 'FALSE',
    p.featured ? 'TRUE' : 'FALSE',
    p.isNewArrival ? 'TRUE' : 'FALSE',
    p.createdAt || new Date().toISOString()
  ];
}

// Convert Google Sheet row array back to Product object
function rowToProduct(row: any[], index: number): any | null {
  if (!row || row.length < 2) return null;

  const id = String(row[0] || '').trim() || `gs-prod-${Date.now()}-${index}`;
  const title = String(row[1] || '').trim();
  if (!title || title.toLowerCase() === 'title' || title.toLowerCase() === 'product title') return null; // skip headers

  const category = String(row[2] || '').trim() || 'Traditional Sarees';
  const price = Math.max(0, parseFloat(String(row[3]).replace(/[^0-9.]/g, '')) || 999);
  const origPriceRaw = row[4] ? parseFloat(String(row[4]).replace(/[^0-9.]/g, '')) : undefined;
  const originalPrice = origPriceRaw && !isNaN(origPriceRaw) && origPriceRaw > 0 ? origPriceRaw : undefined;

  const sizesStr = String(row[5] || '').trim();
  const sizes = sizesStr 
    ? sizesStr.split(/[,|/]/).map((s: string) => s.trim()).filter(Boolean)
    : ['M', 'L', 'XL', 'XXL'];

  const description = String(row[6] || '').trim() || `${title} from Yaarika Collections.`;
  const fabricDetails = String(row[7] || '').trim();
  const imageUrl = String(row[8] || '').trim() || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80';

  const inStockStr = String(row[9] || '').toUpperCase();
  const inStock = inStockStr !== 'FALSE' && inStockStr !== '0' && inStockStr !== 'NO';

  const featuredStr = String(row[10] || '').toUpperCase();
  const featured = featuredStr === 'TRUE' || featuredStr === '1' || featuredStr === 'YES';

  const newArrivalStr = String(row[11] || '').toUpperCase();
  const isNewArrival = newArrivalStr === 'TRUE' || newArrivalStr === '1' || newArrivalStr === 'YES';

  const sizeStock: Record<string, number> = {};
  sizes.forEach((s: string) => {
    sizeStock[s] = inStock ? 5 : 0;
  });

  return {
    id,
    title,
    category,
    price,
    originalPrice,
    sizes,
    stockCount: sizes.length * (inStock ? 5 : 0),
    sizeStock,
    description,
    fabricDetails,
    imageUrl,
    inStock,
    featured,
    isNewArrival,
    createdAt: row[12] ? String(row[12]) : new Date().toISOString()
  };
}

// Extract Spreadsheet ID from standard URL or bare ID
function extractSpreadsheetId(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return trimmed;
}

// Server-side fetch from Google Sheet (via Apps Script Web App or Public CSV / GViz)
async function syncFromGoogleSheet(): Promise<{ success: boolean; products: any[]; error?: string }> {
  const config = readSheetConfig();
  const { appsScriptUrl, spreadsheetId, sheetTab } = config;

  // 1. Try Apps Script Web App (100% Free, no login, full read/write)
  if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        let rows: any[][] = [];
        if (Array.isArray(data)) {
          rows = data;
        } else if (data && Array.isArray(data.values)) {
          rows = data.values;
        } else if (data && Array.isArray(data.rows)) {
          rows = data.rows;
        }

        if (rows.length > 0) {
          const products: any[] = [];
          rows.forEach((r, idx) => {
            const p = rowToProduct(r, idx);
            if (p) products.push(p);
          });

          if (products.length > 0) {
            writeProductsToFile(products);
            writeSheetConfig({ lastSync: new Date().toISOString() });
            return { success: true, products };
          }
        }
      }
    } catch (err: any) {
      console.warn('Apps Script sync warning:', err.message);
    }
  }

  // 2. Try Public Google Sheet CSV Export or GViz API
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (cleanId) {
    try {
      const tabName = sheetTab || 'Sheet1';
      // URL for public sheets CSV export
      const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(csvUrl);
      if (response.ok) {
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(l => l.trim().length > 0);
        if (lines.length > 1) {
          const products: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            // Basic CSV row splitter respecting quotes
            const rowValues: string[] = [];
            let inQuotes = false;
            let current = '';
            for (let j = 0; j < lines[i].length; j++) {
              const char = lines[i][j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                rowValues.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                current = '';
              } else {
                current += char;
              }
            }
            rowValues.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

            const p = rowToProduct(rowValues, i);
            if (p) products.push(p);
          }

          if (products.length > 0) {
            writeProductsToFile(products);
            writeSheetConfig({ lastSync: new Date().toISOString() });
            return { success: true, products };
          }
        }
      }
    } catch (err: any) {
      console.warn('Public CSV sheet sync warning:', err.message);
    }
  }

  return { success: false, products: [], error: 'Could not fetch products from Google Sheet.' };
}

// Push / Append rows directly to Google Apps Script Web App
async function appendRowsToAppsScript(appsScriptUrl: string, rows: (string | number)[][]): Promise<boolean> {
  if (!appsScriptUrl || !appsScriptUrl.startsWith('http') || rows.length === 0) return false;
  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'append', rows })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to append rows to Apps Script:', err);
    return false;
  }
}

// Track last automated sync timestamp
let lastAutoSyncTime = 0;
const AUTO_SYNC_INTERVAL_MS = 20 * 1000; // 20 seconds cache TTL

// ================= API ROUTES =================

// 1. Get all products (Available to ANY visitor on ANY system - Auto-syncs with Google Sheet)
app.get('/api/products', async (req: Request, res: Response) => {
  const forceSync = req.query.forceSync === 'true' || req.query.refresh === 'true';
  const now = Date.now();
  const config = readSheetConfig();

  // If Google Sheet is configured and interval expired (or forced), sync with Google Sheet first!
  const hasSheetConfig = Boolean(config.appsScriptUrl || config.spreadsheetId);
  if (hasSheetConfig && (forceSync || (now - lastAutoSyncTime > AUTO_SYNC_INTERVAL_MS))) {
    lastAutoSyncTime = now;
    try {
      const syncRes = await syncFromGoogleSheet();
      if (syncRes.success && syncRes.products.length > 0) {
        return res.json({ 
          success: true, 
          count: syncRes.products.length, 
          products: syncRes.products, 
          source: 'google_sheets',
          lastSync: new Date().toISOString() 
        });
      }
    } catch (e) {
      console.warn('Background sheet auto-sync skipped:', e);
    }
  }

  const products = readProductsFromFile();
  res.json({ success: true, count: products.length, products, source: 'cache' });
});

// 2. Add product (Single or Bulk) - Automatically saves locally AND appends to Google Sheet!
app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    let products = readProductsFromFile();
    const config = readSheetConfig();

    let newItemsToAppend: any[] = [];

    if (Array.isArray(payload)) {
      // Bulk add
      const newItems = payload.map((p, idx) => ({
        ...p,
        id: p.id || `prod-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: p.createdAt || new Date().toISOString()
      }));
      products = [...newItems, ...products.filter(p => !newItems.some(n => n.id === p.id))];
      writeProductsToFile(products);
      newItemsToAppend = newItems;
    } else if (payload && typeof payload === 'object') {
      // Single add
      const newItem = {
        ...payload,
        id: payload.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: payload.createdAt || new Date().toISOString()
      };
      products = [newItem, ...products.filter(p => p.id !== newItem.id)];
      writeProductsToFile(products);
      newItemsToAppend = [newItem];
    } else {
      return res.status(400).json({ success: false, error: 'Invalid product payload' });
    }

    // Auto-append to Google Sheet via Apps Script Web App if configured!
    if (config.appsScriptUrl && newItemsToAppend.length > 0 && config.autoSync !== false) {
      const rows = newItemsToAppend.map(productToRow);
      appendRowsToAppsScript(config.appsScriptUrl, rows).catch(err => {
        console.warn('Background Apps Script append warning:', err);
      });
    }

    return res.json({ 
      success: true, 
      added: newItemsToAppend.length, 
      total: products.length, 
      products 
    });
  } catch (err: any) {
    console.error('Error adding product(s):', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Update product
app.put('/api/products/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    let products = readProductsFromFile();

    let found = false;
    products = products.map(p => {
      if (p.id === id) {
        found = true;
        return { ...p, ...updateData, id };
      }
      return p;
    });

    if (!found) {
      products.unshift({ ...updateData, id });
    }

    writeProductsToFile(products);
    return res.json({ success: true, products });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Delete product
app.delete('/api/products/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let products = readProductsFromFile();
    products = products.filter(p => p.id !== id);
    writeProductsToFile(products);
    return res.json({ success: true, remaining: products.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Clear all products
app.post('/api/products/clear', (req: Request, res: Response) => {
  try {
    writeProductsToFile([]);
    return res.json({ success: true, count: 0 });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Replace all products (e.g. Pull from Google Sheet or Excel full sync)
app.post('/api/products/replace-all', (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, error: 'products must be an array' });
    }
    writeProductsToFile(products);
    return res.json({ success: true, count: products.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get shared Google Sheet configuration
app.get('/api/sheet-config', (req: Request, res: Response) => {
  const config = readSheetConfig();
  res.json({ success: true, config });
});

// 8. Update shared Google Sheet configuration & trigger immediate initial sync
app.post('/api/sheet-config', async (req: Request, res: Response) => {
  try {
    const updated = writeSheetConfig(req.body);

    // If new spreadsheet ID or appsScriptUrl provided, trigger immediate sync in background
    if (updated.spreadsheetId || updated.appsScriptUrl) {
      syncFromGoogleSheet().catch(() => {});
    }

    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Manual Sync Trigger (Pull directly from Google Sheet to Website)
app.post('/api/sheet/sync-now', async (req: Request, res: Response) => {
  try {
    const result = await syncFromGoogleSheet();
    if (result.success) {
      return res.json({ success: true, count: result.products.length, products: result.products });
    }
    return res.status(400).json({ success: false, error: result.error || 'Failed to sync from Google Sheet.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Push All Products to Google Apps Script Web App
app.post('/api/sheet/push-all', async (req: Request, res: Response) => {
  try {
    const config = readSheetConfig();
    if (!config.appsScriptUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Google Apps Script Web App URL is not configured. Please paste your Web App URL in Google Sheets settings.' 
      });
    }

    const products = readProductsFromFile();
    const rows = products.map(productToRow);

    const headers = [
      'Product ID', 'Title', 'Category', 'Price (₹)', 'Original Price (₹)',
      'Sizes', 'Description', 'Fabric Details', 'Image URL', 'In Stock',
      'Featured', 'New Arrival', 'Updated At'
    ];

    const allRows = [headers, ...rows];

    const response = await fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'replaceAll', rows: allRows })
    });

    if (response.ok) {
      writeSheetConfig({ lastSync: new Date().toISOString() });
      return res.json({ success: true, count: products.length });
    } else {
      const errText = await response.text();
      return res.status(500).json({ success: false, error: errText || 'Failed to update Google Sheet' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. CORS Proxy for Apps Script (eliminates cross-origin issues in browser)
app.post('/api/sheet/proxy-appsscript', async (req: Request, res: Response) => {
  try {
    const config = readSheetConfig();
    const targetUrl = req.body.url || config.appsScriptUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'No valid Apps Script URL provided.' });
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body.payload || {})
    });

    const data = await response.json().catch(async () => ({ text: await response.text() }));
    return res.json({ success: response.ok, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ================= VITE DEV MIDDLEWARE OR STATIC SERVING =================
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from dist directory in production
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Yaarika Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
