import { Product, AdminCredentials, InquiryLog } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { GoogleSheetsService } from './googleSheetsService';
import { db, OperationType, handleFirestoreError } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';

const KEYS = {
  ADMIN: 'yaarika_admin_credentials_v1',
  PRODUCTS: 'yaarika_products_v12',
  CUSTOM_PRODUCTS: 'yaarika_admin_custom_products_v12',
  CUSTOM_EDITS: 'yaarika_admin_custom_edits_v12',
  DELETED_IDS: 'yaarika_admin_deleted_ids_v12',
  WISHLIST: 'yaarika_wishlist_v1',
  INQUIRIES: 'yaarika_inquiries_v1',
  CATALOG_WIPED_FLAG: 'yaarika_catalog_wiped_v12'
};

export const PRODUCTS_UPDATED_EVENT = 'yaarika_products_updated';

// Simple cryptographic hash function using SHA-256 for browser
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ADMIN AUTHENTICATION SERVICES
export const AdminStorage = {
  // Check if admin setup has been completed
  isSetupComplete(): boolean {
    try {
      const data = localStorage.getItem(KEYS.ADMIN);
      if (!data) return false;
      const parsed: AdminCredentials = JSON.parse(data);
      return parsed.isSetupComplete === true;
    } catch (e) {
      console.error('Error checking admin setup status:', e);
      return false;
    }
  },

  // First time setup - strictly ALLOW ONLY ONE registration
  async registerFirstAdmin(username: string, password: string): Promise<{ success: boolean; message: string }> {
    if (this.isSetupComplete()) {
      return { 
        success: false, 
        message: 'Admin setup has already been completed! Only one admin account is allowed.' 
      };
    }

    if (!username.trim() || !password.trim()) {
      return { success: false, message: 'Username and password cannot be empty.' };
    }

    if (password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    try {
      const hashedPassword = await hashPassword(password.trim());
      const credentials: AdminCredentials = {
        username: username.trim().toLowerCase(),
        passwordHash: hashedPassword,
        isSetupComplete: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      localStorage.setItem(KEYS.ADMIN, JSON.stringify(credentials));
      return { success: true, message: 'Admin account created successfully!' };
    } catch (e) {
      console.error('Failed to create admin credentials:', e);
      return { success: false, message: 'An error occurred while saving admin credentials.' };
    }
  },

  // Authenticate Admin Login
  async login(username: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = localStorage.getItem(KEYS.ADMIN);
      if (!data) {
        return { success: false, message: 'No admin account found. Please complete initial setup.' };
      }

      const stored: AdminCredentials = JSON.parse(data);
      if (!stored.isSetupComplete) {
        return { success: false, message: 'Admin setup incomplete.' };
      }

      if (username.trim().toLowerCase() !== stored.username) {
        return { success: false, message: 'Invalid Username or Password.' };
      }

      const inputHash = await hashPassword(password.trim());
      if (inputHash !== stored.passwordHash) {
        return { success: false, message: 'Invalid Username or Password.' };
      }

      // Update last login
      stored.lastLoginAt = new Date().toISOString();
      localStorage.setItem(KEYS.ADMIN, JSON.stringify(stored));

      return { success: true, message: 'Welcome back, Admin!' };
    } catch (e) {
      console.error('Login verification failed:', e);
      return { success: false, message: 'Authentication error occurred.' };
    }
  },

  // Change Admin Password
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = localStorage.getItem(KEYS.ADMIN);
      if (!data) {
        return { success: false, message: 'Admin account not found.' };
      }

      const stored: AdminCredentials = JSON.parse(data);
      const currentHash = await hashPassword(currentPassword.trim());

      if (currentHash !== stored.passwordHash) {
        return { success: false, message: 'Current password is incorrect.' };
      }

      if (!newPassword.trim() || newPassword.length < 4) {
        return { success: false, message: 'New password must be at least 4 characters.' };
      }

      const newHash = await hashPassword(newPassword.trim());
      stored.passwordHash = newHash;
      localStorage.setItem(KEYS.ADMIN, JSON.stringify(stored));

      return { success: true, message: 'Password updated successfully!' };
    } catch (e) {
      console.error('Failed to change password:', e);
      return { success: false, message: 'Error updating password.' };
    }
  },

  // Get Admin Profile details
  getAdminProfile(): { username: string; createdAt?: string; lastLoginAt?: string } | null {
    try {
      const data = localStorage.getItem(KEYS.ADMIN);
      if (!data) return null;
      const parsed: AdminCredentials = JSON.parse(data);
      return {
        username: parsed.username,
        createdAt: parsed.createdAt,
        lastLoginAt: parsed.lastLoginAt
      };
    } catch {
      return null;
    }
  }
};

