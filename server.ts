import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import pg from 'pg';

const { Pool } = pg;

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Direct Cloud SQL connection pool
let dbPool: pg.Pool | null = null;

function getDbPool(): pg.Pool | null {
  if (!process.env.SQL_HOST || !process.env.SQL_DB_NAME) {
    return null;
  }
  if (!dbPool) {
    try {
      dbPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
      dbPool.on('error', (err) => {
        console.warn('Unexpected error on idle SQL pool client:', err);
      });
    } catch (e) {
      console.warn('Failed to initialize SQL pool:', e);
      return null;
    }
  }
  return dbPool;
}

async function ensureProductsTable(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      in_stock BOOLEAN DEFAULT TRUE,
      stock_count INTEGER,
      size_stock JSONB,
      is_new_arrival BOOLEAN DEFAULT FALSE,
      sizes JSONB NOT NULL,
      image_url TEXT,
      description TEXT,
      created_at TEXT
    );
  `);
}

async function getDbProducts(): Promise<any[]> {
  const pool = getDbPool();
  if (!pool) return [];
  try {
    await ensureProductsTable(pool);
    const res = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    if (res.rows && res.rows.length > 0) {
      return res.rows.map(r => ({
        id: r.id,
        title: r.title,
        category: r.category,
        price: r.price,
        originalPrice: r.original_price != null ? r.original_price : undefined,
        inStock: r.in_stock !== false,
        stockCount: r.stock_count != null ? r.stock_count : undefined,
        sizeStock: r.size_stock || {},
        isNewArrival: Boolean(r.is_new_arrival),
        sizes: Array.isArray(r.sizes) ? r.sizes : ['Free Size'],
        imageUrl: r.image_url || '',
        description: r.description || '',
        createdAt: r.created_at || new Date().toISOString()
      }));
    }
  } catch (err) {
    console.warn('Database getDbProducts note:', err);
  }
  return [];
}

async function saveDbProducts(products: any[]) {
  const pool = getDbPool();
  if (!pool || !Array.isArray(products) || products.length === 0) return;
  try {
    await ensureProductsTable(pool);
    for (const p of products) {
      await pool.query(`
        INSERT INTO products (
          id, title, category, price, original_price, in_stock, stock_count, size_stock, is_new_arrival, sizes, image_url, description, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          price = EXCLUDED.price,
          original_price = EXCLUDED.original_price,
          in_stock = EXCLUDED.in_stock,
          stock_count = EXCLUDED.stock_count,
          size_stock = EXCLUDED.size_stock,
          is_new_arrival = EXCLUDED.is_new_arrival,
          sizes = EXCLUDED.sizes,
          image_url = EXCLUDED.image_url,
          description = EXCLUDED.description,
          created_at = EXCLUDED.created_at;
      `, [
        p.id,
        p.title,
        p.category,
        p.price,
        p.originalPrice || null,
        p.inStock !== false,
        p.stockCount || null,
        JSON.stringify(p.sizeStock || {}),
        Boolean(p.isNewArrival),
        JSON.stringify(p.sizes || ['Free Size']),
        p.imageUrl || '',
        p.description || '',
        p.createdAt || new Date().toISOString()
      ]);
    }
  } catch (err) {
    console.warn('Database saveDbProducts note:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const isProduction = process.env.NODE_ENV === 'production';
  let vite: any = null;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
  }

  // Explicit route handler for admin paths - guarantees index.html is always served
  // with no 404 regardless of headers or browser/webview user agents
  const adminRoutes = [
    '/admin',
    '/admin/*',
    '/admin-dashboard',
    '/admin-dashboard/*',
    '/admin-portal',
    '/admin-portal/*',
    '/dashboard',
    '/dashboard/*'
  ];

  app.get(adminRoutes, async (req, res, next) => {
    try {
      if (isProduction) {
        return res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      } else {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      }
    } catch (e: any) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  if (!isProduction) {
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
  }

  // Universal Server-side Products API Storage backed by Cloud SQL PostgreSQL & Local File
  const PRODUCTS_FILE_PATH = path.resolve(__dirname, 'products.json');
  const PUBLIC_PRODUCTS_FILE_PATH = path.resolve(__dirname, 'public', 'products.json');

  app.get('/api/products', async (req, res) => {
    try {
      const dbProducts = await getDbProducts();
      if (dbProducts && dbProducts.length > 0) {
        return res.json(dbProducts);
      }
    } catch (e) {}

    try {
      if (fs.existsSync(PRODUCTS_FILE_PATH)) {
        const content = fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.json(parsed);
        }
      }
      if (fs.existsSync(PUBLIC_PRODUCTS_FILE_PATH)) {
        const content = fs.readFileSync(PUBLIC_PRODUCTS_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.json(parsed);
        }
      }
    } catch (e) {}
    res.json([]);
  });

  app.post('/api/products', async (req, res) => {
    try {
      const { products } = req.body;
      if (Array.isArray(products)) {
        try {
          await saveDbProducts(products);
        } catch (dbErr) {
          console.warn('Cloud SQL save note:', dbErr);
        }

        try {
          fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), 'utf-8');
          if (!fs.existsSync(path.dirname(PUBLIC_PRODUCTS_FILE_PATH))) {
            fs.mkdirSync(path.dirname(PUBLIC_PRODUCTS_FILE_PATH), { recursive: true });
          }
          fs.writeFileSync(PUBLIC_PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), 'utf-8');
        } catch (fileErr) {
          console.warn('File save note:', fileErr);
        }

        return res.json({ success: true, count: products.length });
      }
      res.status(400).json({ success: false, error: 'Invalid products array' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GitHub API Proxy & Local products.json sync
  app.get('/api/github/products', async (req, res) => {
    const GITHUB_TOKEN = (req.headers['x-github-token'] as string) || process.env.GITHUB_TOKEN;
    const GITHUB_REPO = (req.headers['x-github-repo'] as string) || process.env.GITHUB_REPO;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      try {
        const localPath = path.resolve(__dirname, 'products.json');
        if (fs.existsSync(localPath)) {
          const content = fs.readFileSync(localPath, 'utf-8');
          return res.json(JSON.parse(content || '[]'));
        }
      } catch (e) {}
      return res.json([]);
    }

    try {
      const { data } = await axios.get(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3.raw' } }
      );
      res.json(data);
    } catch (error: any) {
      try {
        const localPath = path.resolve(__dirname, 'products.json');
        if (fs.existsSync(localPath)) {
          const content = fs.readFileSync(localPath, 'utf-8');
          return res.json(JSON.parse(content || '[]'));
        }
      } catch {}
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/github/update', async (req, res) => {
    const GITHUB_TOKEN = (req.headers['x-github-token'] as string) || process.env.GITHUB_TOKEN;
    const GITHUB_REPO = (req.headers['x-github-repo'] as string) || process.env.GITHUB_REPO;
    const { content, message } = req.body;

    // Always update local products.json file for instant live website availability
    try {
      const localPath = path.resolve(__dirname, 'products.json');
      fs.writeFileSync(localPath, JSON.stringify(content, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Local products.json write note:', err);
    }

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return res.json({ success: true, mode: 'local', message: 'Updated locally (GitHub config not set)' });
    }
    
    try {
      let sha: string | undefined = undefined;
      try {
        const { data: fileData } = await axios.get(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
          { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } }
        );
        if (fileData && typeof fileData.sha === 'string') {
          sha = fileData.sha;
        }
      } catch (e) {}

      const updatePayload: any = {
        message: message || 'Update products via Admin Portal',
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        branch: 'main'
      };
      if (sha && typeof sha === 'string' && sha.trim() !== '') {
        updatePayload.sha = sha;
      }

      await axios.put(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
        updatePayload,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } }
      );
      
      res.json({ success: true, mode: 'github' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Sheets Proxy Routes (avoids browser CORS issues and handles redirects)
  app.get('/api/googlesheets/proxy', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
      const response = await axios.get(url, { maxRedirects: 5 });
      return res.json(response.data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/googlesheets/proxy', async (req, res) => {
    const { url, products } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
      const response = await axios.post(url, products, {
        headers: { 'Content-Type': 'application/json' },
        maxRedirects: 5
      });
      return res.json(response.data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // SPA fallback for all routes including /admin, /admin-dashboard, etc.
  app.get('*', async (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }

    try {
      if (isProduction) {
        return res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      } else {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      }
    } catch (e: any) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.listen(3000, () => console.log('Server running on port 3000'));
}

startServer();
