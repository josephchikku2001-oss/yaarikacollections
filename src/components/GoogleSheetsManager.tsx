import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Upload, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Check, 
  HelpCircle,
  Link,
  Plus,
  LogOut,
  ShieldCheck,
  Copy,
  Globe,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Code2,
  Zap,
  CheckCheck
} from 'lucide-react';
import { Product } from '../types';
import { 
  GoogleSheetsService, 
  SHEET_HEADERS, 
  GOOGLE_SHEETS_UPDATED_EVENT,
  SAMPLE_APPS_SCRIPT_CODE 
} from '../services/googleSheetsService';
import { 
  googleSignIn, 
  logoutGoogle, 
  initAuth, 
  getCurrentGoogleUser 
} from '../services/googleAuth';
import { User } from 'firebase/auth';
import { ProductStorage } from '../services/storage';

interface GoogleSheetsManagerProps {
  products: Product[];
  onRefreshCatalog: () => void;
  onToast: (msg: string) => void;
}

export const GoogleSheetsManager: React.FC<GoogleSheetsManagerProps> = ({
  products,
  onRefreshCatalog,
  onToast
}) => {
  const [googleUser, setGoogleUser] = useState<User | null>(() => getCurrentGoogleUser());
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  
  // Sheet Configuration
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState<string>(() => GoogleSheetsService.getAppsScriptUrl() || '');
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>(() => GoogleSheetsService.getSpreadsheetId() || '');
  const [sheetTabInput, setSheetTabInput] = useState<string>(() => GoogleSheetsService.getSheetTabName());
  const [autoSync, setAutoSync] = useState<boolean>(() => GoogleSheetsService.getAutoSyncEnabled());
  const [lastSync, setLastSync] = useState<string | null>(() => GoogleSheetsService.getLastSyncedTime());
  
  // Loading & Feedback
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [sheetStatusMessage, setSheetStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Script Copy State
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showScriptCode, setShowScriptCode] = useState<boolean>(false);

  // Confirmation Modals
  const [showPullConfirm, setShowPullConfirm] = useState<boolean>(false);
  const [showPushConfirm, setShowPushConfirm] = useState<boolean>(false);

  useEffect(() => {
    // Sync shared config from server
    GoogleSheetsService.initSharedConfig().then(cfg => {
      if (cfg.spreadsheetId) setSpreadsheetIdInput(cfg.spreadsheetId);
      if (cfg.appsScriptUrl) setAppsScriptUrlInput(cfg.appsScriptUrl);
    }).catch(() => {});

    // Listen for auth state
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );

    const handleSheetsUpdate = () => {
      setSpreadsheetIdInput(GoogleSheetsService.getSpreadsheetId() || '');
      setAppsScriptUrlInput(GoogleSheetsService.getAppsScriptUrl() || '');
      setSheetTabInput(GoogleSheetsService.getSheetTabName());
      setAutoSync(GoogleSheetsService.getAutoSyncEnabled());
      setLastSync(GoogleSheetsService.getLastSyncedTime());
    };

    window.addEventListener(GOOGLE_SHEETS_UPDATED_EVENT, handleSheetsUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener(GOOGLE_SHEETS_UPDATED_EVENT, handleSheetsUpdate);
    };
  }, []);

  const isConnected = GoogleSheetsService.isConfigured();
  const currentSheetId = GoogleSheetsService.getSpreadsheetId();
  const currentAppsScriptUrl = GoogleSheetsService.getAppsScriptUrl();

  const handleCopyScript = () => {
    navigator.clipboard.writeText(SAMPLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    onToast('Google Apps Script code copied to clipboard!');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  // Save Settings
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setSheetStatusMessage(null);

    try {
      const cleanScriptUrl = appsScriptUrlInput.trim();
      const cleanSheetId = GoogleSheetsService.extractSpreadsheetId(spreadsheetIdInput);
      const cleanTab = sheetTabInput.trim() || 'Sheet1';

      GoogleSheetsService.setAppsScriptUrl(cleanScriptUrl);
      GoogleSheetsService.setSpreadsheetId(cleanSheetId);
      GoogleSheetsService.setSheetTabName(cleanTab);

      // Save to server
      const res = await fetch('/api/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appsScriptUrl: cleanScriptUrl,
          spreadsheetId: cleanSheetId,
          sheetTab: cleanTab,
          autoSync
        })
      });

      if (res.ok) {
        setSheetStatusMessage({
          type: 'success',
          text: 'Google Sheet കണക്ഷൻ സേവ് ചെയ്തു! തത്സമയ സിങ്ക് പ്രവർത്തനക്ഷമമാണ്.'
        });
        onToast('Google Sheet configuration saved & synced!');

        // Trigger immediate pull to verify and load items
        if (cleanScriptUrl || cleanSheetId) {
          triggerSyncNow();
        }
      }
    } catch (err: any) {
      setSheetStatusMessage({
        type: 'error',
        text: 'Error saving config: ' + err.message
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Immediate Sync / Pull Now
  const triggerSyncNow = async () => {
    setIsPulling(true);
    setSheetStatusMessage(null);
    try {
      const res = await fetch('/api/sheet/sync-now', { method: 'POST' });
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        ProductStorage.mergeWithCloudProducts(data.products);
        onRefreshCatalog();
        setSheetStatusMessage({
          type: 'success',
          text: `വിജയകരം! Google Sheet-ൽ നിന്ന് ${data.products.length} പ്രൊഡക്റ്റുകൾ വെബ്സൈറ്റിൽ തത്സമയം സിങ്ക് ആയി.`
        });
        onToast(`Successfully synced ${data.products.length} products from Google Sheet!`);
      } else {
        // Fallback to client-side fetch
        const clientRes = await GoogleSheetsService.fetchProductsFromSheet();
        if (clientRes.success && clientRes.products.length > 0) {
          ProductStorage.mergeWithCloudProducts(clientRes.products);
          onRefreshCatalog();
          setSheetStatusMessage({
            type: 'success',
            text: `Google Sheet-ൽ നിന്ന് ${clientRes.products.length} പ്രൊഡക്റ്റുകൾ വെബ്സൈറ്റിൽ ലോഡ് ആയി!`
          });
          onToast(`Loaded ${clientRes.products.length} products from Google Sheet!`);
        } else {
          setSheetStatusMessage({
            type: 'info',
            text: clientRes.error || 'Google Sheet ഇപ്പോൾ ശൂന്യമാണ് അല്ലെങ്കിൽ കണക്ഷൻ പരിശോധിക്കുക.'
          });
        }
      }
    } catch (err: any) {
      setSheetStatusMessage({
        type: 'error',
        text: 'Sync error: ' + (err.message || 'Could not reach sheet')
      });
    } finally {
      setIsPulling(false);
    }
  };

  // Push All Products to Google Sheet
  const handlePushAllToSheet = async () => {
    setShowPushConfirm(false);
    setIsPushing(true);
    setSheetStatusMessage(null);

    try {
      const res = await GoogleSheetsService.pushAllProductsToSheet(products);
      if (res.success) {
        setSheetStatusMessage({
          type: 'success',
          text: `വിജയകരം! നിലവിലെ ${res.count} പ്രൊഡക്റ്റുകളും Google Sheet-ലേക്ക് സേവ് ആയി.`
        });
        onToast(`Pushed all ${res.count} products to Google Sheet!`);
      } else {
        setSheetStatusMessage({
          type: 'error',
          text: res.error || 'Failed to push products to Google Sheet.'
        });
      }
    } catch (err: any) {
      setSheetStatusMessage({
        type: 'error',
        text: 'Push error: ' + err.message
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleToggleAutoSync = () => {
    const next = !autoSync;
    setAutoSync(next);
    GoogleSheetsService.setAutoSyncEnabled(next);
    fetch('/api/sheet-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoSync: next })
    }).catch(() => {});
    onToast(`Auto-sync to Google Sheet: ${next ? 'ENABLED' : 'DISABLED'}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Top Banner: 100% Free Guarantee */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0e3b2e] to-emerald-950 text-white p-5 sm:p-6 rounded-3xl border border-emerald-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0 shadow-inner">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-cinzel text-lg sm:text-xl font-bold tracking-wide text-white">
                Google Sheets Automated Real-Time Sync
              </h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                isConnected
                  ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/50'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                {isConnected ? 'Connected & Auto-Sync Active' : 'Setup Required'}
              </span>
            </div>
            <p className="text-xs text-emerald-200/90 mt-1 max-w-2xl leading-relaxed">
              അഡ്മിൻ ആഡ് ചെയ്യുന്ന പ്രൊഡക്റ്റുകളും എക്സൽ ഷീറ്റിലെ വിവരങ്ങളും ഓട്ടോമാറ്റിക്കായി ഗൂഗിൾ ഷീറ്റിലോട്ട് സേവ് ആവുകയും, ഏത് ഫോണിലോ കമ്പ്യൂട്ടറിലോ ഈ സൈറ്റ് ഓപ്പൺ ആക്കിയാലും ഗൂഗിൾ ഷീറ്റിൽ നിന്ന് ഫെച്ച് ചെയ്ത് ഡിസ്പ്ലേ ചെയ്യുകയും ചെയ്യും.
            </p>
          </div>
        </div>

        {/* 100% Free Badge */}
        <div className="bg-emerald-900/60 border border-emerald-400/40 px-3.5 py-2 rounded-2xl text-center self-stretch md:self-auto shrink-0">
          <span className="text-[10px] text-emerald-300 uppercase tracking-widest font-bold block">Cost / പണം</span>
          <span className="text-xs font-black text-white flex items-center justify-center gap-1 mt-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% സൗജന്യം (No Upgrade)</span>
          </span>
        </div>
      </div>

      {sheetStatusMessage && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-sm animate-fade-in ${
          sheetStatusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
            : sheetStatusMessage.type === 'error'
            ? 'bg-rose-50 text-rose-900 border border-rose-300'
            : 'bg-blue-50 text-blue-900 border border-blue-300'
        }`}>
          {sheetStatusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {sheetStatusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          {sheetStatusMessage.type === 'info' && <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />}
          <span className="flex-1 leading-relaxed">{sheetStatusMessage.text}</span>
        </div>
      )}

      {/* METHOD 1: RECOMMENDED GOOGLE APPS SCRIPT WEB APP (ZERO AUTH, NO UPGRADE, 100% FREE) */}
      <div className="bg-white rounded-3xl border-2 border-emerald-500/30 p-5 sm:p-6 shadow-md space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-gray-900 font-cinzel">
                  മാർഗ്ഗം 1: Google Apps Script Web App (ഏറ്റവും എളുപ്പമുള്ള വഴി - 100% സൗജന്യം)
                </h4>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                ഗൂഗിൾ ഷീറ്റിൽ ഒരു തവണ ഈ സ്ക്രിപ്റ്റ് ചേർത്താൽ, ലോഗിൻ ആവശ്യമില്ലാതെ തന്നെ ഏത് ഡിവൈസിൽ നിന്നും പ്രൊഡക്റ്റുകൾ സേവ് ചെയ്യാനും ഫെച്ച് ചെയ്യാനും സാധിക്കും.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyScript}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer shrink-0"
          >
            {copiedScript ? <CheckCheck className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copiedScript ? 'കോഡ് കോപ്പി ആയി!' : '1-Click Copy Script Code'}</span>
          </button>
        </div>

        {/* 4 Step Visual Quick Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-700">
          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
              1
            </div>
            <strong className="block text-gray-900 text-xs font-bold">Open Apps Script</strong>
            <p className="text-[11px] text-gray-600 leading-snug">
              നിങ്ങളുടെ Google Sheet തുറക്കുക. മുകളിലെ മെനുവിൽ <strong>Extensions ➔ Apps Script</strong> ക്ലിക്ക് ചെയ്യുക.
            </p>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
              2
            </div>
            <strong className="block text-gray-900 text-xs font-bold">Paste &amp; Save</strong>
            <p className="text-[11px] text-gray-600 leading-snug">
              പഴയ കോഡ് മാറ്റി മുകളിലെ <strong>"Copy Script Code"</strong> ബട്ടൺ വഴി ലഭിച്ച കോഡ് പേസ്റ്റ് ചെയ്ത് <strong>Save (💾)</strong> ചെയ്യുക.
            </p>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
              3
            </div>
            <strong className="block text-gray-900 text-xs font-bold">Deploy as Web App</strong>
            <p className="text-[11px] text-gray-600 leading-snug">
              <strong>Deploy ➔ New deployment ➔ Web app</strong> തിരഞ്ഞെടുക്കുക. Who has access എന്നത് <strong>"Anyone"</strong> നൽകി Deploy ക്ലിക്ക് ചെയ്യുക.
            </p>
          </div>

          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
              4
            </div>
            <strong className="block text-gray-900 text-xs font-bold">Paste URL Below</strong>
            <p className="text-[11px] text-gray-600 leading-snug">
              ലഭിക്കുന്ന <strong>Web app URL</strong> താഴെയുള്ള ബോക്സിൽ നൽകി <strong>"Connect &amp; Sync"</strong> ക്ലിക്ക് ചെയ്യുക!
            </p>
          </div>
        </div>

        {/* View Code Accordion */}
        <div>
          <button
            type="button"
            onClick={() => setShowScriptCode(prev => !prev)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 cursor-pointer underline"
          >
            <Code2 className="w-4 h-4 text-emerald-700" />
            <span>{showScriptCode ? 'Hide Apps Script Code' : 'സ്ക്രിപ്റ്റ് കോഡ് കാണുക (View Apps Script Code)'}</span>
            {showScriptCode ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showScriptCode && (
            <div className="mt-2.5 p-3.5 bg-gray-900 text-emerald-300 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-64 border border-gray-800 relative">
              <button
                type="button"
                onClick={handleCopyScript}
                className="absolute top-2 right-2 px-2.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-500 cursor-pointer"
              >
                {copiedScript ? 'Copied!' : 'Copy'}
              </button>
              <pre className="whitespace-pre">{SAMPLE_APPS_SCRIPT_CODE}</pre>
            </div>
          )}
        </div>

        {/* Config Form */}
        <form onSubmit={handleSaveConfig} className="space-y-4 pt-2 border-t border-gray-100">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Apps Script Web App URL */}
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Apps Script Web App URL *</span>
              </label>
              <input
                type="text"
                value={appsScriptUrlInput}
                onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Deploy ചെയ്ത ശേഷം ലഭിക്കുന്ന Web App URL ഇവിടെ പേസ്റ്റ് ചെയ്യുക (Ends with /exec).
              </span>
            </div>

            {/* Google Spreadsheet URL / ID (Optional Direct Link) */}
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Spreadsheet Link or ID (Optional)</span>
              </label>
              <input
                type="text"
                value={spreadsheetIdInput}
                onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit or ID"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                ഷീറ്റ് നേരിട്ട് ബ്രൗസറിൽ തുറക്കാനും പൊതുവായി റീഡ് ചെയ്യാനും ഉപയോഗിക്കാം.
              </span>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Tab Name:</span>
              <input
                type="text"
                value={sheetTabInput}
                onChange={(e) => setSheetTabInput(e.target.value)}
                placeholder="Sheet1 or Products"
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono w-32 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingConfig}
              className="px-6 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#4A0E17]" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#4A0E17]" />}
              <span>Save &amp; Connect Google Sheet</span>
            </button>

          </div>

        </form>

      </div>

      {/* AUTO-SYNC TOGGLE & DIRECT ACTIONS */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h4 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              <span>Real-Time Sync Actions &amp; Controls</span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Pull products from Google Sheet or Push current catalog to Google Sheet.
            </p>
          </div>

          <div className="text-right text-[11px] text-gray-500">
            <span>Last Synced: </span>
            <strong className="text-gray-800">
              {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Not synced yet'}
            </strong>
          </div>
        </div>

        {/* Auto Sync Toggle Banner */}
        <div className="flex items-center justify-between gap-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
          <div>
            <span className="text-xs font-bold text-emerald-950 block">
              Automatic Sync on Add (Manual Products &amp; Excel Import)
            </span>
            <p className="text-[11px] text-emerald-800/80 mt-0.5">
              അഡ്മിൻ പുതിയ പ്രൊഡക്റ്റ് ആഡ് ചെയ്യുമ്പോഴും എക്സൽ ഷീറ്റ് അപ്‌ലോഡ് ചെയ്യുമ്പോഴും ഓട്ടോമാറ്റിക്കായി ഗൂഗിൾ ഷീറ്റിലോട്ട് സേവ് ചെയ്യപ്പെടും.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoSync}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
              autoSync ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                autoSync ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Sync Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Pull from Google Sheet */}
          <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Pull from Google Sheet ➔ Display on Website</span>
              </span>
              <p className="text-[11px] text-emerald-800/80 mt-1 leading-relaxed">
                ഗൂഗിൾ ഷീറ്റിലെ എല്ലാ വിവരങ്ങളും ഇപ്പോൾ തന്നെ ഫെച്ച് ചെയ്ത് വെബ്‌സൈറ്റിലെ കാറ്റലോഗിൽ ലൈവായി പ്രദർശിപ്പിക്കുക.
              </p>
            </div>

            <button
              type="button"
              disabled={isPulling}
              onClick={() => setShowPullConfirm(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
              <span>{isPulling ? 'Fetching from Google Sheet...' : 'Pull Products from Google Sheet'}</span>
            </button>
          </div>

          {/* Push all to Google Sheet */}
          <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Push Website Catalog ({products.length}) ➔ Google Sheet</span>
              </span>
              <p className="text-[11px] text-amber-800/80 mt-1 leading-relaxed">
                വെബ്സൈറ്റിലെ നിലവിലുള്ള എല്ലാ {products.length} പ്രൊഡക്റ്റുകളും കണക്റ്റ് ചെയ്ത Google Sheet-ലേക്ക് സേവ് ചെയ്യുക.
              </p>
            </div>

            <button
              type="button"
              disabled={isPushing || !isConnected}
              onClick={() => setShowPushConfirm(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#4A0E17] hover:bg-[#32080F] text-[#D4AF37] border border-[#D4AF37] font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Upload className={`w-3.5 h-3.5 text-amber-400 ${isPushing ? 'animate-spin' : ''}`} />
              <span>{isPushing ? 'Pushing to Sheet...' : `Push All (${products.length}) Products to Sheet`}</span>
            </button>
          </div>

        </div>

        {/* 13 Standard Columns Info */}
        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-[11px] text-gray-600 space-y-1">
          <strong className="block text-gray-800 font-bold">Standard Google Sheet Columns (13 Columns):</strong>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SHEET_HEADERS.map((h, i) => (
              <span key={i} className="bg-white border border-gray-300 px-2 py-0.5 rounded text-[10px] font-mono text-gray-700">
                {h}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* CONFIRMATION MODALS */}
      {showPullConfirm && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-gray-300 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <Download className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-bold text-base text-gray-900">
                Pull Products from Google Sheet?
              </h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Google Sheet-ലെ പ്രൊഡക്റ്റുകൾ ഫെച്ച് ചെയ്ത് വെബ്സൈറ്റിൽ അപ്‌ഡേറ്റ് ചെയ്യും. തുടരണോ?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPullConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPullConfirm(false);
                  triggerSyncNow();
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow cursor-pointer"
              >
                Confirm Pull
              </button>
            </div>
          </div>
        </div>
      )}

      {showPushConfirm && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-amber-300 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-bold text-base text-gray-900">
                Push All Products to Google Sheet?
              </h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                വെബ്സൈറ്റിലെ <strong>{products.length} പ്രൊഡക്റ്റുകളും</strong> Google Sheet-ലേക്ക് സേവ് ചെയ്യും. തുടരണോ?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPushConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePushAllToSheet}
                className="flex-1 py-2 rounded-xl bg-[#4A0E17] hover:bg-[#32080F] text-[#D4AF37] border border-[#D4AF37] font-bold text-xs shadow cursor-pointer"
              >
                Confirm Push
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