// PRODUCT CATALOG MANAGEMENT SERVICES (Supports UNLIMITED Products with IndexedDB & Memory Cache)
const IDB_CONFIG = {
  DB_NAME: 'yaarika_boutique_db_v12',
  STORE_NAME: 'catalog_products',
  VERSION: 1
};

let memoryProductsCache: Product[] | null = null;

// Wipe legacy sample items and reset old caches to guarantee clean slate
function checkAndPerformWipe(): void {
  try {
    if (typeof window !== 'undefined') {
      const cleanSlateFlag = 'yaarika_clean_slate_v12';
      const isCleaned = localStorage.getItem(cleanSlateFlag);
      if (!isCleaned) {
        // Clear all previous legacy versions only (v1 to v11)
        for (let i = 1; i <= 11; i++) {
          localStorage.removeItem(`yaarika_products_v${i}`);
          localStorage.removeItem(`yaarika_admin_custom_products_v${i}`);
          localStorage.removeItem(`yaarika_admin_custom_edits_v${i}`);
          localStorage.removeItem(`yaarika_admin_deleted_ids_v${i}`);
        }
        localStorage.removeItem('yaarika_clean_slate_v11');

        // Clear legacy IndexedDB if available
        if (window.indexedDB && window.indexedDB.deleteDatabase) {
          try {
            window.indexedDB.deleteDatabase('yaarika_boutique_db_v10');
            window.indexedDB.deleteDatabase('yaarika_boutique_db_v11');
          } catch {}
        }

        localStorage.setItem(cleanSlateFlag, 'true');
      }
    }
  } catch (e) {
    console.warn('Wipe check warning:', e);
  }
}

checkAndPerformWipe();

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
        db.createObjectStore(IDB_CONFIG.STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Background sync to IndexedDB
async function persistToIndexedDB(products: Product[]): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
    
    // Clear and re-populate
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const p of products) {
      store.put(p);
    }
  } catch (err) {
    console.warn('IndexedDB persistence sync warning:', err);
  }
}

// Broadcast product update event to all components & windows
function broadcastProductsUpdate(products: Product[]): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRODUCTS_UPDATED_EVENT, { detail: products }));
  }
}

// Helper to get/set custom items that survive site updates
function getStoredCustomProducts(): Product[] {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_PRODUCTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredCustomProducts(items: Product[]): void {
  try {
    localStorage.setItem(KEYS.CUSTOM_PRODUCTS, JSON.stringify(items));
  } catch (e) {
    console.warn('Could not persist custom products to localStorage:', e);
  }
}

function getStoredCustomEdits(): Record<string, Partial<Product>> {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_EDITS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredCustomEdits(edits: Record<string, Partial<Product>>): void {
  try {
    localStorage.setItem(KEYS.CUSTOM_EDITS, JSON.stringify(edits));
  } catch (e) {
    console.warn('Could not persist edits to localStorage:', e);
  }
}

function getStoredDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.DELETED_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredDeletedIds(ids: string[]): void {
  try {
    localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(ids));
  } catch (e) {
    console.warn('Could not persist deleted IDs to localStorage:', e);
  }
}

// Initialize and preload from storage with smart update protection
function loadInitialCatalog(): Product[] {
  try {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    const customItems = getStoredCustomProducts();
    const customEdits = getStoredCustomEdits();
    const deletedIds = new Set(getStoredDeletedIds());

    let baseCatalog: Product[] = [];

    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          baseCatalog = parsed;
        }
      } catch {}
    }

    // Apply edits and deleted IDs to base catalog, filtering out any sample items
    const processedBase = baseCatalog
      .filter(p => p && p.id && !p.id.startsWith('prod-sample-') && !deletedIds.has(p.id))
      .map(p => customEdits[p.id] ? { ...p, ...customEdits[p.id] } as Product : p);

    // Merge custom admin products, ensuring all custom items are preserved at the top
    const uniqueCustom = customItems.filter(p => p && p.id && !p.id.startsWith('prod-sample-') && !deletedIds.has(p.id));
    const customIds = new Set(uniqueCustom.map(p => p.id));

    const finalCatalog = [
      ...uniqueCustom, 
      ...processedBase.filter(p => !customIds.has(p.id))
    ];

    // Cache to localStorage
    try {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(finalCatalog));
    } catch {}

    return finalCatalog;
  } catch (e) {
    console.warn('LocalStorage catalog read warning, using safe fallback:', e);
    return [];
  }
}

