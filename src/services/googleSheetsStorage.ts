import { Product } from '../types';

export const GoogleSheetsService = {
  getConfig() {
    try {
      const config = localStorage.getItem('yaarika_googlesheets_config');
      if (config) {
        return JSON.parse(config);
      }
    } catch {}
    return { webAppUrl: '' };
  },

  saveConfig(webAppUrl: string) {
    try {
      localStorage.setItem('yaarika_googlesheets_config', JSON.stringify({ webAppUrl: webAppUrl.trim() }));
    } catch {}
  },

  async fetchProducts(): Promise<Product[]> {
    const { webAppUrl } = this.getConfig();
    if (!webAppUrl) return [];

    try {
      const res = await fetch(webAppUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Google Sheets fetch error:', e);
    }
    return [];
  },

  async updateProducts(products: Product[]): Promise<boolean> {
    const { webAppUrl } = this.getConfig();
    if (!webAppUrl) return false;

    try {
      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(products)
      });
      if (res.ok) {
        const result = await res.json();
        return result.success === true;
      }
    } catch (e) {
      console.warn('Google Sheets update error:', e);
    }
    return false;
  },

  async verifyConnection(webAppUrl: string): Promise<any> {
    if (!webAppUrl.trim()) {
      return { success: false, error: 'Google Apps Script Web App URL is required.' };
    }

    try {
      const res = await fetch(webAppUrl.trim());
      if (res.ok) {
        const data = await res.json();
        return { success: true, count: Array.isArray(data) ? data.length : 0 };
      }
      return { success: false, error: 'Failed to connect to Google Sheets Web App URL.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection failed.' };
    }
  }
};
