import { db, createPool } from './index.js';
import { productsTable } from './schema.js';
import { eq } from 'drizzle-orm';
import { Product } from '../types';

async function ensureTable() {
  try {
    const pool = createPool();
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
  } catch (e) {
    console.warn('Auto table creation note:', e);
  }
}

export async function getDbProducts(): Promise<Product[]> {
  try {
    await ensureTable();
    const rows = await db.select().from(productsTable);
    if (rows && rows.length > 0) {
      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        price: r.price,
        originalPrice: r.originalPrice !== null ? r.originalPrice : undefined,
        inStock: r.inStock !== false,
        stockCount: r.stockCount !== null ? r.stockCount : undefined,
        sizeStock: r.sizeStock || {},
        isNewArrival: Boolean(r.isNewArrival),
        sizes: Array.isArray(r.sizes) ? r.sizes : ['Free Size'],
        imageUrl: r.imageUrl || '',
        description: r.description || '',
        createdAt: r.createdAt || new Date().toISOString()
      }));
    }
  } catch (e) {
    console.error('Error fetching products from Cloud SQL:', e);
  }
  return [];
}

export async function saveDbProducts(products: Product[]): Promise<void> {
  try {
    await ensureTable();
    for (const p of products) {
      await db.insert(productsTable)
        .values({
          id: p.id,
          title: p.title,
          category: p.category,
          price: p.price,
          originalPrice: p.originalPrice || null,
          inStock: p.inStock !== false,
          stockCount: p.stockCount || null,
          sizeStock: p.sizeStock || {},
          isNewArrival: Boolean(p.isNewArrival),
          sizes: p.sizes || ['Free Size'],
          imageUrl: p.imageUrl || '',
          description: p.description || '',
          createdAt: p.createdAt || new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: productsTable.id,
          set: {
            title: p.title,
            category: p.category,
            price: p.price,
            originalPrice: p.originalPrice || null,
            inStock: p.inStock !== false,
            stockCount: p.stockCount || null,
            sizeStock: p.sizeStock || {},
            isNewArrival: Boolean(p.isNewArrival),
            sizes: p.sizes || ['Free Size'],
            imageUrl: p.imageUrl || '',
            description: p.description || '',
            createdAt: p.createdAt || new Date().toISOString()
          }
        });
    }
  } catch (e) {
    console.error('Error saving products to Cloud SQL:', e);
    throw new Error('Failed to save products to Cloud SQL', { cause: e });
  }
}

export async function deleteDbProduct(id: string): Promise<void> {
  try {
    await ensureTable();
    await db.delete(productsTable).where(eq(productsTable.id, id));
  } catch (e) {
    console.error('Error deleting product from Cloud SQL:', e);
  }
}