// Firestore product converters
function cleanProductForFirestore(product: Product): Record<string, any> {
  const clean: Record<string, any> = {
    id: String(product.id || '').substring(0, 128),
    title: String(product.title || 'Untitled Ensemble').trim().substring(0, 200),
    category: String(product.category || 'Traditional Sarees').trim().substring(0, 100),
    price: Math.max(0, typeof product.price === 'number' && !isNaN(product.price) ? product.price : (parseFloat(String(product.price)) || 999)),
    imageUrl: String(product.imageUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800').substring(0, 3000),
    inStock: product.inStock !== false,
    createdAt: product.createdAt ? String(product.createdAt).substring(0, 64) : new Date().toISOString()
  };

  if (product.description) {
    clean.description = String(product.description).substring(0, 4000);
  }
  if (product.fabricDetails) {
    clean.fabricDetails = String(product.fabricDetails).substring(0, 500);
  }
  if (product.originalPrice !== undefined && product.originalPrice !== null && !isNaN(Number(product.originalPrice))) {
    clean.originalPrice = Number(product.originalPrice);
  }
  if (product.stockCount !== undefined && product.stockCount !== null && !isNaN(Number(product.stockCount))) {
    clean.stockCount = Number(product.stockCount);
  }
  if (product.featured !== undefined) {
    clean.featured = Boolean(product.featured);
  }
  if (product.isNewArrival !== undefined) {
    clean.isNewArrival = Boolean(product.isNewArrival);
  }
  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    clean.sizes = product.sizes.slice(0, 20).map(s => String(s));
  } else {
    clean.sizes = ['Free Size'];
  }
  if (Array.isArray(product.images) && product.images.length > 0) {
    clean.images = product.images.slice(0, 10).map(img => String(img).substring(0, 3000));
  }
  if (product.sizeStock && typeof product.sizeStock === 'object') {
    const safeSizeStock: Record<string, number> = {};
    for (const [k, v] of Object.entries(product.sizeStock)) {
      if (typeof v === 'number' && !isNaN(v)) {
        safeSizeStock[k] = v;
      }
    }
    clean.sizeStock = safeSizeStock;
  }

  return clean;
}

function docToProduct(data: any): Product {
  const sizes = Array.isArray(data.sizes) && data.sizes.length > 0 
    ? (data.sizes as Product['sizes']) 
    : ['Free Size' as const];

  return {
    id: String(data.id || ''),
    title: String(data.title || ''),
    category: (data.category || 'Traditional Sarees') as Product['category'],
    price: typeof data.price === 'number' ? data.price : (parseFloat(String(data.price)) || 0),
    originalPrice: data.originalPrice !== undefined && data.originalPrice !== null ? Number(data.originalPrice) : undefined,
    sizes,
    stockCount: data.stockCount !== undefined && data.stockCount !== null ? Number(data.stockCount) : undefined,
    sizeStock: data.sizeStock || {},
    description: data.description || '',
    fabricDetails: data.fabricDetails || undefined,
    imageUrl: data.imageUrl || '',
    images: Array.isArray(data.images) ? data.images : undefined,
    inStock: data.inStock !== false,
    featured: Boolean(data.featured),
    isNewArrival: Boolean(data.isNewArrival),
    createdAt: data.createdAt || new Date().toISOString()
  };
}

