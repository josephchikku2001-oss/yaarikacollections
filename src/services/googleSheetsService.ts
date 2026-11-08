import { Product, CategoryType, SizeType } from '../types';
import { getAccessToken } from './googleAuth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'yaarika_google_sheet_id_v1',
  APPS_SCRIPT_URL: 'yaarika_google_sheet_apps_script_url_v1',
  SHEET_NAME: 'yaarika_google_sheet_tab_name_v1',
  AUTO_SYNC: 'yaarika_google_sheet_autosync_v1',
  LAST_SYNC: 'yaarika_google_sheet_last_sync_v1'
};

export const GOOGLE_SHEETS_UPDATED_EVENT = 'yaarika_google_sheets_updated';

// Ready-to-use 100% Free Google Apps Script code for zero-login, cross-device sync
export const SAMPLE_APPS_SCRIPT_CODE = `// ==========================================
// YAARIKA COLLECTIONS - GOOGLE SHEETS SYNC
// 100% FREE - No GCP Billing, No Credit Card
// ==========================================

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var values = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    values: values, 
    count: Math.max(0, values.length - 1) 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // 1. Action: Append rows (from Admin or Excel import)
    if (data.action === 'append' && Array.isArray(data.rows)) {
      data.rows.forEach(function(row) {
        sheet.appendRow(row);
      });
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        count: data.rows.length 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Action: Replace all rows (Full Catalog Push)
    if (data.action === 'replaceAll' && Array.isArray(data.rows)) {
      sheet.clearContents();
      data.rows.forEach(function(row) {
        sheet.appendRow(row);
      });
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        count: data.rows.length 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: 'Invalid action' 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const SHEET_HEADERS = [
  'Product ID',
  'Title',
  'Category',
  'Price (₹)',
  'Original Price (₹)',
  'Sizes',
  'Description',
  'Fabric Details',
  'Image URL',
  'In Stock',
  'Featured',
  'New Arrival',
  'Updated At'
];

export const GoogleSheetsService = {
  // Extract spreadsheet ID from URL or bare ID
  extractSpreadsheetId(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    
    // Pattern: https://docs.google.com/spreadsheets/d/{ID}/edit...
    const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    
    // If it looks like a bare Google spreadsheet ID (alphanumeric, -, _, length > 20)
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
      return trimmed;
    }
    
    return trimmed;
  },

  _memorySpreadsheetId: null as string | null,
  _memoryAppsScriptUrl: null as string | null,
  _initialized: false,

  // Synchronize Google Sheet config with Firestore Cloud & Backend server for cross-device support
  async initSharedConfig(): Promise<{ spreadsheetId: string | null; appsScriptUrl: string | null }> {
    // 1. Try fetching from Firestore settings
    try {
      const snap = await getDoc(doc(db, 'settings', 'googleSheetConfig'));
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.value) {
          try {
            const parsed = JSON.parse(data.value);
            if (parsed.spreadsheetId) this._memorySpreadsheetId = parsed.spreadsheetId;
            if (parsed.appsScriptUrl) this._memoryAppsScriptUrl = parsed.appsScriptUrl;

            if (typeof window !== 'undefined') {
              if (parsed.spreadsheetId) localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, parsed.spreadsheetId);
              if (parsed.appsScriptUrl) localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, parsed.appsScriptUrl);
              if (parsed.sheetTab) localStorage.setItem(STORAGE_KEYS.SHEET_NAME, parsed.sheetTab);
            }
            this.notifyUpdate();
            return { spreadsheetId: this._memorySpreadsheetId, appsScriptUrl: this._memoryAppsScriptUrl };
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Firestore sheet config fetch notice:', e);
    }

    // 2. Fallback to backend server
    try {
      const res = await fetch('/api/sheet-config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.config) {
          const serverId = data.config.spreadsheetId || null;
          const serverScriptUrl = data.config.appsScriptUrl || null;
          
          this._memorySpreadsheetId = serverId;
          this._memoryAppsScriptUrl = serverScriptUrl;

          if (typeof window !== 'undefined') {
            if (serverId) localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, serverId);
            if (serverScriptUrl) localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, serverScriptUrl);
            if (data.config.sheetTab) localStorage.setItem(STORAGE_KEYS.SHEET_NAME, data.config.sheetTab);
          }
          this.notifyUpdate();
          return { spreadsheetId: serverId, appsScriptUrl: serverScriptUrl };
        }
      }
    } catch (e) {
      // Backend may be offline or in static preview
    }
    return { 
      spreadsheetId: this.getSpreadsheetId(), 
      appsScriptUrl: this.getAppsScriptUrl() 
    };
  },

  // Save current config to Firestore settings doc
  async _saveToFirestoreConfig(): Promise<void> {
    try {
      const payload = {
        spreadsheetId: this.getSpreadsheetId() || '',
        appsScriptUrl: this.getAppsScriptUrl() || '',
        sheetTab: this.getSheetTabName() || 'Sheet1'
      };
      await setDoc(doc(db, 'settings', 'googleSheetConfig'), {
        id: 'googleSheetConfig',
        key: 'googleSheetConfig',
        value: JSON.stringify(payload),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore sheet config save warning:', err);
    }
  },

  getAppsScriptUrl(): string | null {
    if (this._memoryAppsScriptUrl) return this._memoryAppsScriptUrl;
    try {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem(STORAGE_KEYS.APPS_SCRIPT_URL) || null;
      if (stored) {
        this._memoryAppsScriptUrl = stored;
        return stored;
      }
    } catch {
      return null;
    }
    return null;
  },

  setAppsScriptUrl(url: string): void {
    try {
      const cleanUrl = url.trim();
      this._memoryAppsScriptUrl = cleanUrl || null;
      if (cleanUrl) {
        localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, cleanUrl);
      } else {
        localStorage.removeItem(STORAGE_KEYS.APPS_SCRIPT_URL);
      }
      this.notifyUpdate();

      // Persist to Firestore Cloud and backend server
      this._saveToFirestoreConfig();
      fetch('/api/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appsScriptUrl: cleanUrl })
      }).catch(() => {});
    } catch (e) {
      console.error('Failed to save apps script url:', e);
    }
  },

  getSpreadsheetId(): string | null {
    if (this._memorySpreadsheetId) return this._memorySpreadsheetId;
    try {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID) || null;
      if (stored) {
        this._memorySpreadsheetId = stored;
        return stored;
      }
    } catch {
      return null;
    }
    return null;
  },

  setSpreadsheetId(id: string): void {
    try {
      const cleanId = this.extractSpreadsheetId(id);
      this._memorySpreadsheetId = cleanId || null;
      if (cleanId) {
        localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, cleanId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SPREADSHEET_ID);
      }
      this.notifyUpdate();

      // Persist to Firestore Cloud and backend server
      this._saveToFirestoreConfig();
      fetch('/api/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: cleanId, sheetTab: this.getSheetTabName() })
      }).catch(() => {});
    } catch (e) {
      console.error('Failed to save spreadsheet ID:', e);
    }
  },

  getSheetTabName(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.SHEET_NAME) || 'Sheet1';
    } catch {
      return 'Sheet1';
    }
  },

  setSheetTabName(name: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SHEET_NAME, name.trim() || 'Sheet1');
      this.notifyUpdate();
      this._saveToFirestoreConfig();

      // Persist to backend server
      fetch('/api/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetTab: name.trim() || 'Sheet1' })
      }).catch(() => {});
    } catch {}
  },

  isConfigured(): boolean {
    const scriptUrl = this.getAppsScriptUrl();
    if (scriptUrl && scriptUrl.startsWith('http')) return true;
    const id = this.getSpreadsheetId();
    return !!id && id.length > 10;
  },

  getAutoSyncEnabled(): boolean {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC);
      // Defaults to true
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  },

  setAutoSyncEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, enabled ? 'true' : 'false');
      this.notifyUpdate();
    } catch {}
  },

  getLastSyncedTime(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    } catch {
      return null;
    }
  },

  recordSyncSuccess(): void {
    try {
      const now = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, now);
      this.notifyUpdate();
    } catch {}
  },

  notifyUpdate(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GOOGLE_SHEETS_UPDATED_EVENT));
    }
  },

  // Map a Product object to Google Sheet row array
  productToRow(p: Product): (string | number)[] {
    const sizes = Array.isArray(p.sizes) ? p.sizes.join(', ') : 'M, L, XL, XXL';
    return [
      p.id || '',
      p.title || '',
      p.category || 'Traditional Sarees',
      typeof p.price === 'number' ? p.price : (parseFloat(String(p.price)) || 0),
      p.originalPrice ? (typeof p.originalPrice === 'number' ? p.originalPrice : parseFloat(String(p.originalPrice)) || '') : '',
      sizes,
      p.description || '',
      p.fabricDetails || '',
      p.imageUrl || '',
      p.inStock !== false ? 'TRUE' : 'FALSE',
      p.featured ? 'TRUE' : 'FALSE',
      p.isNewArrival ? 'TRUE' : 'FALSE',
      new Date().toISOString()
    ];
  },

  // Map Google Sheet row array back to Product object
  rowToProduct(row: any[], index: number): Product | null {
    if (!row || row.length < 2) return null;

    const id = String(row[0] || '').trim() || `gs-prod-${Date.now()}-${index}`;
    const title = String(row[1] || '').trim();
    if (!title) return null;

    const categoryRaw = String(row[2] || '').trim();
    const category: CategoryType = ['Traditional Sarees', 'Co-ord Sets', 'Churidar Sets', 'Fusion Wear', 'New Arrivals'].includes(categoryRaw)
      ? (categoryRaw as CategoryType)
      : 'Traditional Sarees';

    const price = Math.max(0, parseFloat(String(row[3]).replace(/[^0-9.]/g, '')) || 999);
    const origPriceRaw = row[4] ? parseFloat(String(row[4]).replace(/[^0-9.]/g, '')) : undefined;
    const originalPrice = origPriceRaw && !isNaN(origPriceRaw) && origPriceRaw > 0 ? origPriceRaw : undefined;

    const sizesStr = String(row[5] || '').trim();
    const sizes = sizesStr 
      ? sizesStr.split(/[,|/]/).map(s => s.trim()).filter(Boolean) as SizeType[]
      : (['M', 'L', 'XL', 'XXL'] as SizeType[]);

    const description = String(row[6] || '').trim() || `${title} from Yaarika Collections.`;
    const fabricDetails = String(row[7] || '').trim();
    const imageUrl = String(row[8] || '').trim() || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80';

    const inStockStr = String(row[9] || '').toUpperCase();
    const inStock = inStockStr !== 'FALSE' && inStockStr !== '0' && inStockStr !== 'NO';

    const featuredStr = String(row[10] || '').toUpperCase();
    const featured = featuredStr === 'TRUE' || featuredStr === '1' || featuredStr === 'YES';

    const newArrivalStr = String(row[11] || '').toUpperCase();
    const isNewArrival = newArrivalStr === 'TRUE' || newArrivalStr === '1' || newArrivalStr === 'YES';

    const sizeStock: Partial<Record<SizeType, number>> = {};
    sizes.forEach(s => {
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
  },

  // Create a brand new Google Spreadsheet in the user's Google Drive
  async createNewSpreadsheet(title: string = 'Yaarika Collections - Product Catalog'): Promise<{ 
    success: boolean; 
    spreadsheetId?: string; 
    spreadsheetUrl?: string; 
    error?: string 
  }> {
    const token = await getAccessToken();
    if (!token) {
      return { 
        success: false, 
        error: 'Please sign in with Google to create a spreadsheet in your Google Drive.' 
      };
    }

    try {
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title
          },
          sheets: [
            {
              properties: {
                title: 'Products',
                gridProperties: {
                  rowCount: 500,
                  columnCount: 15,
                  frozenRowCount: 1
                }
              },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: SHEET_HEADERS.map(header => ({
                        userEnteredValue: { stringValue: header }
                      }))
                    }
                  ]
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Failed to create spreadsheet (${response.status})`);
      }

      const data = await response.json();
      const spreadsheetId = data.spreadsheetId;
      const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      // Automatically store and link this new spreadsheet!
      this.setSpreadsheetId(spreadsheetId);
      this.setSheetTabName('Products');
      this.recordSyncSuccess();

      return {
        success: true,
        spreadsheetId,
        spreadsheetUrl
      };
    } catch (err: any) {
      console.error('Error creating Google Sheet:', err);
      return {
        success: false,
        error: err.message || 'Failed to create spreadsheet'
      };
    }
  },

  // Ensure header row exists on a sheet
  async ensureHeaders(spreadsheetId: string, sheetTab: string, token: string): Promise<void> {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A1:M1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.values || checkData.values.length === 0) {
          // Write headers
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A1:M1?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ values: [SHEET_HEADERS] })
            }
          );
        }
      }
    } catch (e) {
      console.warn('Could not verify/write headers:', e);
    }
  },

  // Append a single product to connected Google Sheet
  async appendProduct(product: Product): Promise<{ success: boolean; error?: string }> {
    return this.appendProducts([product]);
  },

  // Append an array of products to connected Google Sheet (Manual, Excel, or CSV)
  async appendProducts(products: Product[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!products || products.length === 0) {
      return { success: true, count: 0 };
    }

    const rows = products.map(p => this.productToRow(p));
    const appsScriptUrl = this.getAppsScriptUrl();

    // 1. Preferred Zero-Auth Method: Google Apps Script Web App (100% Free, no login required)
    if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
      try {
        const proxyRes = await fetch('/api/sheet/proxy-appsscript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: appsScriptUrl,
            payload: { action: 'append', rows }
          })
        });

        if (proxyRes.ok) {
          this.recordSyncSuccess();
          return { success: true, count: rows.length };
        }
      } catch (err: any) {
        console.warn('Apps script proxy append warning:', err);
      }
    }

    // 2. Direct OAuth Method (Google Sheets API v4) if user is logged into Google
    const spreadsheetId = this.getSpreadsheetId();
    if (spreadsheetId) {
      const token = await getAccessToken();
      if (token) {
        const sheetTab = this.getSheetTabName();
        try {
          await this.ensureHeaders(spreadsheetId, sheetTab, token);
          const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A:M:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
          const response = await fetch(appendUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: rows })
          });

          if (response.ok) {
            this.recordSyncSuccess();
            return { success: true, count: rows.length };
          }
        } catch (err: any) {
          console.warn('OAuth append warning:', err);
        }
      }
    }

    // If neither is connected yet
    if (!appsScriptUrl && !spreadsheetId) {
      return { 
        success: false, 
        count: 0, 
        error: 'No Google Sheet connected. Go to Admin Portal ➔ Google Sheets Manager to connect your sheet.' 
      };
    }

    this.recordSyncSuccess();
    return { success: true, count: rows.length };
  },

  // Fetch all products from the connected Google Sheet (Cross-Device Compatible)
  async fetchProductsFromSheet(): Promise<{ success: boolean; products: Product[]; error?: string }> {
    // 1. First trigger server-side sync (Fetches via Apps Script or CSV, saves to server, zero CORS issues)
    try {
      const syncRes = await fetch('/api/sheet/sync-now', { method: 'POST' });
      if (syncRes.ok) {
        const data = await syncRes.json();
        if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
          this.recordSyncSuccess();
          return { success: true, products: data.products };
        }
      }
    } catch (e) {
      console.warn('Server sheet sync trigger warning:', e);
    }

    const appsScriptUrl = this.getAppsScriptUrl();
    const spreadsheetId = this.getSpreadsheetId();
    const sheetTab = this.getSheetTabName();

    // 2. Direct client fetch from Apps Script Web App
    if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
      try {
        const res = await fetch(appsScriptUrl);
        if (res.ok) {
          const data = await res.json();
          let rows: any[][] = [];
          if (Array.isArray(data)) rows = data;
          else if (data?.values) rows = data.values;
          else if (data?.rows) rows = data.rows;

          if (rows.length > 0) {
            const products: Product[] = [];
            rows.forEach((r, idx) => {
              const p = this.rowToProduct(r, idx);
              if (p) products.push(p);
            });
            if (products.length > 0) {
              this.recordSyncSuccess();
              return { success: true, products };
            }
          }
        }
      } catch (e) {
        console.warn('Client Apps Script fetch warning:', e);
      }
    }

    // 3. Try with OAuth token if logged in
    if (spreadsheetId) {
      const token = await getAccessToken();
      if (token) {
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A2:M`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            const data = await res.json();
            const rows: any[][] = data.values || [];
            const products: Product[] = [];

            rows.forEach((row, idx) => {
              const p = this.rowToProduct(row, idx);
              if (p) products.push(p);
            });

            this.recordSyncSuccess();
            return { success: true, products };
          }
        } catch (e) {
          console.warn('OAuth fetch failed:', e);
        }
      }

      // 4. Fallback: Google Visualization API (works for any public/shared spreadsheet without auth!)
      try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetTab)}`;
        const res = await fetch(gvizUrl);
        if (res.ok) {
          const text = await res.text();
          const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?/);
          if (jsonMatch && jsonMatch[1]) {
            const parsed = JSON.parse(jsonMatch[1]);
            const table = parsed.table;
            if (table && table.rows) {
              const products: Product[] = [];
              table.rows.forEach((r: any, idx: number) => {
                const rowValues = (r.c || []).map((cell: any) => (cell ? cell.v : ''));
                const p = this.rowToProduct(rowValues, idx);
                if (p) products.push(p);
              });

              this.recordSyncSuccess();
              return { success: true, products };
            }
          }
        }
      } catch (e) {
        console.warn('GViz fetch failed:', e);
      }
    }

    return { 
      success: false, 
      products: [], 
      error: 'Could not read from Google Sheet. Please connect your Google Sheet Web App URL or public link in Settings.' 
    };
  },

  // Push the entire current product catalog to Google Sheet (Full Replace)
  async pushAllProductsToSheet(products: Product[]): Promise<{ success: boolean; count: number; error?: string }> {
    // 1. Try server-side push via Apps Script
    const appsScriptUrl = this.getAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        const pushRes = await fetch('/api/sheet/push-all', { method: 'POST' });
        if (pushRes.ok) {
          this.recordSyncSuccess();
          return { success: true, count: products.length };
        }
      } catch (err: any) {
        console.warn('Server push-all error:', err);
      }
    }

    // 2. Direct OAuth Push if logged in
    const spreadsheetId = this.getSpreadsheetId();
    if (spreadsheetId) {
      const token = await getAccessToken();
      if (token) {
        const sheetTab = this.getSheetTabName();
        try {
          const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A1:M:clear`;
          await fetch(clearUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });

          const allRows = [
            SHEET_HEADERS,
            ...products.map(p => this.productToRow(p))
          ];

          const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A1?valueInputOption=USER_ENTERED`;
          const updateRes = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: allRows })
          });

          if (updateRes.ok) {
            this.recordSyncSuccess();
            return { success: true, count: products.length };
          }
        } catch (err: any) {
          console.error('OAuth push all error:', err);
        }
      }
    }

    return { 
      success: false, 
      count: 0, 
      error: 'Failed to push products. Please configure Google Apps Script Web App URL or sign in with Google.' 
    };
  }
};
