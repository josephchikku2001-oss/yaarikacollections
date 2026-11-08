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
  CheckCheck,
  X
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
import firebaseConfig from '../../firebase-applet-config.json';

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
  const [isCreatingSheet, setIsCreatingSheet] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [sheetStatusMessage, setSheetStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Script Modal State (shows when clicking 1-Click Copy Script Code)
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

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

  // Handle 1-Click Copy Script Code with interactive visual modal popup
  const handleCopyScript = () => {
    navigator.clipboard.writeText(SAMPLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setShowScriptModal(true);
    onToast('Google Apps Script code copied to clipboard!');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  // 1-Click: Create New Google Sheet in Drive
  const handleCreateNewSheet = async () => {
    setIsCreatingSheet(true);
    setSheetStatusMessage(null);

    // If user is already signed in with Google, use Google Sheets API directly
    if (googleUser) {
      try {
        const result = await GoogleSheetsService.createNewSpreadsheet('Yaarika Collections - Product Catalog');
        if (result.success && result.spreadsheetId) {
          setSpreadsheetIdInput(result.spreadsheetId);
          setSheetStatusMessage({
            type: 'success',
            text: 'Created "Yaarika Collections - Product Catalog" spreadsheet in your Google Drive!'
          });
          onToast('New Google Sheet created and linked!');

          // If products exist, push them
          if (products.length > 0) {
            GoogleSheetsService.pushAllProductsToSheet(products).then(pushRes => {
              if (pushRes.success) {
                onToast(`Populated Google Sheet with ${pushRes.count} products!`);
              }
            });
          }
          setIsCreatingSheet(false);
          return;
        }
      } catch (err: any) {
        console.warn('Direct API create error, using 1-click fallback:', err);
      }
    }

    // Zero-Auth 1-Click Fallback: Open Google Sheets directly without requiring sign-in or domain permissions
    try {
      // Copy standard header row to clipboard so user can just paste into row 1
      const headerRow = SHEET_HEADERS.join('\t');
      navigator.clipboard.writeText(headerRow).catch(() => {});

      // Open new Google Sheet in browser
      window.open('https://sheets.new', '_blank');

      onToast('Opening new Google Sheet in Google Drive... Row 1 headers copied to clipboard!');
      setSheetStatusMessage({
        type: 'info',
        text: 'പുതിയ Google Sheet തുറന്നു! മുകളിലെ വരിയിൽ (Row 1) പേസ്റ്റ് ചെയ്യുക, ശേഷം ലിങ്ക് താഴെയുള്ള ബോക്സിൽ നൽകുക.'
      });
    } catch (e) {
      window.open('https://docs.google.com/spreadsheets/u/0/create', '_blank');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Google Sign-In handler with clear error messaging
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSheetStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
        onToast(`Signed in as ${res.user.displayName || res.user.email}`);
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      const errMsg = String(err?.message || '');
      const errCode = String(err?.code || '');
      const isUnauthorizedDomain = errCode === 'auth/unauthorized-domain' || errMsg.includes('auth/unauthorized-domain');
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your-app.vercel.app';

      if (isUnauthorizedDomain) {
        setSheetStatusMessage({
          type: 'error',
          text: `Firebase auth/unauthorized-domain: "${currentHost}" Firebase-ൽ അംഗീകരിച്ചിട്ടില്ല. ലോഗിൻ ആവശ്യമില്ലാതെ തന്നെ പ്രവർത്തിക്കാൻ "1-Click Copy Script Code" അല്ലെങ്കിൽ "1-Click Create Google Sheet" ഉപയോഗിക്കുക!`
        });
      } else {
        setSheetStatusMessage({
          type: 'error',
          text: `Sign-in failed: ${errMsg || 'Could not connect with Google'}`
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    onToast('Signed out of Google account.');
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

      {/* 1-CLICK: CREATE NEW GOOGLE SHEET IN MY DRIVE (EXACTLY AS IN SCREENSHOT) */}
      <div className="bg-white rounded-3xl border-2 border-emerald-500/40 p-5 sm:p-6 shadow-md space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base text-gray-900 font-cinzel">
                1-Click Google Sheet Automation
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                ഒരു ക്ലിക്കിൽ ഗൂഗിൾ ഡ്രൈവിൽ പുതിയ കാറ്റലോഗ് ഷീറ്റ് നിർമ്മിക്കുകയോ കോഡ് കോപ്പി ചെയ്യുകയോ ചെയ്യാം.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* EXACT BUTTON FROM USER'S REQUEST */}
            <button
              type="button"
              onClick={handleCopyScript}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>One-Click Copy Script Code</span>
            </button>
          </div>
        </div>

        {/* GREEN 1-CLICK CREATE SHEET BUTTON (MATCHING SCREENSHOT) */}
        <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
          <button
            type="button"
            onClick={handleCreateNewSheet}
            disabled={isCreatingSheet}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#005a3c] hover:bg-[#004830] text-white font-extrabold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
          >
            <Plus className={`w-4 h-4 text-emerald-300 ${isCreatingSheet ? 'animate-spin' : ''}`} />
            <span>+ 1-CLICK: CREATE NEW GOOGLE SHEET IN MY DRIVE</span>
          </button>
          <p className="text-[11px] text-gray-600 text-center font-medium">
            Automatically creates a formatted "Yaarika Collections - Product Catalog" in your Google Drive with all 13 columns.
          </p>
        </div>

      </div>

      {/* MAIN TWO COLUMN GRID: GOOGLE AUTH & LINK SPREADSHEET */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card 1: Google Account Authorization (Matching Screenshot) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Google Account Authorization</span>
              </h4>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                googleUser ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {googleUser ? 'Authorized' : 'Not Signed In'}
              </span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Sign in with your Google account to grant permission for reading and updating spreadsheets directly from this applet with zero backend server.
            </p>

            {googleUser ? (
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {googleUser.photoURL ? (
                    <img 
                      src={googleUser.photoURL} 
                      alt={googleUser.displayName || 'Google User'} 
                      className="w-10 h-10 rounded-full border border-emerald-300 shadow-xs object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {(googleUser.displayName || googleUser.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-950 truncate">
                      {googleUser.displayName || 'Connected Account'}
                    </p>
                    <p className="text-[11px] text-emerald-800/80 truncate">
                      {googleUser.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 flex flex-col items-center justify-center text-center p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                <p className="text-xs text-gray-600">
                  Click below to authorize Google Sheets API access:
                </p>

                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="gsi-material-button shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents font-semibold">
                      {isSigningIn ? 'Connecting to Google...' : 'Sign in with Google'}
                    </span>
                  </div>
                </button>

                <p className="text-[11px] text-gray-500">
                  കുറിപ്പ്: Vercel-ൽ ലോഗിൻ എറർ വരുന്നുണ്ടെങ്കിൽ മുകളിലുള്ള <strong>"One-Click Copy Script Code"</strong> ഉപയോഗിക്കാം. ലോഗിൻ ഇല്ലാതെ തന്നെ സേവ് ആകും!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Link Google Spreadsheet (Matching Screenshot) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4">
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
                <Link className="w-5 h-5 text-emerald-600" />
                <span>Link Google Spreadsheet</span>
              </h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Google Sheet URL or Spreadsheet ID
              </label>
              <input
                type="text"
                value={spreadsheetIdInput}
                onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit or Sheet ID"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Paste the full browser link of any Google Sheet, or the ID between /d/ and /edit.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Google Apps Script Web App URL (For Zero-Auth Saving)
              </label>
              <input
                type="text"
                value={appsScriptUrlInput}
                onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Deploy ചെയ്ത വെബ് ആപ്പ് ലിങ്ക് (Ends with /exec).
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Tab Name:</span>
              <input
                type="text"
                value={sheetTabInput}
                onChange={(e) => setSheetTabInput(e.target.value)}
                placeholder="Products"
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono w-32 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#4A0E17]" /> : <Check className="w-3.5 h-3.5 text-[#4A0E17]" />}
              <span>Save &amp; Link Spreadsheet</span>
            </button>
          </form>

          {/* Auto Sync Toggle */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60">
            <div>
              <span className="text-xs font-bold text-gray-800 block">
                Automatic Sync on Add (Manual, Excel, CSV)
              </span>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Whenever you add products via form, Excel (.xlsx) or CSV, automatically append to this sheet.
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
        </div>

      </div>

      {/* TWO-WAY SYNC CONTROLS */}
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
      </div>

      {/* SCRIPT MODAL (OPENED ON 1-CLICK COPY SCRIPT CODE) */}
      {showScriptModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-300 shadow-2xl p-6 space-y-5 animate-scale-up my-8">
            
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <CheckCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-gray-900 font-cinzel">
                    Script Code Copied to Clipboard!
                  </h4>
                  <p className="text-xs text-gray-500">
                    Google Apps Script കോഡ് കോപ്പി ആയിട്ടുണ്ട്. ഇനി താഴെ പറയുന്ന സ്റ്റെപ്പുകൾ ചെയ്യുക:
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Step Instructions */}
            <div className="space-y-2.5 text-xs text-gray-700">
              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong className="block text-gray-900">Google Sheet തുറക്കുക</strong>
                  <span>മുകളിലെ മെനുവിൽ <strong>Extensions ➔ Apps Script</strong> ക്ലിക്ക് ചെയ്യുക.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong className="block text-gray-900">കോഡ് പേസ്റ്റ് ചെയ്യുക</strong>
                  <span>പഴയ കോഡ് മാറ്റി ഇപ്പൊൾ കോപ്പി ചെയ്ത കോഡ് പേസ്റ്റ് ചെയ്ത് <strong>Save (💾)</strong> ചെയ്യുക.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                <div>
                  <strong className="block text-gray-900">Deploy as Web App</strong>
                  <span>മുകളിൽ <strong>Deploy ➔ New deployment ➔ Web app</strong> തിരഞ്ഞെടുത്ത് Who has access എന്നത് <strong>"Anyone"</strong> നൽകി Deploy ചെയ്യുക.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center justify-center shrink-0">4</span>
                <div>
                  <strong className="block text-gray-900">Web App URL പേസ്റ്റ് ചെയ്യുക</strong>
                  <span>ലഭിക്കുന്ന Web App URL അഡ്മിൻ പാനലിലെ ബോക്സിൽ നൽകി <strong>"Save &amp; Link"</strong> ക്ലിക്ക് ചെയ്യുക.</span>
                </div>
              </div>
            </div>

            {/* Actions in Modal */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.open('https://sheets.new', '_blank');
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
              >
                Done / Close
              </button>
            </div>

          </div>
        </div>
      )}

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