export const ProductStorage = {
  // Synchronous getter for fast initial render
  getProducts(): Product[] {
    if (memoryProductsCache === null) {
      memoryProductsCache = loadInitialCatalog();
      if (memoryProductsCache === null) {
        memoryProductsCache = [];
      }
      if (memoryProductsCache.length > 0) {
        persistToIndexedDB(memoryProductsCache);
      }
    }
    return memoryProductsCache;
  },

  // Real-time listener for Firestore collection "products" across ALL users, devices, and browsers
  subscribeToFirestore(callback: (products: Product[]) => void): Unsubscribe {
    const pathForOnSnapshot = 'products';
    return onSnapshot(
      collection(db, pathForOnSnapshot),
      (snapshot) => {
        const firestoreProducts: Product[] = [];
        snapshot.forEach(docSnap => {
          const item = docToProduct(docSnap.data());
          if (item && item.id && !ProductStorage.isDeleted(item.id)) {
            firestoreProducts.push(item);
          }
        });
        if (firestoreProducts.length > 0) {
          const merged = this.mergeWithCloudProducts(firestoreProducts);
          callback(merged);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
      }
    );
  },

  // Asynchronous loader from Firestore Cloud Database, Backend Server, Google Sheets, & IndexedDB
  async loadProductsAsync(): Promise<Product[]> {
    // 1. Initialize shared Google Sheet ID
    await GoogleSheetsService.initSharedConfig().catch(() => {});

    // 2. Fetch directly from Firebase Firestore Cloud Database (Universal persistence across ALL devices and systems!)
    try {
      const snap = await getDocs(collection(db, 'products'));
      if (!snap.empty) {
        const firestoreProducts: Product[] = [];
        snap.forEach(docSnap => {
          const item = docToProduct(docSnap.data());
          if (item && item.id && !ProductStorage.isDeleted(item.id)) {
            firestoreProducts.push(item);
          }
        });

        if (firestoreProducts.length > 0) {
          const merged = this.mergeWithCloudProducts(firestoreProducts);
          return merged;
        }
      }
    } catch (err) {
      console.warn('Firestore products fetch notice (will fallback to cache/server):', err);
    }

    // 3. Fetch products from Backend Server storage if available
    try {
      const serverRes = await fetch('/api/products');
      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
          const merged = this.mergeWithCloudProducts(data.products);
          return merged;
        }
      }
    } catch (e) {
      console.warn('Backend server products fetch warning:', e);
    }

    // 4. If Google Sheets is configured, load products from Google Sheet and merge
    if (typeof window !== 'undefined' && GoogleSheetsService.isConfigured()) {
      try {
        const gsRes = await GoogleSheetsService.fetchProductsFromSheet();
        if (gsRes.success && gsRes.products && gsRes.products.length > 0) {
          const merged = this.mergeWithCloudProducts(gsRes.products);
          return merged;
        }
      } catch (err) {
        console.warn('Google Sheets async pull error:', err);
      }
    }

    // 5. Fallback to IndexedDB
    try {
      const dbInstance = await openIndexedDB();
      const tx = dbInstance.transaction(IDB_CONFIG.STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
      const items = await new Promise<Product[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (items && Array.isArray(items) && items.length > 0) {
        const cleaned = items.filter(p => p && p.id && !p.id.startsWith('prod-sample-'));
        memoryProductsCache = cleaned;
        return cleaned;
      }
    } catch (e) {
      console.warn('Could not read from IndexedDB, falling back to sync cache:', e);
    }

    const syncItems = this.getProducts().filter(p => p && p.id && !p.id.startsWith('prod-sample-'));
    return syncItems;
  },

  saveProducts(products: Product[]): void {
    memoryProductsCache = products;

    try {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
    } catch (e) {
      try {
        localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products.slice(0, 100)));
      } catch {}
    }

    persistToIndexedDB(products);
    broadcastProductsUpdate(products);
  },

  // Safely merges cloud products without ever losing locally uploaded products
  mergeWithCloudProducts(cloudProducts: Product[]): Product[] {
    const deletedIds = new Set(getStoredDeletedIds());
    const customItems = getStoredCustomProducts().filter(p => !deletedIds.has(p.id));
    const validCloud = (cloudProducts || []).filter(p => p && p.id && !deletedIds.has(p.id));

    const map = new Map<string, Product>();

    // 1. Put local custom items FIRST so they take absolute precedence
    customItems.forEach(p => {
      map.set(p.id, p);
    });

    // 2. Put cloud products for cross-device sync
    validCloud.forEach(p => {
      if (!map.has(p.id)) {
        map.set(p.id, p);
      }
    });

    const merged = Array.from(map.values());
    this.saveProducts(merged);
    return merged;
  },

  addProduct(newProduct: Omit<Product, 'id' | 'createdAt'>): Product {
    const currentProducts = this.getProducts();

    const sizes = (newProduct.sizes && newProduct.sizes.length > 0) ? newProduct.sizes : ['M', 'L', 'XL', 'XXL'];
    const inStock = newProduct.inStock !== false;

    // Ensure valid sizeStock
    const sizeStock: Partial<Record<string, number>> = { ...(newProduct.sizeStock || {}) };
    let calculatedUnits = 0;
    sizes.forEach(s => {
      const rawCount = sizeStock[s];
      const count = rawCount !== undefined && rawCount !== null && !isNaN(Number(rawCount)) 
        ? Math.max(0, Number(rawCount)) 
        : (inStock ? 5 : 0);
      sizeStock[s] = count;
      calculatedUnits += count;
    });

    if (inStock && calculatedUnits === 0) {
      sizes.forEach(s => {
        sizeStock[s] = 5;
      });
      calculatedUnits = sizes.length * 5;
    }

    const createdProduct: Product = {
      ...newProduct,
      sizes: sizes as Product['sizes'],
      inStock,
      stockCount: calculatedUnits,
      sizeStock,
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };

    // Permanently record in dedicated custom products storage
    const customItems = getStoredCustomProducts();
    saveStoredCustomProducts([createdProduct, ...customItems.filter(p => p.id !== createdProduct.id)]);

    // Prepend newly added product to the top so it's immediately visible
    const updated = [createdProduct, ...currentProducts.filter(p => p.id !== createdProduct.id)];
    this.saveProducts(updated);

    // Save to Firebase Firestore Cloud Database for permanent universal access
    const cleanDoc = cleanProductForFirestore(createdProduct);
    setDoc(doc(db, 'products', createdProduct.id), cleanDoc).catch(err => {
      console.warn('Firestore product write error:', err);
    });

    // Save to Backend server cache
    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createdProduct)
    }).catch(err => {
      console.warn('Backend server product save error:', err);
    });

    // Auto-sync to connected Google Sheet
    if (typeof window !== 'undefined' && GoogleSheetsService.isConfigured() && GoogleSheetsService.getAutoSyncEnabled()) {
      GoogleSheetsService.appendProduct(createdProduct).catch(err => {
        console.warn('Auto-sync product to Google Sheets failed:', err);
      });
    }

    return createdProduct;
  },

  bulkAddProducts(newItems: Array<Omit<Product, 'id' | 'createdAt'>>): { added: number; total: number } {
    const currentProducts = this.getProducts();

    const createdList: Product[] = newItems.map((item, idx) => {
      const sizes = (item.sizes && item.sizes.length > 0) ? item.sizes : ['M', 'L', 'XL', 'XXL'];
      const inStock = item.inStock !== false;

      const sizeStock: Partial<Record<string, number>> = { ...(item.sizeStock || {}) };
      let calculatedUnits = 0;
      sizes.forEach(s => {
        const rawCount = sizeStock[s];
        const count = rawCount !== undefined && rawCount !== null && !isNaN(Number(rawCount)) 
          ? Math.max(0, Number(rawCount)) 
          : (inStock ? 5 : 0);
        sizeStock[s] = count;
        calculatedUnits += count;
      });

      if (inStock && calculatedUnits === 0) {
        sizes.forEach(s => {
          sizeStock[s] = 5;
        });
        calculatedUnits = sizes.length * 5;
      }

      return {
        ...item,
        sizes: sizes as Product['sizes'],
        inStock,
        stockCount: calculatedUnits,
        sizeStock,
        id: `prod-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString()
      };
    });

    // Permanently record in dedicated custom products storage
    const customItems = getStoredCustomProducts();
    const combinedCustom = [...createdList, ...customItems.filter(p => !createdList.some(c => c.id === p.id))];
    saveStoredCustomProducts(combinedCustom);

    const updated = [...createdList, ...currentProducts.filter(p => !createdList.some(c => c.id === p.id))];
    this.saveProducts(updated);

    // Save all items to Firebase Firestore in batches of up to 300
    (async () => {
      try {
        for (let i = 0; i < createdList.length; i += 300) {
          const chunk = createdList.slice(i, i + 300);
          const batch = writeBatch(db);
          chunk.forEach(p => {
            const clean = cleanProductForFirestore(p);
            batch.set(doc(db, 'products', p.id), clean);
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Firestore bulk batch write warning:', err);
      }
    })();

    // Save to Backend server
    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createdList)
    }).catch(err => {
      console.warn('Backend server bulk products save error:', err);
    });

    // Auto-sync all bulk items to connected Google Sheet
    if (typeof window !== 'undefined' && GoogleSheetsService.isConfigured() && GoogleSheetsService.getAutoSyncEnabled()) {
      GoogleSheetsService.appendProducts(createdList).catch(err => {
        console.warn('Auto-sync bulk products to Google Sheets failed:', err);
      });
    }

    return {
      added: createdList.length,
      total: updated.length
    };
  },

  updateProduct(updatedProduct: Product): void {
    const currentProducts = this.getProducts();
    const updated = currentProducts.map(p => p.id === updatedProduct.id ? updatedProduct : p);

    // If it's a custom product, update it in custom store
    const customItems = getStoredCustomProducts();
    const isCustom = customItems.some(p => p.id === updatedProduct.id);
    if (isCustom) {
      saveStoredCustomProducts(customItems.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    } else {
      const customEdits = getStoredCustomEdits();
      customEdits[updatedProduct.id] = updatedProduct;
      saveStoredCustomEdits(customEdits);
    }

    this.saveProducts(updated);

    // Update in Firestore
    const cleanDoc = cleanProductForFirestore(updatedProduct);
    setDoc(doc(db, 'products', updatedProduct.id), cleanDoc, { merge: true }).catch(err => {
      console.warn('Firestore update error:', err);
    });

    // Sync update to backend server
    fetch(`/api/products/${updatedProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProduct)
    }).catch(() => {});
  },

  toggleStockStatus(id: string): Product[] {
    const currentProducts = this.getProducts();
    const target = currentProducts.find(p => p.id === id);
    if (target) {
      this.updateProduct({ ...target, inStock: !target.inStock });
      return this.getProducts();
    }
    return currentProducts;
  },

  deleteProduct(id: string): void {
    const currentProducts = this.getProducts();
    const updated = currentProducts.filter(p => p.id !== id);

    // Remove from custom store
    const customItems = getStoredCustomProducts();
    saveStoredCustomProducts(customItems.filter(p => p.id !== id));

    // Remove from edits
    const customEdits = getStoredCustomEdits();
    delete customEdits[id];
    saveStoredCustomEdits(customEdits);

    // Add to deleted IDs list
    const deletedIds = getStoredDeletedIds();
    if (!deletedIds.includes(id)) {
      saveStoredDeletedIds([...deletedIds, id]);
    }

    this.saveProducts(updated);

    // Delete from Firestore
    deleteDoc(doc(db, 'products', id)).catch(err => {
      console.warn('Firestore delete error:', err);
    });

    // Sync deletion to backend server
    fetch(`/api/products/${id}`, {
      method: 'DELETE'
    }).catch(() => {});
  },

  isDeleted(id: string): boolean {
    return getStoredDeletedIds().includes(id);
  },

  getCustomProductsCount(): number {
    return getStoredCustomProducts().length;
  },

  resetToDefault(): Product[] {
    saveStoredCustomProducts([]);
    saveStoredCustomEdits({});
    saveStoredDeletedIds([]);
    this.saveProducts([]);
    fetch('/api/products/clear', { method: 'POST' }).catch(() => {});
    return [];
  },

  async clearAllProducts(): Promise<void> {
    const currentProducts = this.getProducts();
    const currentIds = currentProducts.map(p => p.id);
    const existingDeleted = getStoredDeletedIds();
    const newDeleted = Array.from(new Set([...existingDeleted, ...currentIds]));
    saveStoredDeletedIds(newDeleted);

    saveStoredCustomProducts([]);
    saveStoredCustomEdits({});
    this.saveProducts([]);

    // Delete all products from Firestore in batch
    try {
      const snap = await getDocs(collection(db, 'products'));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn('Firestore batch delete warning:', err);
    }

    fetch('/api/products/clear', { method: 'POST' }).catch(() => {});
  },

  // Export full catalog as JSON string
  exportCatalogJSON(): string {
    const products = this.getProducts();
    return JSON.stringify(products, null, 2);
  },

  // Export catalog as CSV
  exportCatalogCSV(): string {
    const products = this.getProducts();
    const headers = ['ID', 'Title', 'Category', 'Price', 'OriginalPrice', 'InStock', 'StockCount', 'SizeStock', 'IsNewArrival', 'Sizes', 'ImageUrl', 'Description'];
    const rows = products.map(p => [
      `"${p.id}"`,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.price,
      p.originalPrice || '',
      p.inStock ? 'TRUE' : 'FALSE',
      p.stockCount !== undefined ? p.stockCount : '',
      `"${p.sizeStock ? JSON.stringify(p.sizeStock).replace(/"/g, '""') : ''}"`,
      p.isNewArrival ? 'TRUE' : 'FALSE',
      `"${p.sizes.join('|')}"`,
      `"${(p.imageUrl || '').replace(/"/g, '""')}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },

  // Import products from CSV text
  importCatalogCSV(csvText: string): { success: boolean; count: number; error?: string } {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length <= 1) {
        return { success: false, count: 0, error: 'CSV file is empty or missing data rows.' };
      }

      const itemsToImport: Array<Omit<Product, 'id' | 'createdAt'>> = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV splitter handling quotes
        const cols: string[] = [];
        let inQuotes = false;
        let current = '';
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cols.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        cols.push(current.trim());

        const clean = (val: string) => (val || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();

        const title = clean(cols[1] || cols[0]);
        if (!title) continue;

        const category = (clean(cols[2]) || 'Fusion Wear') as Product['category'];
        const price = parseFloat(clean(cols[3])) || 1499;
        const originalPrice = parseFloat(clean(cols[4])) || (price + 500);
        const inStock = clean(cols[5]).toUpperCase() !== 'FALSE';
        
        let stockCount: number | undefined = undefined;
        let sizeStock: Record<string, number> | undefined = undefined;
        
        // Handle format with StockCount and SizeStock columns or standard columns
        let isNewArrival = false;
        let rawSizes = '';
        let imageUrl = '';
        let description = '';

        if (cols.length >= 11) {
          stockCount = cols[6] ? parseInt(clean(cols[6])) : undefined;
          const rawSizeStock = clean(cols[7]);
          if (rawSizeStock) {
            try {
              sizeStock = JSON.parse(rawSizeStock);
            } catch {}
          }
          isNewArrival = clean(cols[8]).toUpperCase() === 'TRUE';
          rawSizes = clean(cols[9]);
          imageUrl = clean(cols[10]) || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
          description = clean(cols[11]) || `${title} from Yaarika Collections.`;
        } else {
          isNewArrival = clean(cols[6]).toUpperCase() === 'TRUE';
          rawSizes = clean(cols[7]);
          imageUrl = clean(cols[8]) || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
          description = clean(cols[9]) || `${title} from Yaarika Collections.`;
        }

        const sizes = rawSizes ? rawSizes.split('|').map(s => s.trim() as Product['sizes'][number]) : ['Free Size' as const];

        itemsToImport.push({
          title,
          category,
          price,
          originalPrice,
          inStock,
          stockCount: isNaN(stockCount as number) ? undefined : stockCount,
          sizeStock: sizeStock || {},
          isNewArrival,
          sizes: sizes.length > 0 ? sizes : ['Free Size'],
          imageUrl,
          description
        });
      }

      if (itemsToImport.length === 0) {
        return { success: false, count: 0, error: 'No valid product rows found in CSV.' };
      }

      const res = this.bulkAddProducts(itemsToImport);
      return { success: true, count: res.added };
    } catch (e) {
      return { success: false, count: 0, error: (e as Error).message || 'Failed to parse CSV.' };
    }
  },

  // Import products from JSON text
  importCatalogJSON(jsonText: string): { success: boolean; count: number; error?: string } {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { success: false, count: 0, error: 'JSON must be an array of products.' };
      }

      const itemsToImport: Array<Omit<Product, 'id' | 'createdAt'>> = parsed.map(item => ({
        title: String(item.title || 'Untitled Yaarika Piece'),
        category: (item.category || 'Fusion Wear'),
        price: Number(item.price) || 1299,
        originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
        inStock: item.inStock !== false,
        isNewArrival: Boolean(item.isNewArrival),
        sizes: Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes : ['Free Size'],
        imageUrl: String(item.imageUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800'),
        description: String(item.description || 'Exclusive boutique wear.')
      }));

      const res = this.bulkAddProducts(itemsToImport);
      return { success: true, count: res.added };
    } catch (e) {
      return { success: false, count: 0, error: (e as Error).message || 'Invalid JSON format.' };
    }
  },

  // Generate batch realistic sample products for testing scale with unlimited items
  generateDemoBatch(count: number): { added: number; total: number } {
    const categories: Product['category'][] = [
      'Traditional Sarees',
      'Co-ord Sets',
      'Churidar Sets',
      'Fusion Wear',
      'New Arrivals'
    ];

    const sampleImages = [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&q=80&w=800'
    ];

    const fabricTypes = ['Pure Kasavu Gold Tissue', 'Kanchipuram Silk', 'Chanderi Zari', 'Linen Cotton', 'Georgette Embroidered', 'Handloom Cotton', 'Organza Floral'];
    const titles = ['Royal Heirloom', 'Festive Edit', 'Elegance Drape', 'Temple Border', 'Modern Fusion', 'Pastel Blossom', 'Golden Weave', 'Palazzo Ensemble'];

    const items: Array<Omit<Product, 'id' | 'createdAt'>> = [];
    const baseNumber = this.getProducts().length + 1;

    for (let i = 0; i < count; i++) {
      const idx = baseNumber + i;
      const cat = categories[idx % categories.length];
      const fabric = fabricTypes[idx % fabricTypes.length];
      const name = titles[idx % titles.length];
      const price = 899 + ((idx * 170) % 6500);
      const originalPrice = price + 400 + ((idx * 120) % 2000);
      const img = sampleImages[idx % sampleImages.length];

      items.push({
        title: `${name} ${fabric} #${idx}`,
        category: cat,
        price,
        originalPrice,
        inStock: i % 7 !== 0, // 85% in stock
        isNewArrival: i % 4 === 0,
        sizes: ['S', 'M', 'L', 'XL', 'Free Size'],
        imageUrl: img,
        description: `Premium ${fabric} crafted with exquisite craftsmanship. Perfect for weddings, festive celebrations, and special occasions. All Kerala Free Shipping included.`
      });
    }

    const res = this.bulkAddProducts(items);
    return { added: res.added, total: res.total };
  }
};

