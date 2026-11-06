import { Product, CategoryType, SizeType } from '../types';
import { getAccessToken } from './googleAuth';
import firebaseConfig from '../../firebase-applet-config.json';

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'yaarika_google_sheet_id_v1',
  SHEET_NAME: 'yaarika_google_sheet_tab_name_v1',
  AUTO_SYNC: 'yaarika_google_sheet_autosync_v1',
  LAST_SYNC: 'yaarika_google_sheet_last_sync_v1'
};

export const GOOGLE_SHEETS_UPDATED_EVENT = 'yaarika_google_sheets_updated';

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
  _initialized: false,

  // Synchronize Google Sheet config with backend server for cross-device support
  async initSharedConfig(): Promise<string | null> {
    try {
      const res = await fetch('/api/sheet-config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.config && data.config.spreadsheetId) {
          const serverId = data.config.spreadsheetId;
          this._memorySpreadsheetId = serverId;
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, serverId);
            if (data.config.sheetTab) {
              localStorage.setItem(STORAGE_KEYS.SHEET_NAME, data.config.sheetTab);
            }
          }
          this.notifyUpdate();
          return serverId;
        }
      }
    } catch (e) {
      // Backend may be offline or in static preview
    }
    return this.getSpreadsheetId();
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

      // Persist to backend server so all visitors on all devices get this Sheet ID
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
    } catch {}
  },

  isConfigured(): boolean {
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

    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) {
      return { success: false, count: 0, error: 'No Google Sheet connected.' };
    }

    const token = await getAccessToken();
    if (!token) {
      return { 
        success: false, 
        count: 0, 
        error: 'Google OAuth token expired or unavailable. Please click "Sign in with Google" to authorize sync.' 
      };
    }

    const sheetTab = this.getSheetTabName();

    try {
      // 1. Ensure header row is present
      await this.ensureHeaders(spreadsheetId, sheetTab, token);

      // 2. Prepare rows
      const rows = products.map(p => this.productToRow(p));

      // 3. Append rows
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A:M:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const response = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Google Sheets API error: ${response.status}`);
      }

      this.recordSyncSuccess();
      return { success: true, count: rows.length };
    } catch (err: any) {
      console.error('Failed to append products to Google Sheets:', err);
      return { success: false, count: 0, error: err.message || 'Append failed' };
    }
  },

  // Fetch all products from the connected Google Sheet
  async fetchProductsFromSheet(): Promise<{ success: boolean; products: Product[]; error?: string }> {
    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) {
      return { success: false, products: [], error: 'No Google Sheet connected.' };
    }

    const sheetTab = this.getSheetTabName();
    const token = await getAccessToken();

    // 1. Try with OAuth token if logged in
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
        console.warn('OAuth fetch failed, trying public/API key fallback:', e);
      }
    }

    // 2. Fallback: Google Sheets API with API Key (from firebase config)
    if (firebaseConfig.apiKey) {
      try {
        const apiKeyUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A2:M?key=${firebaseConfig.apiKey}`;
        const res = await fetch(apiKeyUrl);
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
        console.warn('API key fetch failed:', e);
      }
    }

    // 3. Fallback: Google Visualization API (works for any public/shared spreadsheet without auth!)
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetTab)}`;
      const res = await fetch(gvizUrl);
      if (res.ok) {
        const text = await res.text();
        // format is /*O_o*/ google.visualization.Query.setResponse({...});
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

    return { 
      success: false, 
      products: [], 
      error: 'Could not read from Google Sheet. Please make sure you are signed in with Google, or that the sheet is shared.' 
    };
  },

  // Push the entire current product catalog to Google Sheet (Full Replace)
  async pushAllProductsToSheet(products: Product[]): Promise<{ success: boolean; count: number; error?: string }> {
    const spreadsheetId = this.getSpreadsheetId();
    if (!spreadsheetId) {
      return { success: false, count: 0, error: 'No Google Sheet connected.' };
    }

    const token = await getAccessToken();
    if (!token) {
      return { 
        success: false, 
        count: 0, 
        error: 'Please sign in with Google to push products to Google Sheets.' 
      };
    }

    const sheetTab = this.getSheetTabName();

    try {
      // 1. Clear existing sheet content
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTab)}!A1:M:clear`;
      await fetch(clearUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      // 2. Write Headers + All Products
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
        body: JSON.stringify({
          values: allRows
        })
      });

      if (!updateRes.ok) {
        const errJson = await updateRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Failed to update sheet (${updateRes.status})`);
      }

      this.recordSyncSuccess();
      return { success: true, count: products.length };
    } catch (err: any) {
      console.error('Push all error:', err);
      return { success: false, count: 0, error: err.message || 'Push failed' };
    }
  }
};
