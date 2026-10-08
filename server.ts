import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import { getDbProducts, saveDbProducts } from './src/db/dbProducts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // Universal Server-side Products API Storage backed by Cloud SQL PostgreSQL
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
        return res.json(JSON.parse(content || '[]'));
      }
      if (fs.existsSync(PUBLIC_PRODUCTS_FILE_PATH)) {
        const content = fs.readFileSync(PUBLIC_PRODUCTS_FILE_PATH, 'utf-8');
        return res.json(JSON.parse(content || '[]'));
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
          console.warn('Cloud SQL save warning:', dbErr);
        }

        fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), 'utf-8');
        try {
          if (!fs.existsSync(path.dirname(PUBLIC_PRODUCTS_FILE_PATH))) {
            fs.mkdirSync(path.dirname(PUBLIC_PRODUCTS_FILE_PATH), { recursive: true });
          }
          fs.writeFileSync(PUBLIC_PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), 'utf-8');
        } catch {}

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
        { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3.raw' } }
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
      console.warn('Local products.json write error:', err);
    }

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return res.json({ success: true, mode: 'local', message: 'Updated locally (GitHub config not set)' });
    }
    
    try {
      // 1. Get SHA of existing file
      let sha: string | undefined = undefined;
      try {
        const { data: fileData } = await axios.get(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
          { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );
        if (fileData && typeof fileData.sha === 'string') {
          sha = fileData.sha;
        }
      } catch (e) {}

      // 2. Update file on GitHub
      const updatePayload: any = {
        message: message || 'Update products via Admin Portal',
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64')
      };
      if (sha && typeof sha === 'string' && sha.trim() !== '') {
        updatePayload.sha = sha;
      }

      await axios.put(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
        updatePayload,
        { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
      );
      
      res.json({ success: true, mode: 'github' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Verification endpoint for Admin Portal verification process
  app.post('/api/github/verify', async (req, res) => {
    const { token, repo } = req.body;
    const GITHUB_TOKEN = token || process.env.GITHUB_TOKEN;
    const GITHUB_REPO = repo || process.env.GITHUB_REPO;

    const result = {
      hasToken: !!GITHUB_TOKEN,
      hasRepo: !!GITHUB_REPO,
      repoAccess: false,
      readSuccess: false,
      writeSuccess: false,
      error: null as string | null
    };

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      result.error = 'GitHub Token and Repository (owner/repo) are required.';
      return res.json(result);
    }

    try {
      const repoCheck = await axios.get(
        `https://api.github.com/repos/${GITHUB_REPO}`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
      );
      if (repoCheck.status === 200) {
        result.repoAccess = true;
      }

      try {
        await axios.get(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
          { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );
        result.readSuccess = true;
      } catch {
        result.readSuccess = true; // file can be created on first write
      }

      const timestamp = new Date().toISOString();
      const testPing = [{ id: 'verify-ping', title: `Sync Verification ${timestamp}`, price: 99, category: 'Fusion Wear', inStock: true, sizes: ['Free Size'], imageUrl: '', description: 'Verification test' }];

      let sha: string | undefined = undefined;
      try {
        const { data: fileData } = await axios.get(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
          { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );
        sha = fileData.sha;
      } catch {}

      await axios.put(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/products.json`,
        {
          message: `Verification test sync at ${timestamp}`,
          content: Buffer.from(JSON.stringify(testPing, null, 2)).toString('base64'),
          ...(sha ? { sha } : {})
        },
        { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
      );
      result.writeSuccess = true;

      res.json(result);
    } catch (e: any) {
      result.error = e.message || 'GitHub verification failed';
      res.json(result);
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
  // Guarantees no 404 on direct browser navigation or refresh
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
