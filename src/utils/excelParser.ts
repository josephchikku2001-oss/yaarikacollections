import JSZip from 'jszip';
import Papa from 'papaparse';
import { CategoryType, SizeType } from '../types';

export interface ParsedProductRow {
  title: string;
  category: CategoryType;
  price: number;
  originalPrice?: number;
  inStock: boolean;
  stockCount?: number;
  sizeStock?: Record<string, number>;
  sizes: SizeType[];
  imageUrl: string;
  description: string;
  fabricDetails?: string;
  isNewArrival?: boolean;
  featured?: boolean;
  isValid: boolean;
  validationError?: string;
  rawRowIndex: number;
}

// Convert Google Drive or other special link formats to direct loadable image URLs
export function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') {
    return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
  }

  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
  }

  // Google Drive format: https://drive.google.com/file/d/FILE_ID/view...
  const driveMatch1 = cleanUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch1 && driveMatch1[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch1[1]}`;
  }

  // Google Drive format: https://drive.google.com/open?id=FILE_ID
  const driveMatch2 = cleanUrl.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveMatch2 && driveMatch2[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch2[1]}`;
  }

  // Dropbox format: change dl=0 to dl=1 or raw=1
  if (cleanUrl.includes('dropbox.com')) {
    return cleanUrl.replace(/[?&]dl=0/, '?raw=1');
  }

  return cleanUrl;
}

// Map various category inputs to standard CategoryType
export function normalizeCategory(val: any): CategoryType {
  const str = String(val || '').toLowerCase().trim();
  if (str.includes('saree') || str.includes('kasavu') || str.includes('silk') || str.includes('traditional')) {
    return 'Traditional Sarees';
  }
  if (str.includes('co-ord') || str.includes('coord') || str.includes('set') || str.includes('western')) {
    return 'Co-ord Sets';
  }
  if (str.includes('churidar') || str.includes('salwar') || str.includes('kurti') || str.includes('suit')) {
    return 'Churidar Sets';
  }
  if (str.includes('fusion') || str.includes('tunic') || str.includes('gown') || str.includes('indo')) {
    return 'Fusion Wear';
  }
  if (str.includes('new') || str.includes('arrival') || str.includes('latest')) {
    return 'New Arrivals';
  }
  return 'Traditional Sarees';
}

// Parse Sizes array
export function parseSizes(val: any): SizeType[] {
  if (Array.isArray(val)) {
    return val as SizeType[];
  }
  if (!val) return ['M', 'L', 'XL', 'XXL'];

  const str = String(val).trim();
  if (str.toLowerCase() === 'all' || str.toLowerCase() === 'free' || str.toLowerCase() === 'free size') {
    return ['Free Size'];
  }

  // Split by comma, pipe, slash, space
  const parts = str.split(/[,|/;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  const validSizes: SizeType[] = [];
  const recognized: SizeType[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'];

  for (const p of parts) {
    if (recognized.includes(p as SizeType)) {
      if (!validSizes.includes(p as SizeType)) validSizes.push(p as SizeType);
    }
  }

  return validSizes.length > 0 ? validSizes : ['M', 'L', 'XL', 'XXL'];
}

// Parse Size Stock map: e.g. "M:5, L:10, XL:5" or numeric count
export function parseSizeStock(val: any, sizes: SizeType[], defaultStockPerSize: number = 5): Record<string, number> {
  const stockMap: Record<string, number> = {};

  if (typeof val === 'number') {
    const perSize = Math.max(0, Math.floor(val / (sizes.length || 1))) || 5;
    sizes.forEach(s => {
      stockMap[s] = perSize;
    });
    return stockMap;
  }

  if (typeof val === 'object' && val !== null) {
    return val as Record<string, number>;
  }

  const str = String(val || '').trim();
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      return JSON.parse(str);
    } catch {}
  }

  if (str.includes(':')) {
    // "M:5, L:10, XL:5"
    const pairs = str.split(/[,|;]+/);
    for (const pair of pairs) {
      const [sz, countStr] = pair.split(':').map(s => s.trim());
      if (sz && countStr) {
        const count = parseInt(countStr, 10);
        if (!isNaN(count)) {
          stockMap[sz.toUpperCase()] = count;
        }
      }
    }
    if (Object.keys(stockMap).length > 0) {
      return stockMap;
    }
  }

  // Default fallback
  sizes.forEach(s => {
    stockMap[s] = defaultStockPerSize;
  });
  return stockMap;
}

// Flexible header normalizer
function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Match column index by possible header names
function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedCandidates = candidates.map(c => normalizeHeaderName(c));
  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeHeaderName(headers[i]);
    if (normalizedCandidates.includes(norm)) {
      return i;
    }
  }
  return -1;
}