// WISHLIST SERVICES
export const WishlistStorage = {
  getWishlist(): string[] {
    try {
      const data = localStorage.getItem(KEYS.WISHLIST);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  toggleWishlist(productId: string): string[] {
    const current = this.getWishlist();
    let updated: string[];
    if (current.includes(productId)) {
      updated = current.filter(id => id !== productId);
    } else {
      updated = [...current, productId];
    }
    localStorage.setItem(KEYS.WISHLIST, JSON.stringify(updated));
    return updated;
  }
};

// INQUIRY ANALYTICS LOGS
export const InquiryStorage = {
  logInquiry(productId: string, productTitle: string, selectedSize: string, phoneContact: string): void {
    try {
      const existing = this.getInquiries();
      const newLog: InquiryLog = {
        id: `inquiry-${Date.now()}`,
        productId,
        productTitle,
        selectedSize,
        phoneContact,
        timestamp: new Date().toISOString()
      };
      const updated = [newLog, ...existing].slice(0, 100); // keep last 100
      localStorage.setItem(KEYS.INQUIRIES, JSON.stringify(updated));

      // Persist to Firestore inquiries collection
      setDoc(doc(db, 'inquiries', newLog.id), newLog).catch(err => {
        console.warn('Inquiry log firestore write warning:', err);
      });
    } catch (e) {
      console.error('Failed to log inquiry:', e);
    }
  },

  getInquiries(): InquiryLog[] {
    try {
      const data = localStorage.getItem(KEYS.INQUIRIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
};
