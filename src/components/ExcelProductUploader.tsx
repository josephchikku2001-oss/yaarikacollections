import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  Flame, 
  Check, 
  X, 
  Info, 
  ChevronRight,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  parseExcelFile, 
  parseCSVFile, 
  generateSampleCSVTemplate, 
  ParsedProductRow,
  sanitizeImageUrl 
} from '../utils/excelParser';
import { Product } from '../types';
import { ProductStorage } from '../services/storage';

interface ExcelProductUploaderProps {
  onImportComplete: (count: number) => void;
  onToast: (msg: string) => void;
  onRefreshCatalog: () => void;
}

export const ExcelProductUploader: React.FC<ExcelProductUploaderProps> = ({
  onImportComplete,
  onToast,
  onRefreshCatalog
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle Drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle Drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Process file (.xlsx, .xls, .csv)
  const processSelectedFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      setParseError('Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);
    setParsedRows([]);
    setImportSuccessCount(null);

    try {
      let rows: ParsedProductRow[] = [];
      if (ext === 'csv') {
        rows = await parseCSVFile(file);
      } else {
        rows = await parseExcelFile(file);
      }

      if (rows.length === 0) {
        setParseError('No product rows could be found. Please check that the sheet has valid columns (Title, Price, ImageUrl, etc.).');
      } else {
        setParsedRows(rows);
        onToast(`Found ${rows.length} product(s) in "${file.name}" ready for preview!`);
      }
    } catch (err: any) {
      console.error('Excel parse error:', err);
      setParseError(err.message || 'Failed to read Excel file. Please ensure it is not password protected.');
    } finally {
      setIsParsing(false);
    }
  };

  // Remove a row from the preview table
  const handleRemoveRow = (index: number) => {
    const updated = parsedRows.filter((_, i) => i !== index);
    setParsedRows(updated);
    if (updated.length === 0) {
      setSelectedFile(null);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    try {
      const csvContent = generateSampleCSVTemplate();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Yaarika_Products_Template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast('Excel/CSV Template downloaded! Open in Excel/Google Sheets to edit.');
    } catch (err: any) {
      onToast('Failed to download template: ' + err.message);
    }
  };

  // Commit and Import to Catalog & Firestore
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    try {
      const productsToImport: Array<Omit<Product, 'id' | 'createdAt'>> = parsedRows.map(row => ({
        title: row.title,
        category: row.category,
        price: row.price,
        originalPrice: row.originalPrice,
        inStock: row.inStock,
        stockCount: row.stockCount,
        sizeStock: row.sizeStock,
        sizes: row.sizes,
        imageUrl: sanitizeImageUrl(row.imageUrl),
        description: row.description,
        fabricDetails: row.fabricDetails,
        isNewArrival: row.isNewArrival,
        featured: row.featured
      }));

      const res = ProductStorage.bulkAddProducts(productsToImport);

      setImportSuccessCount(res.added);
      onToast(`Successfully added ${res.added} products from Excel to website & Firestore!`);
      onRefreshCatalog();
      onImportComplete(res.added);

      // Reset state after brief delay
      setTimeout(() => {
        setParsedRows([]);
        setSelectedFile(null);
      }, 2000);
    } catch (err: any) {
      console.error('Import failure:', err);
      setParseError('Failed to import products: ' + (err.message || 'Unknown error'));
    } finally {
      setIsImporting(false);
    }
  };

  // Reset uploader
  const handleReset = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setParseError(null);
    setImportSuccessCount(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Template Download */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 p-4 sm:p-5 rounded-2xl border border-[#D4AF37]/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#4A0E17] text-[#D4AF37] flex items-center justify-center shrink-0 shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-cinzel text-sm sm:text-base font-bold text-[#4A0E17] flex items-center gap-2">
              <span>Excel (.xlsx / .xls) &amp; CSV Sheet Upload</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">
                Direct Image Sync
              </span>
            </h4>
            <p className="text-xs text-gray-600 mt-0.5 max-w-xl">
              Excel ഷീറ്റിൽ ടൈറ്റിൽ, വില, സൈസ്, ഇമേജ് ലിങ്ക് (Image URL/Google Drive) നൽകി ഒറ്റ ക്ലിക്കിൽ എല്ലാ ഉൽപ്പന്നങ്ങളും വെബ്‌സൈറ്റിലേക്ക് ചേർക്കാം.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="px-4 py-2 bg-white hover:bg-amber-50 text-[#4A0E17] border border-[#D4AF37] rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs shrink-0 self-stretch sm:self-auto justify-center"
        >
          <Download className="w-4 h-4 text-[#A67C1E]" />
          <span>Download Excel Template (.CSV)</span>
        </button>
      </div>

      {/* Upload Drag & Drop Zone (if no file selected or parsed) */}
      {parsedRows.length === 0 && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 relative ${
            dragActive
              ? 'border-[#4A0E17] bg-amber-50/70 scale-[1.01]'
              : 'border-gray-300 hover:border-[#D4AF37] bg-[#FDFCF8] hover:bg-amber-50/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-amber-100/80 text-[#4A0E17] flex items-center justify-center shadow-xs">
            {isParsing ? (
              <RefreshCw className="w-8 h-8 animate-spin text-[#4A0E17]" />
            ) : (
              <UploadCloud className="w-8 h-8 text-[#4A0E17]" />
            )}
          </div>

          <div>
            <p className="text-sm font-bold text-gray-900">
              {isParsing ? 'Reading Excel File...' : 'Click to Upload or Drag & Drop Excel Sheet'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports <strong className="text-gray-700">.xlsx, .xls, .csv</strong> files (Microsoft Excel, Google Sheets, Apple Numbers)
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] text-gray-500">
            <span className="px-2 py-0.5 bg-gray-100 rounded-md border border-gray-200">Title / Name</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded-md border border-gray-200">Category</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded-md border border-gray-200">Price (INR)</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded-md border border-gray-200">ImageUrl (Photo)</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded-md border border-gray-200">Sizes (S, M, L...)</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded-md border border-gray-200">Stock Count</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {parseError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{parseError}</span>
            <p className="font-normal text-[11px] text-rose-700 mt-1">
              Tip: Download our template above to make sure the column headers match correctly.
            </p>
          </div>
          <button type="button" onClick={() => setParseError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Notification */}
      {importSuccessCount !== null && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Successfully uploaded <strong>{importSuccessCount}</strong> products with photos to website and synced to Firestore!
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
          >
            Upload Another Sheet
          </button>
        </div>
      )}

      {/* PREVIEW TABLE (When Rows Are Parsed) */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#D4AF37]/30 shadow-sm overflow-hidden space-y-4">
          
          {/* Header Bar */}
          <div className="p-4 sm:p-5 bg-[#FDFCF8] border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h5 className="text-sm font-bold text-[#4A0E17] font-cinzel">
                  Excel Preview: {parsedRows.length} Product(s) Ready to Import
                </h5>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                File: <span className="font-semibold text-gray-800">{selectedFile?.name}</span> • Verify photo links &amp; prices below before adding.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isImporting}
                className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all"
              >
                Cancel / Re-upload
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="px-5 py-2 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#4A0E17]" />
                    <span>Importing to Website...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 text-[#4A0E17]" />
                    <span>Add {parsedRows.length} Products to Website</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table of Parsed Products */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-100/95 backdrop-blur-xs text-gray-700 uppercase font-bold border-b border-gray-200 z-10">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Photo / Image</th>
                  <th className="p-3">Product Title &amp; Fabric</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price (Offer / MRP)</th>
                  <th className="p-3">Sizes &amp; Stock</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedRows.map((row, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                      <td className="p-3 text-gray-400 font-mono font-bold text-[10px]">
                        {idx + 1}
                      </td>

                      {/* Product Image Preview */}
                      <td className="p-3">
                        <div className="relative w-12 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shadow-2xs group">
                          <img
                            src={row.imageUrl}
                            alt={row.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
                            }}
                          />
                        </div>
                      </td>

                      {/* Title & Notes */}
                      <td className="p-3 max-w-xs">
                        <div className="font-bold text-gray-900 line-clamp-1">{row.title}</div>
                        <div className="text-[10px] text-gray-500 line-clamp-1">{row.fabricDetails || row.description}</div>
                        {row.isNewArrival && (
                          <span className="inline-block mt-0.5 text-[8px] bg-[#4A0E17] text-[#D4AF37] px-1.5 py-0.2 rounded font-bold uppercase">
                            New Arrival
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="font-semibold text-[#A67C1E] bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 text-[10px]">
                          {row.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="p-3">
                        <div className="font-bold text-[#4A0E17]">
                          ₹{row.price.toLocaleString('en-IN')}
                        </div>
                        {row.originalPrice && row.originalPrice > row.price && (
                          <div className="text-[10px] text-gray-400 line-through">
                            ₹{row.originalPrice.toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>

                      {/* Sizes & Stock */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {row.sizes.map(s => {
                            const count = row.sizeStock ? row.sizeStock[s] : undefined;
                            return (
                              <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 border text-[9px] font-bold text-gray-700">
                                {s}{count !== undefined ? `: ${count}` : ''}
                              </span>
                            );
                          })}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1">
                          Total: <strong className="text-gray-800">{row.stockCount ?? 0} units</strong>
                        </div>
                      </td>

                      {/* Stock Status */}
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          row.inStock 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${row.inStock ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {row.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>

                      {/* Remove Row */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Exclude this product from import"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Confirmation Bar */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-gray-600">
              Total <strong className="text-gray-900">{parsedRows.length}</strong> product(s) will be added to your live store.
            </span>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#4A0E17]" />
                  <span>Importing &amp; Syncing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#4A0E17]" />
                  <span>Confirm &amp; Publish {parsedRows.length} Products to Website</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* Helpful Instructions Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
        <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <Info className="w-4 h-4 text-[#4A0E17]" />
          <span>Excel Sheet Guidelines (എക്സൽ ഷീറ്റ് നിർദ്ദേശങ്ങൾ)</span>
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-gray-600">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
            <div className="font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#A67C1E]" />
              <span>1. Image Links (ഫോട്ടോകൾ)</span>
            </div>
            <p>
              Google Drive direct share link (view/open), Unsplash, Cloudinary, Imgur, അല്ലെങ്കിൽ ഏതെങ്കിലും പബ്ലിക് ഇമേജ് URL നൽകാം.
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
            <div className="font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#A67C1E]" />
              <span>2. Categories (വിഭാഗങ്ങൾ)</span>
            </div>
            <p>
              Traditional Sarees, Co-ord Sets, Churidar Sets, Fusion Wear, New Arrivals എന്നിവയിൽ ഏതെങ്കിലും തിരഞ്ഞെടുക്കുക.
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
            <div className="font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#A67C1E]" />
              <span>3. Sizes &amp; Stock (സൈസ് &amp; സ്റ്റോക്ക്)</span>
            </div>
            <p>
              Sizes കോളത്തിൽ <code>S, M, L, XL, XXL</code> അല്ലെങ്കിൽ <code>Free Size</code> എന്നും, Stock കോളത്തിൽ ഓരോ സൈസിന്റേയും എണ്ണവും നൽകാം.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