// Convert Excel column letters (A, B, C... AA, etc.) to 0-based column index
function colLetterToIndex(colLetter: string): number {
  let index = 0;
  for (let i = 0; i < colLetter.length; i++) {
    index = index * 26 + (colLetter.charCodeAt(i) - 64);
  }
  return index - 1;
}

// Parse Array of Rows (from Excel or CSV) into ParsedProductRow[]
export function parseRowsToProducts(rows: any[][]): ParsedProductRow[] {
  if (!rows || rows.length < 2) {
    return [];
  }

  // First row is header
  const rawHeaders = rows[0].map(h => String(h ?? '').trim());
  
  const titleIdx = findColumnIndex(rawHeaders, ['title', 'producttitle', 'productname', 'name', 'item', 'itemname', 'product']);
  const categoryIdx = findColumnIndex(rawHeaders, ['category', 'collection', 'type', 'cat', 'section']);
  const priceIdx = findColumnIndex(rawHeaders, ['price', 'offerprice', 'sellingprice', 'saleprice', 'rate', 'amount', 'inr']);
  const originalPriceIdx = findColumnIndex(rawHeaders, ['originalprice', 'mrp', 'regularprice', 'oldprice', 'actualprice']);
  const inStockIdx = findColumnIndex(rawHeaders, ['instock', 'stockstatus', 'availability', 'available', 'stock']);
  const stockCountIdx = findColumnIndex(rawHeaders, ['stockcount', 'quantity', 'qty', 'units', 'totalunits', 'inventory']);
  const sizeStockIdx = findColumnIndex(rawHeaders, ['sizestock', 'stockpersize', 'sizequantities', 'sizesqty']);
  const sizesIdx = findColumnIndex(rawHeaders, ['sizes', 'availablesizes', 'size', 'sizesavailable']);
  const imageIdx = findColumnIndex(rawHeaders, ['imageurl', 'image', 'imagelink', 'photo', 'picture', 'photourl', 'img', 'photos']);
  const descIdx = findColumnIndex(rawHeaders, ['description', 'desc', 'details', 'about', 'notes']);
  const fabricIdx = findColumnIndex(rawHeaders, ['fabric', 'fabricdetails', 'material', 'weave', 'work']);
  const newArrivalIdx = findColumnIndex(rawHeaders, ['isnewarrival', 'newarrival', 'new', 'latest', 'featured']);

  const parsedItems: ParsedProductRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue; // skip blank rows
    }

    const rawTitle = titleIdx !== -1 ? row[titleIdx] : row[0];
    const title = String(rawTitle ?? '').trim();

    if (!title) {
      continue;
    }

    const categoryRaw = categoryIdx !== -1 ? row[categoryIdx] : (row[1] || 'Traditional Sarees');
    const category = normalizeCategory(categoryRaw);

    const rawPrice = priceIdx !== -1 ? row[priceIdx] : (row[2] || 1499);
    const parsedPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 1499;

    const rawOrigPrice = originalPriceIdx !== -1 ? row[originalPriceIdx] : row[3];
    let originalPrice: number | undefined = undefined;
    if (rawOrigPrice !== undefined && rawOrigPrice !== null && String(rawOrigPrice).trim() !== '') {
      const parsed = typeof rawOrigPrice === 'number' ? rawOrigPrice : parseFloat(String(rawOrigPrice).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        originalPrice = parsed;
      }
    }
    if (!originalPrice && parsedPrice > 0) {
      originalPrice = Math.round(parsedPrice * 1.25);
    }

    // In Stock
    let inStock = true;
    if (inStockIdx !== -1 && row[inStockIdx] !== undefined && row[inStockIdx] !== null) {
      const stockStr = String(row[inStockIdx]).toLowerCase().trim();
      if (stockStr === 'false' || stockStr === '0' || stockStr === 'no' || stockStr === 'out of stock' || stockStr === 'sold out') {
        inStock = false;
      }
    }

    // Sizes
    const rawSizes = sizesIdx !== -1 ? row[sizesIdx] : 'M, L, XL, XXL';
    const sizes = parseSizes(rawSizes);

    // Stock count & per size
    let stockCount: number | undefined = undefined;
    if (stockCountIdx !== -1 && row[stockCountIdx] !== undefined && row[stockCountIdx] !== null) {
      const parsedStock = parseInt(String(row[stockCountIdx]), 10);
      if (!isNaN(parsedStock)) stockCount = parsedStock;
    }

    const rawSizeStock = sizeStockIdx !== -1 ? row[sizeStockIdx] : undefined;
    const sizeStock = parseSizeStock(rawSizeStock || stockCount, sizes, inStock ? 5 : 0);

    // Image URL
    const rawImg = imageIdx !== -1 ? row[imageIdx] : undefined;
    const imageUrl = sanitizeImageUrl(rawImg ? String(rawImg) : null);

    // Description & Fabric
    const rawDesc = descIdx !== -1 ? row[descIdx] : '';
    const rawFabric = fabricIdx !== -1 ? row[fabricIdx] : '';
    const description = String(rawDesc || `${title} from Yaarika Collections. Handcrafted with authentic Kerala styling, rich gold border motifs, and comfortable silhouette.`).trim();
    const fabricDetails = String(rawFabric || 'Premium Handloom / Kerala Zari Silk Blend').trim();

    // New Arrival
    let isNewArrival = false;
    if (newArrivalIdx !== -1 && row[newArrivalIdx] !== undefined && row[newArrivalIdx] !== null) {
      const newStr = String(row[newArrivalIdx]).toLowerCase().trim();
      if (newStr === 'true' || newStr === '1' || newStr === 'yes' || newStr === 'new') {
        isNewArrival = true;
      }
    }

    parsedItems.push({
      title,
      category,
      price: parsedPrice,
      originalPrice,
      inStock,
      stockCount: stockCount ?? sizes.reduce((acc, s) => acc + (sizeStock[s] || 0), 0),
      sizeStock,
      sizes,
      imageUrl,
      description,
      fabricDetails,
      isNewArrival,
      isValid: Boolean(title && parsedPrice > 0),
      rawRowIndex: r + 1
    });
  }

  return parsedItems;
}

