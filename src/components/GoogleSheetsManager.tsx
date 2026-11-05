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
  ShieldCheck
} from 'lucide-react';
import { Product } from '../types';
import { GoogleSheetsService, SHEET_HEADERS, GOOGLE_SHEETS_UPDATED_EVENT } from '../services/googleSheetsService';
import { 
  googleSignIn, 
  logoutGoogle, 
  initAuth, 
  getCurrentGoogleUser, 
  getAccessToken 
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
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>(() => GoogleSheetsService.getSpreadsheetId() || '');
  const [sheetTabInput, setSheetTabInput] = useState<string>(() => GoogleSheetsService.getSheetTabName());
  const [autoSync, setAutoSync] = useState<boolean>(() => GoogleSheetsService.getAutoSyncEnabled());
  const [lastSync, setLastSync] = useState<string | null>(() => GoogleSheetsService.getLastSyncedTime());
  
  // Action Loading States
  const [isCreatingSheet, setIsCreatingSheet] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [sheetStatusMessage, setSheetStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Confirmation Modals (MANDATORY per Workspace guidelines for mutating/overwriting operations)
  const [showPullConfirm, setShowPullConfirm] = useState<boolean>(false);
  const [showPushConfirm, setShowPushConfirm] = useState<boolean>(false);

  useEffect(() => {
    // Listen for auth state
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
      },
      () => {
        setGoogleUser(null);
      }
    );

    const handleSheetsUpdate = () => {
      setSpreadsheetIdInput(GoogleSheetsService.getSpreadsheetId() || '');
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

  const currentSheetId = GoogleSheetsService.getSpreadsheetId();
  const isConnected = GoogleSheetsService.isConfigured();

  // Handle Google Sign-In
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
      setSheetStatusMessage({
        type: 'error',
        text: `Sign-in failed: ${err?.message || 'Could not connect with Google'}`
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  // Handle Sign Out
  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    onToast('Signed out of Google account.');
  };

  // Create a brand new Google Sheet in Drive
  const handleCreateNewSheet = async () => {
    if (!googleUser) {
      onToast('Please sign in with Google first to create a spreadsheet.');
      return;
    }

    setIsCreatingSheet(true);
    setSheetStatusMessage(null);

    try {
      const result = await GoogleSheetsService.createNewSpreadsheet('Yaarika Collections - Product Catalog');
      if (result.success && result.spreadsheetId) {
        setSpreadsheetIdInput(result.spreadsheetId);
        setSheetStatusMessage({
          type: 'success',
          text: 'Created "Yaarika Collections - Product Catalog" spreadsheet in your Google Drive!'
        });
        onToast('New Google Sheet created and linked!');

        // If there are already products in the catalog, ask to push them
        if (products.length > 0) {
          GoogleSheetsService.pushAllProductsToSheet(products).then(pushRes => {
            if (pushRes.success) {
              onToast(`Populated newly created Google Sheet with ${pushRes.count} products!`);
            }
          });
        }
      } else {
        setSheetStatusMessage({
          type: 'error',
          text: result.error || 'Failed to create new spreadsheet'
        });
      }
    } catch (err: any) {
      setSheetStatusMessage({
        type: 'error',
        text: err.message || 'Error creating spreadsheet'
      });
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Save Custom / Existing Spreadsheet ID or Link
  const handleSaveSpreadsheetLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spreadsheetIdInput.trim()) {
      GoogleSheetsService.setSpreadsheetId('');
      setSheetStatusMessage({ type: 'info', text: 'Google Sheet link cleared.' });
      onToast('Spreadsheet link cleared.');
      return;
    }

    const extracted = GoogleSheetsService.extractSpreadsheetId(spreadsheetIdInput);
    if (!extracted) {
      setSheetStatusMessage({ type: 'error', text: 'Please enter a valid Google Sheet URL or Spreadsheet ID.' });
      return;
    }

    GoogleSheetsService.setSpreadsheetId(extracted);
    GoogleSheetsService.setSheetTabName(sheetTabInput || 'Sheet1');
    setSheetStatusMessage({
      type: 'success',
      text: `Successfully linked Google Sheet (ID: ${extracted.substring(0, 15)}...).`
    });
    onToast('Google Sheet linked successfully!');
  };

  // Toggle Auto-Sync
  const handleToggleAutoSync = () => {
    const next = !autoSync;
    setAutoSync(next);
    GoogleSheetsService.setAutoSyncEnabled(next);
    onToast(`Auto-sync to Google Sheet: ${next ? 'ENABLED' : 'DISABLED'}`);
  };

  // Pull products from Google Sheet and update Website
  const confirmPullFromSheet = async () => {
    setShowPullConfirm(false);
    setIsPulling(true);
    setSheetStatusMessage(null);

    try {
      const res = await GoogleSheetsService.fetchProductsFromSheet();
      if (res.success && res.products.length > 0) {
        // Merge into local product storage
        const updated = ProductStorage.mergeWithCloudProducts(res.products);
        onRefreshCatalog();
        setSheetStatusMessage({
          type: 'success',
          text: `Successfully fetched and displayed ${res.products.length} products from Google Sheet on the website!`
        });
        onToast(`Synced ${res.products.length} products from Google Sheet!`);
      } else if (res.success && res.products.length === 0) {
        setSheetStatusMessage({
          type: 'info',
          text: 'Google Sheet is currently empty (no product rows found under header).'
        });
        onToast('Google Sheet is currently empty.');
      } else {
        setSheetStatusMessage({
          type: 'error',
          text: res.error || 'Failed to read products from Google Sheet.'
        });
      }
    } catch (err: any) {
      setSheetStatusMessage({
        type: 'error',
        text: err.message || 'Error pulling from Google Sheet'
      });
    } finally {
      setIsPulling(false);
    }
  };

  // Push all products from website to Google Sheet
  const confirmPushAllToSheet = async () => {
    setShowPushConfirm(false);
    setIsPushing(true);
    setSheetStatusMessage(null);

    try {
      const res = await GoogleSheetsService.pushAllProductsToSheet(products);
      if (res.success) {
        setSheetStatusMessage({
          type: 'success',
          text: `Successfully saved all ${res.count} products to your Google Sheet!`
        });
        onToast(`Pushed ${res.count} products to Google Sheet!`);
      } else {
        setSheetStatusMessage({
          type: 'error',
          text: res.error || 'Failed to push products to Google Sheet.'
        });
      }
    } catch (err: any) {
      setSheetStatusMessage({
        type: 'error',
        text: err.message || 'Error pushing to Google Sheet'
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0e3b2e] to-emerald-950 text-white p-5 sm:p-6 rounded-3xl border border-emerald-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0 shadow-inner">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-cinzel text-lg sm:text-xl font-bold tracking-wide text-white">
                Google Sheets Real-Time Sync
              </h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                isConnected
                  ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/50'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                {isConnected ? 'Connected & Ready' : 'Needs Spreadsheet Link'}
              </span>
            </div>
            <p className="text-xs text-emerald-200/90 mt-1 max-w-2xl leading-relaxed">
              Add products manually, via Excel (.xlsx) or CSV, and they will automatically append to your Google Sheet and display live on your website catalog.
            </p>
          </div>
        </div>

        {isConnected && currentSheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${currentSheetId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all whitespace-nowrap self-stretch md:self-auto justify-center"
          >
            <span>Open in Google Sheets</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
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

      {/* Main Grid: Google Auth & Sheet Linking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card 1: Google Account & OAuth Access */}
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
                  title="Sign out from Google"
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

                {/* Official Material Google Sign-In Button as required by workspace-integration */}
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
              </div>
            )}
          </div>

          {/* Quick Create Button */}
          <div className="pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleCreateNewSheet}
              disabled={isCreatingSheet}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              <Plus className={`w-4 h-4 ${isCreatingSheet ? 'animate-spin' : ''}`} />
              <span>{isCreatingSheet ? 'Creating Sheet in Drive...' : '1-Click: Create New Google Sheet in My Drive'}</span>
            </button>
            <p className="text-[11px] text-gray-500 mt-1 text-center">
              Automatically creates a formatted "Yaarika Collections - Product Catalog" in your Google Drive with all 13 columns.
            </p>
          </div>
        </div>

        {/* Card 2: Link Existing Sheet / Custom Sheet Configuration */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4">
          <form onSubmit={handleSaveSpreadsheetLink} className="space-y-4">
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
                Tab Name (Default: Products)
              </label>
              <input
                type="text"
                value={sheetTabInput}
                onChange={(e) => setSheetTabInput(e.target.value)}
                placeholder="Products"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow cursor-pointer"
            >
              Save &amp; Link Spreadsheet
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

      {/* Card 3: Two-Way Synchronization Operations */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
          <div>
            <h4 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              <span>Two-Way Catalog Synchronization</span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Pull products from your Google Sheet to display on the website, or push current website products to the sheet.
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
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Pull from Google Sheet ➔ Display on Website</span>
              </span>
              <p className="text-[11px] text-emerald-800/80 mt-1 leading-relaxed">
                Reads all rows from your Google Sheet and updates your live store catalog so visitors immediately see the latest products.
              </p>
            </div>

            <button
              type="button"
              disabled={isPulling || !isConnected}
              onClick={() => setShowPullConfirm(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
              <span>{isPulling ? 'Fetching from Sheet...' : 'Pull Products from Google Sheet'}</span>
            </button>
          </div>

          {/* Push all to Google Sheet */}
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Push Current Website Catalog ({products.length}) ➔ Google Sheet</span>
              </span>
              <p className="text-[11px] text-amber-800/80 mt-1 leading-relaxed">
                Backs up and overwrites the connected Google Sheet with all {products.length} products currently in the catalog.
              </p>
            </div>

            <button
              type="button"
              disabled={isPushing || !isConnected || !googleUser}
              onClick={() => setShowPushConfirm(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#4A0E17] hover:bg-[#32080F] text-[#D4AF37] border border-[#D4AF37] font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Upload className={`w-3.5 h-3.5 text-amber-400 ${isPushing ? 'animate-spin' : ''}`} />
              <span>{isPushing ? 'Pushing to Sheet...' : `Push All (${products.length}) Products to Sheet`}</span>
            </button>
          </div>

        </div>

        {/* Column structure info */}
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

      {/* CONFIRMATION MODALS (MANDATORY per Workspace guidelines) */}
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
                This will read all product rows from your connected Google Sheet and merge them into the website live catalog.
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
                onClick={confirmPullFromSheet}
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
                Are you sure you want to push all <strong>{products.length} products</strong> from the website to your Google Sheet? This will overwrite the sheet's current product rows with the website catalog.
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
                onClick={confirmPushAllToSheet}
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
