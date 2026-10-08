import { pgTable, text, real, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const productsTable = pgTable('products', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  price: real('price').notNull(),
  originalPrice: real('original_price'),
  inStock: boolean('in_stock').default(true),
  stockCount: integer('stock_count'),
  sizeStock: jsonb('size_stock'),
  isNewArrival: boolean('is_new_arrival').default(false),
  sizes: jsonb('sizes').notNull(),
  imageUrl: text('image_url'),
  description: text('description'),
  createdAt: text('created_at'),
});

export const adminTable = pgTable('admin_credentials', {
  username: text('username').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  isSetupComplete: boolean('is_setup_complete').default(true),
  createdAt: text('created_at'),
  lastLoginAt: text('last_login_at'),
});