// Parse an Excel (.xlsx) file using JSZip and native browser DOMParser
export async function parseExcelFile(file: File): Promise<ParsedProductRow[]> {
  try {
    const zip = await JSZip.loadAsync(file);

    // 1. Read shared strings if present
    const sharedStrings: string[] = [];
    const sharedStringsFile = zip.file('xl/sharedStrings.xml');
    if (sharedStringsFile) {
      const sharedXmlText = await sharedStringsFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(sharedXmlText, 'application/xml');
      const siElements = xmlDoc.getElementsByTagName('si');
      for (let i = 0; i < siElements.length; i++) {
        const si = siElements[i];
        // Can be <t> or multiple <r><t>
        const tElements = si.getElementsByTagName('t');
        let fullText = '';
        for (let j = 0; j < tElements.length; j++) {
          fullText += tElements[j].textContent || '';
        }
        sharedStrings.push(fullText);
      }
    }

    // 2. Locate worksheet (e.g. sheet1.xml)
    let sheetFile = zip.file('xl/worksheets/sheet1.xml');
    if (!sheetFile) {
      // Find any sheet in xl/worksheets/
      const sheetEntries = zip.file(/xl\/worksheets\/sheet.*\.xml/i);
      if (sheetEntries.length > 0) {
        sheetFile = sheetEntries[0];
      }
    }

    if (!sheetFile) {
      throw new Error('No worksheet found in Excel file.');
    }

    const sheetXmlText = await sheetFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(sheetXmlText, 'application/xml');

    const rowElements = xmlDoc.getElementsByTagName('row');
    const grid: any[][] = [];

    for (let i = 0; i < rowElements.length; i++) {
      const rowElem = rowElements[i];
      const cellElements = rowElem.getElementsByTagName('c');
      const rowValues: any[] = [];

      for (let j = 0; j < cellElements.length; j++) {
        const cell = cellElements[j];
        const cellRef = cell.getAttribute('r') || ''; // e.g. "A1", "C2"
        const cellType = cell.getAttribute('t'); // "s" for shared string, "b" for boolean, etc.

        // Determine column index from cell reference like "B4" -> col 1
        const colLettersMatch = cellRef.match(/^([A-Z]+)/);
        const colIndex = colLettersMatch ? colLetterToIndex(colLettersMatch[1]) : rowValues.length;

        // Get cell value
        let cellVal: any = '';
        if (cellType === 'inlineStr') {
          const tElem = cell.getElementsByTagName('t')[0];
          cellVal = tElem ? tElem.textContent : '';
        } else {
          const vElem = cell.getElementsByTagName('v')[0];
          const rawVal = vElem ? vElem.textContent : '';
          if (cellType === 's') {
            const strIdx = parseInt(rawVal || '', 10);
            cellVal = !isNaN(strIdx) && sharedStrings[strIdx] !== undefined ? sharedStrings[strIdx] : rawVal;
          } else if (cellType === 'b') {
            cellVal = rawVal === '1' ? 'TRUE' : 'FALSE';
          } else {
            cellVal = rawVal;
          }
        }

        while (rowValues.length < colIndex) {
          rowValues.push('');
        }
        rowValues[colIndex] = cellVal ?? '';
      }

      if (rowValues.some(v => v !== '' && v !== null && v !== undefined)) {
        grid.push(rowValues);
      }
    }

    return parseRowsToProducts(grid);
  } catch (err: any) {
    throw new Error(`Failed to parse Excel sheet: ${err.message || 'Corrupted or unsupported format'}`);
  }
}

