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

function readSheetConfig(): { spreadsheetId: string; sheetTab: string; autoSync: boolean; lastSync: string | null } {
  try {
    if (fs.existsSync(SHEET_CONFIG_FILE)) {
      const raw = fs.readFileSync(SHEET_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading sheet config:', err);
  }
  return { spreadsheetId: '', sheetTab: 'Sheet1', autoSync: true, lastSync: null };
}

function writeSheetConfig(config: { spreadsheetId: string; sheetTab: string; autoSync: boolean; lastSync?: string | null }): void {
  try {
    fs.writeFileSync(SHEET_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing sheet config:', err);
  }
}

// ================= API ROUTES =================

// 1. Get all products (Available to ANY visitor on ANY system)
app.get('/api/products', (req: Request, res: Response) => {
  const products = readProductsFromFile();
  res.json({ success: true, count: products.length, products });
});

// 2. Add product (Single or Bulk)
app.post('/api/products', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    let products = readProductsFromFile();

    if (Array.isArray(payload)) {
      // Bulk add
      const newItems = payload.map((p, idx) => ({
        ...p,
        id: p.id || `prod-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: p.createdAt || new Date().toISOString()
      }));
      // Prepend to catalog so new items appear first
      products = [...newItems, ...products.filter(p => !newItems.some(n => n.id === p.id))];
      writeProductsToFile(products);
      return res.json({ success: true, added: newItems.length, total: products.length, products });
    } else if (payload && typeof payload === 'object') {
      // Single add
      const newItem = {
        ...payload,
        id: payload.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: payload.createdAt || new Date().toISOString()
      };
      products = [newItem, ...products.filter(p => p.id !== newItem.id)];
      writeProductsToFile(products);
      return res.json({ success: true, product: newItem, total: products.length, products });
    }

    return res.status(400).json({ success: false, error: 'Invalid product payload' });
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
      // If not found, add it
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

// 7. Get shared Google Sheet configuration (Spreadsheet ID shared with ALL visitors/systems)
app.get('/api/sheet-config', (req: Request, res: Response) => {
  const config = readSheetConfig();
  res.json({ success: true, config });
});

// 8. Update shared Google Sheet configuration
app.post('/api/sheet-config', (req: Request, res: Response) => {
  try {
    const current = readSheetConfig();
    const updated = {
      ...current,
      ...req.body,
      lastUpdated: new Date().toISOString()
    };
    writeSheetConfig(updated);
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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