// Parse a CSV File or Text
export function parseCSVFile(file: File): Promise<ParsedProductRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as any[][];
          const parsed = parseRowsToProducts(rows);
          resolve(parsed);
        } catch (e: any) {
          reject(new Error(e.message || 'Error processing CSV rows'));
        }
      },
      error: (error) => {
        reject(new Error(error.message));
      }
    });
  });
}

// Generate Downloadable Excel/CSV Template with Sample Rows and Explanations
export function generateSampleCSVTemplate(): string {
  const headers = [
    'Title',
    'Category',
    'Price',
    'OriginalPrice',
    'InStock',
    'Sizes',
    'StockPerSize',
    'ImageUrl',
    'FabricDetails',
    'Description',
    'IsNewArrival'
  ];

  const sampleRows = [
    [
      '"Royal Kasavu Gold Fusion Tunic Set"',
      '"Fusion Wear"',
      '2499',
      '3199',
      'TRUE',
      '"S, M, L, XL, XXL"',
      '"S:3, M:5, L:8, XL:5, XXL:2"',
      '"https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800"',
      '"Pure Kerala Tissue Cotton with Gold Zari"',
      '"Elegant Kasavu fusion tunic with golden border detailing and tailored pants."',
      'TRUE'
    ],
    [
      '"Temple Border Kanchipuram Silk Saree"',
      '"Traditional Sarees"',
      '4299',
      '5999',
      'TRUE',
      '"Free Size"',
      '"Free Size:10"',
      '"https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800"',
      '"Authentic Silk Handloom with Rich Pallu"',
      '"Classic ceremonial wedding saree woven with intricate temple borders."',
      'TRUE'
    ],
    [
      '"Maroon & Gold Zari Co-ord Set"',
      '"Co-ord Sets"',
      '1899',
      '2499',
      'TRUE',
      '"M, L, XL"',
      '"M:6, L:6, XL:4"',
      '"https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800"',
      '"Soft Chanderi with Handcrafted Zari"',
      '"Contemporary festive 2-piece co-ord set with statement collar."',
      'FALSE'
    ],
    [
      '"Emerald Anarkali Churidar Set"',
      '"Churidar Sets"',
      '2199',
      '2899',
      'TRUE',
      '"S, M, L, XL, XXL"',
      '"S:2, M:5, L:5, XL:3, XXL:2"',
      '"https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=800"',
      '"Georgette with Embroidered Neckline"',
      '"Flowy Anarkali silhouette with matching churidar and dupatta."',
      'TRUE'
    ]
  ];

  return [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
}
