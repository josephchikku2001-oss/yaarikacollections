import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  KeyRound, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  LogOut, 
  Check, 
  AlertTriangle, 
  Image as ImageIcon, 
  Upload, 
  Sparkles, 
  Layers, 
  Search, 
  MessageCircle, 
  CheckCircle2, 
  Download, 
  Database, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Flame, 
  Cloud, 
  Settings, 
  Mail, 
  HardDrive,
  Eye,
  Boxes,
  Package,
  Minus,
  AlertCircle,
  FileSpreadsheet,
  Sliders
} from 'lucide-react';
import { Product, CategoryType, SizeType, InquiryLog } from '../types';
import { AdminStorage, ProductStorage, InquiryStorage } from '../services/storage';
import { ExcelProductUploader } from './ExcelProductUploader';
import { MultiLayerProductCreator } from './MultiLayerProductCreator';
import { BannerSliderManager } from './BannerSliderManager';
import { SAMPLE_SHOWCASE_PRODUCTS } from '../data/sampleShowcase';
import { GitHubStorageService } from '../services/githubStorage';
import { 
  isProductInStock, 
  getSizeStockCount, 
  isSizeInStock, 
  getProductTotalStock 
} from '../utils/inventory';
import { compressImageFile } from '../utils/imageCompressor';
import { 
  isFirebaseConfigured, 
  getSavedFirebaseConfig, 
  saveFirebaseConfig, 
  FirebaseConfig, 
  FirebaseAuthService 
} from '../services/firebase';

interface AdminPortalProps {
  onClose: () => void;
  onToast: (msg: string) => void;
  onRefreshProducts: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onClose,
  onToast,
  onRefreshProducts
}) => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUserEmail, setAdminUserEmail] = useState<string>('');
  const [authMode, setAuthMode] = useState<'firebase' | 'master'>(() => isFirebaseConfigured() ? 'firebase' : 'master');
  
  // Login form inputs
  const [emailInput, setEmailInput] = useState<string>('');
  const [usernameInput, setUsernameInput] = useState<string>('admin');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [isFirebaseAccountCreation, setIsFirebaseAccountCreation] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'products' | 'add' | 'excel' | 'bulk' | 'banners' | 'inquiries' | 'github-verify' | 'settings'>('products');

  // GitHub Sync & Verification Tab State
  const [ghTokenInput, setGhTokenInput] = useState<string>(() => GitHubStorageService.getConfig().token || '');
  const [ghRepoInput, setGhRepoInput] = useState<string>(() => GitHubStorageService.getConfig().repo || '');
  const [ghVerifyResult, setGhVerifyResult] = useState<any>(null);
  const [isVerifyingGh, setIsVerifyingGh] = useState<boolean>(false);

  const handleSaveGhConfig = (e: React.FormEvent) => {
    e.preventDefault();
    GitHubStorageService.saveConfig(ghTokenInput, ghRepoInput);
    onToast('GitHub Configuration Saved successfully!');
  };

  const handleRunGhVerification = async () => {
    setIsVerifyingGh(true);
    setGhVerifyResult(null);
    try {
      const res = await GitHubStorageService.verifyConnection(ghTokenInput, ghRepoInput);
      setGhVerifyResult(res);
      if (res.writeSuccess && res.repoAccess) {
        onToast('✅ GitHub & Live Website sync verification passed successfully!');
      } else {
        onToast('⚠️ Verification completed with warnings/errors. Check details.');
      }
    } catch (e: any) {
      setGhVerifyResult({ success: false, error: e.message || 'Verification failed' });
      onToast('Verification failed.');
    } finally {
      setIsVerifyingGh(false);
    }
  };

  // Product List
  const [products, setProducts] = useState<Product[]>(ProductStorage.getProducts());
  const [productSearch, setProductSearch] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'outofstock' | 'lowstock'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Firestore Sync State
  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);
  const [firestoreStatusMessage, setFirestoreStatusMessage] = useState<string>('');
  const [firebaseActive, setFirebaseActive] = useState<boolean>(isFirebaseConfigured());

  // Delete Modal State
  const [deleteProductCandidate, setDeleteProductCandidate] = useState<Product | null>(null);

  // Add / Edit Product Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<CategoryType>('Traditional Sarees');
  const [formPrice, setFormPrice] = useState<string>(''); // Offer / Selling price
  const [formOriginalPrice, setFormOriginalPrice] = useState<string>(''); // Original MRP
  const [formSizes, setFormSizes] = useState<SizeType[]>(['M', 'L', 'XL', 'XXL']);
  const [formSizeStock, setFormSizeStock] = useState<Partial<Record<SizeType, string>>>({
    M: '5',
    L: '5',
    XL: '5',
    XXL: '5'
  });
  const [formDescription, setFormDescription] = useState<string>('');
  const [formFabric, setFormFabric] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formInStock, setFormInStock] = useState<boolean>(true);
  const [formFeatured, setFormFeatured] = useState<boolean>(false);
  const [formIsNewArrival, setFormIsNewArrival] = useState<boolean>(false);

  // Firebase Config Form inside Settings Tab
  const [fbApiKey, setFbApiKey] = useState<string>('');
  const [fbAuthDomain, setFbAuthDomain] = useState<string>('');
  const [fbProjectId, setFbProjectId] = useState<string>('');
  const [fbAppId, setFbAppId] = useState<string>('');
  const [fbConfigStatus, setFbConfigStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Password Change in Settings
  const [currentPassInput, setCurrentPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmNewPassInput, setConfirmNewPassInput] = useState<string>('');
  const [passChangeMessage, setPassChangeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inquiries
  const [inquiries] = useState<InquiryLog[]>(InquiryStorage.getInquiries());

  // Bulk Manager State
  const [bulkInputText, setBulkInputText] = useState<string>('');
  const [bulkFormat, setBulkFormat] = useState<'csv' | 'json'>('csv');
  const [bulkStatus, setBulkStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState<boolean>(false);

  const availableCategories: CategoryType[] = [
    'Traditional Sarees',
    'Co-ord Sets',
    'Churidar Sets',
    'Fusion Wear',
    'New Arrivals'
  ];

  // Specific size list emphasizing M, L, XL, XXL
  const quickSizesList: SizeType[] = ['M', 'L', 'XL', 'XXL'];
  const allSizesList: SizeType[] = ['Free Size', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

  // Check Firebase Auth & Local Auth on mount
  useEffect(() => {
    setProducts(ProductStorage.getProducts());
    setFirebaseActive(isFirebaseConfigured());

    const savedConfig = getSavedFirebaseConfig();
    if (savedConfig) {
      setFbApiKey(savedConfig.apiKey || '');
      setFbAuthDomain(savedConfig.authDomain || '');
      setFbProjectId(savedConfig.projectId || '');
      setFbAppId(savedConfig.appId || '');
    }

    // Check if Firebase Auth is already active
    const unsubscribe = FirebaseAuthService.onAuthChange((user) => {
      if (user && user.email) {
        setIsAuthenticated(true);
        setAdminUserEmail(user.email);
        setAuthMode('firebase');
      }
    });

    return () => unsubscribe();
  }, []);

  // Firebase Email & Password Login Handler
  const handleFirebaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!emailInput.trim() || !passwordInput.trim()) {
      setAuthError('Please enter both Email and Password.');
      setAuthLoading(false);
      return;
    }

    if (isFirebaseAccountCreation) {
      if (passwordInput !== confirmPasswordInput) {
        setAuthError('Passwords do not match.');
        setAuthLoading(false);
        return;
      }

      const res = await FirebaseAuthService.signUpAdmin(emailInput, passwordInput);
      setAuthLoading(false);

      if (res.success && res.user) {
        setIsAuthenticated(true);
        setAdminUserEmail(res.user.email || emailInput);
        onToast(`Admin account registered & logged in as ${res.user.email}!`);
      } else {
        setAuthError(res.error || 'Failed to create Firebase admin account.');
      }
    } else {
      const res = await FirebaseAuthService.signIn(emailInput, passwordInput);
      setAuthLoading(false);

      if (res.success && res.user) {
        setIsAuthenticated(true);
        setAdminUserEmail(res.user.email || emailInput);
        onToast(`Logged in successfully as ${res.user.email}`);
      } else {
        setAuthError(res.error || 'Invalid Admin Email or Password.');
      }
    }
  };

  // Master Admin Login / Setup Fallback
  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError('Please enter your Username and Password.');
      setAuthLoading(false);
      return;
    }

    if (!AdminStorage.isSetupComplete()) {
      if (passwordInput !== confirmPasswordInput) {
        setAuthError('Passwords do not match.');
        setAuthLoading(false);
        return;
      }
      const res = await AdminStorage.registerFirstAdmin(usernameInput, passwordInput);
      setAuthLoading(false);
      if (res.success) {
        setIsAuthenticated(true);
        setAdminUserEmail(usernameInput);
        onToast('Master Admin Account Created Successfully!');
      } else {
        setAuthError(res.message);
      }
    } else {
      const res = await AdminStorage.login(usernameInput, passwordInput);
      setAuthLoading(false);
      if (res.success) {
        setIsAuthenticated(true);
        setAdminUserEmail(usernameInput);
        onToast('Logged in as Master Admin.');
      } else {
        setAuthError(res.message);
      }
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    await FirebaseAuthService.signOut();
    setIsAuthenticated(false);
    setAdminUserEmail('');
    onToast('Logged out from Admin Portal.');
  };

  // Sync All Products to GitHub
  const handleSyncAllToGitHub = async () => {
    setIsSyncingFirestore(true);
    setFirestoreStatusMessage('');
    try {
      const current = ProductStorage.getProducts();
      await GitHubStorageService.updateProducts(current, 'Bulk sync products to GitHub');
      setFirestoreStatusMessage(`✅ Successfully saved ${current.length} products to GitHub!`);
      onToast(`Saved ${current.length} products to GitHub!`);
    } catch (err: any) {
      console.error(err);
      setFirestoreStatusMessage(`❌ GitHub Sync Error: ${err.message || 'Check GitHub Configuration'}`);
      onToast('GitHub sync failed. Please check configuration.');
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  // Fetch Latest from GitHub
  const handleFetchFromGitHub = async () => {
    setIsSyncingFirestore(true);
    try {
      const remoteProducts = await GitHubStorageService.fetchProducts();
      if (remoteProducts.length > 0) {
        ProductStorage.saveProducts(remoteProducts);
        setProducts(remoteProducts);
        onRefreshProducts();
        onToast(`Loaded ${remoteProducts.length} products from GitHub!`);
      } else {
        onToast('No products found in GitHub.');
      }
    } catch (err: any) {
      onToast(`Error fetching from GitHub: ${err.message || 'Check configuration'}`);
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  // Save/Update Firebase Configuration
  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbApiKey.trim() || !fbProjectId.trim()) {
      setFbConfigStatus({ type: 'error', msg: 'API Key and Project ID are required.' });
      return;
    }

    const config: FirebaseConfig = {
      apiKey: fbApiKey.trim(),
      authDomain: fbAuthDomain.trim() || `${fbProjectId.trim()}.firebaseapp.com`,
      projectId: fbProjectId.trim(),
      appId: fbAppId.trim() || '1:123456789:web:abcdef'
    };

    saveFirebaseConfig(config);
    setFirebaseActive(true);
    setFbConfigStatus({ type: 'success', msg: 'Firebase configuration saved and activated successfully!' });
    onToast('Firebase configuration activated!');
  };

  // Toggle Size selection in form
  const toggleSizeInForm = (size: SizeType) => {
    if (formSizes.includes(size)) {
      if (formSizes.length > 1) {
        setFormSizes(formSizes.filter(s => s !== size));
        const updated = { ...formSizeStock };
        delete updated[size];
        setFormSizeStock(updated);
      } else {
        onToast('At least one size must remain selected.');
      }
    } else {
      setFormSizes([...formSizes, size]);
      setFormSizeStock(prev => ({ ...prev, [size]: prev[size] !== undefined ? prev[size] : '5' }));
    }
  };

  // Quick helper to select standard M, L, XL, XXL set
  const handleSelectStandardSizes = () => {
    setFormSizes(['M', 'L', 'XL', 'XXL']);
    setFormSizeStock(prev => ({
      ...prev,
      M: prev.M || '5',
      L: prev.L || '5',
      XL: prev.XL || '5',
      XXL: prev.XXL || '5'
    }));
    onToast('Selected standard sizes: M, L, XL, XXL');
  };

  // Update stock count for a specific size in form
  const handleSizeStockChange = (size: SizeType, value: string) => {
    const numeric = parseInt(value) || 0;
    const clamped = Math.max(0, numeric);
    const updated = { ...formSizeStock, [size]: value === '' ? '' : clamped.toString() };
    setFormSizeStock(updated);

    // Calculate sum of stock across all active sizes
    const total = formSizes.reduce((acc, s) => {
      const count = parseInt(updated[s] !== undefined ? updated[s]! : '0') || 0;
      return acc + count;
    }, 0);

    if (total === 0) {
      setFormInStock(false);
    } else if (!formInStock && total > 0) {
      setFormInStock(true);
    }
  };

  // Increment or decrement stock for a specific size
  const handleStepSizeStock = (size: SizeType, delta: number) => {
    const current = parseInt(formSizeStock[size] || '0') || 0;
    const nextVal = Math.max(0, current + delta);
    handleSizeStockChange(size, nextVal.toString());
  };

  // Set all sizes to a uniform stock count
  const handleSetAllSizesStock = (qty: number) => {
    const updated: Partial<Record<SizeType, string>> = {};
    formSizes.forEach(s => {
      updated[s] = qty.toString();
    });
    setFormSizeStock(updated);
    setFormInStock(qty > 0);
    onToast(`Set all selected sizes to ${qty} units.`);
  };

  // Inline Quick Adjust Product Stock from Live Catalog Table
  const handleInlineStockAdjust = (product: Product, size: SizeType, delta: number) => {
    const currentSizes = product.sizes && product.sizes.length > 0 ? product.sizes : ['Free Size' as const];
    const currentStock = product.sizeStock ? { ...product.sizeStock } : {};
    
    // Ensure all sizes have initialized count
    currentSizes.forEach(s => {
      if (currentStock[s] === undefined) {
        currentStock[s] = product.inStock ? 5 : 0;
      }
    });

    const currSizeCount = currentStock[size] !== undefined ? currentStock[size]! : (product.inStock ? 5 : 0);
    const newSizeCount = Math.max(0, currSizeCount + delta);
    currentStock[size] = newSizeCount;

    const totalStock = Object.values(currentStock).reduce((acc, c) => acc + (Number(c) || 0), 0);
    const isInStock = totalStock > 0;

    const updatedProduct: Product = {
      ...product,
      sizeStock: currentStock,
      stockCount: totalStock,
      inStock: isInStock
    };

    ProductStorage.updateProduct(updatedProduct);
    const fresh = ProductStorage.getProducts();
    setProducts(fresh);
    onRefreshProducts();
    onToast(`Updated ${product.title} (${size}) stock to ${newSizeCount} units.`);
  };

  // Image Upload File to Data URL with automatic web compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onToast('Optimizing image for fast web loading...');
      try {
        const compressed = await compressImageFile(file);
        setFormImageUrl(compressed);
        onToast('Product image uploaded and optimized successfully!');
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormImageUrl(reader.result as string);
          onToast('Product image uploaded successfully!');
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Save / Edit Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      onToast('Please enter a Product Title.');
      return;
    }

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      onToast('Please enter a valid Offer / Selling Price in ₹ INR.');
      return;
    }

    if (!formImageUrl.trim()) {
      onToast('Please provide an Image URL or upload an image file.');
      return;
    }

    if (formSizes.length === 0) {
      onToast('Please select at least one available size (e.g. M, L, XL, XXL).');
      return;
    }

    const origPriceNum = formOriginalPrice ? parseFloat(formOriginalPrice) : undefined;

    // Build sizeStock mapping
    const finalSizeStock: Partial<Record<SizeType, number>> = {};
    let calculatedTotalUnits = 0;

    formSizes.forEach(s => {
      const raw = formSizeStock[s];
      let count = raw !== undefined && raw !== '' ? Math.max(0, parseInt(raw) || 0) : (formInStock ? 5 : 0);
      if (!formInStock) {
        count = 0;
      }
      finalSizeStock[s] = count;
      calculatedTotalUnits += count;
    });

    const isActuallyInStock = formInStock && calculatedTotalUnits > 0;

    const productPayload = {
      title: formTitle.trim(),
      category: formCategory,
      price: priceNum,
      originalPrice: origPriceNum,
      sizes: formSizes,
      stockCount: calculatedTotalUnits,
      sizeStock: finalSizeStock,
      description: formDescription.trim() || `${formTitle.trim()} from Yaarika Collections.`,
      fabricDetails: formFabric.trim(),
      imageUrl: formImageUrl.trim(),
      inStock: isActuallyInStock,
      featured: formFeatured,
      isNewArrival: formIsNewArrival
    };

    if (editingProductId) {
      const updatedProduct: Product = {
        ...productPayload,
        id: editingProductId,
        createdAt: new Date().toISOString()
      };
      ProductStorage.updateProduct(updatedProduct);
      onToast(`Updated product "${formTitle}" with stock counts in catalog & Firestore!`);
    } else {
      ProductStorage.addProduct(productPayload);
      onToast(`Added new product "${formTitle}" with inventory stock to catalog & Firestore!`);
    }

    // Refresh products
    const fresh = ProductStorage.getProducts();
    setProducts(fresh);
    onRefreshProducts();
    resetForm();
    setActiveTab('products');
  };

  // Populate Edit Form
  const handleEditProductClick = (p: Product) => {
    setEditingProduct(p);
    setEditingProductId(p.id);
    setFormTitle(p.title);
    setFormCategory(p.category);
    setFormPrice(p.price.toString());
    setFormOriginalPrice(p.originalPrice ? p.originalPrice.toString() : '');
    
    const sizes = p.sizes && p.sizes.length > 0 ? p.sizes : ['M', 'L', 'XL', 'XXL'];
    setFormSizes(sizes);

    const sizeStockMap: Partial<Record<SizeType, string>> = {};
    sizes.forEach(s => {
      if (p.sizeStock && p.sizeStock[s] !== undefined) {
        sizeStockMap[s] = p.sizeStock[s]!.toString();
      } else if (p.stockCount !== undefined) {
        sizeStockMap[s] = p.stockCount.toString();
      } else {
        sizeStockMap[s] = p.inStock ? '5' : '0';
      }
    });
    setFormSizeStock(sizeStockMap);

    setFormDescription(p.description);
    setFormFabric(p.fabricDetails || '');
    setFormImageUrl(p.imageUrl);
    setFormInStock(p.inStock);
    setFormFeatured(p.featured || false);
    setFormIsNewArrival(p.isNewArrival || false);
    setActiveTab('add');
  };

  // Optional: Load sample boutique showcase ensembles
  const handleLoadSampleShowcase = () => {
    const result = ProductStorage.bulkAddProducts(SAMPLE_SHOWCASE_PRODUCTS);
    const fresh = ProductStorage.getProducts();
    setProducts(fresh);
    onRefreshProducts();
    onToast(`Loaded ${result.added} sample boutique ensembles to catalog & Firestore!`);
  };

  // Reset form
  const resetForm = () => {
    setEditingProduct(null);
    setEditingProductId(null);
    setFormTitle('');
    setFormCategory('Traditional Sarees');
    setFormPrice('');
    setFormOriginalPrice('');
    setFormSizes(['M', 'L', 'XL', 'XXL']);
    setFormSizeStock({
      M: '5',
      L: '5',
      XL: '5',
      XXL: '5'
    });
    setFormDescription('');
    setFormFabric('');
    setFormImageUrl('');
    setFormInStock(true);
    setFormFeatured(false);
    setFormIsNewArrival(false);
  };

  // Delete Product
  const confirmDeleteProduct = () => {
    if (deleteProductCandidate) {
      ProductStorage.deleteProduct(deleteProductCandidate.id);
      const updated = ProductStorage.getProducts();
      setProducts(updated);
      onRefreshProducts();
      onToast(`Deleted "${deleteProductCandidate.title}" from catalog & Firestore.`);
      setDeleteProductCandidate(null);
    }
  };

  // Clear All Products
  const handleClearAllProducts = () => {
    if (window.confirm('Are you sure you want to remove ALL products from the website and Firestore database? This action cannot be undone.')) {
      ProductStorage.clearAllProducts();
      setProducts([]);
      onRefreshProducts();
      onToast('All products have been completely removed from the catalog & Firestore database.');
    }
  };

  // Toggle Stock in product list
  const handleToggleStock = (p: Product) => {
    const updated = ProductStorage.toggleStockStatus(p.id);
    setProducts(updated);
    onRefreshProducts();
    onToast(`"${p.title}" is now marked as ${!p.inStock ? 'IN STOCK' : 'OUT OF STOCK'}`);
  };

  // Export CSV
  const handleExportCSV = () => {
    try {
      const csv = ProductStorage.exportCatalogCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `yaarika_catalog_${products.length}_products.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onToast(`Exported ${products.length} products to CSV!`);
    } catch (e: any) {
      onToast('Failed to export CSV: ' + e.message);
    }
  };

  // Process Bulk Import
  const handleProcessBulkImport = () => {
    if (!bulkInputText.trim()) {
      setBulkStatus({ type: 'error', message: 'Please paste or enter CSV/JSON data first.' });
      return;
    }

    setIsProcessingBulk(true);
    setBulkStatus(null);

    setTimeout(() => {
      try {
        let res: { success: boolean; count: number; error?: string };
        if (bulkFormat === 'csv') {
          res = ProductStorage.importCatalogCSV(bulkInputText);
        } else {
          res = ProductStorage.importCatalogJSON(bulkInputText);
        }

        if (res.success) {
          const fresh = ProductStorage.getProducts();
          setProducts(fresh);
          onRefreshProducts();
          setBulkStatus({
            type: 'success',
            message: `Successfully imported ${res.count.toLocaleString()} products! Total Catalog: ${fresh.length.toLocaleString()} products.`
          });
          setBulkInputText('');
          onToast(`Imported ${res.count} products successfully!`);
        } else {
          setBulkStatus({
            type: 'error',
            message: res.error || 'Import failed. Please check the data format.'
          });
        }
      } catch (err: any) {
        setBulkStatus({
          type: 'error',
          message: err.message || 'Unexpected import error.'
        });
      } finally {
        setIsProcessingBulk(false);
      }
    }, 100);
  };

  // Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeMessage(null);

    if (!currentPassInput.trim() || !newPassInput.trim()) {
      setPassChangeMessage({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }

    if (newPassInput !== confirmNewPassInput) {
      setPassChangeMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    const res = await AdminStorage.changePassword(currentPassInput, newPassInput);
    if (res.success) {
      setPassChangeMessage({ type: 'success', text: res.message });
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmNewPassInput('');
      onToast('Admin Password Changed Successfully!');
    } else {
      setPassChangeMessage({ type: 'error', text: res.message });
    }
  };

  // Filtered products list
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase());

    const totalUnits = getProductTotalStock(p);

    if (stockFilter === 'instock' && (!p.inStock || totalUnits <= 0)) return false;
    if (stockFilter === 'outofstock' && p.inStock && totalUnits > 0) return false;
    if (stockFilter === 'lowstock' && (!p.inStock || totalUnits <= 0 || totalUnits > 3)) return false;

    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedProducts = filteredProducts.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const inStockCount = products.filter(p => p.inStock && getProductTotalStock(p) > 0).length;
  const outOfStockCount = products.filter(p => !p.inStock || getProductTotalStock(p) === 0).length;
  const lowStockCount = products.filter(p => p.inStock && getProductTotalStock(p) > 0 && getProductTotalStock(p) <= 3).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      
      <div className="w-full max-w-5xl bg-[#FFFDF9] rounded-3xl shadow-2xl border-2 border-[#D4AF37]/50 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header Bar */}
        <div className="bg-[#32080F] text-[#FAF6F0] p-4 sm:p-5 border-b border-[#D4AF37]/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient-bg p-0.5 shadow-md">
              <div className="w-full h-full bg-[#4A0E17] rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-cinzel text-lg sm:text-xl font-bold gold-gradient-text">
                  YAARIKA ADMIN PORTAL
                </h2>
                {firebaseActive && (
                  <span className="hidden sm:inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Flame className="w-3 h-3 text-amber-400" />
                    Firebase Connected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#F3E5AB]/80">
                {isAuthenticated
                  ? `Logged in: ${adminUserEmail || 'Admin'}`
                  : 'Firebase Authentication & Firestore Product Manager'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-[#4A0E17] text-rose-300 hover:bg-rose-950 border border-rose-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Logout Admin Session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg gold-gradient-btn text-xs font-bold shadow transition-all"
            >
              Back to Store
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF6F0]">

          {/* AUTH SCREEN: LOGIN WITH FIREBASE EMAIL & PASSWORD */}
          {!isAuthenticated && (
            <div className="max-w-md mx-auto my-6 bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-[#D4AF37]/40 space-y-6">
              
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-[#4A0E17] text-[#D4AF37] flex items-center justify-center mx-auto border-2 border-[#D4AF37] shadow-lg">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="font-cinzel text-xl font-bold text-[#4A0E17]">
                  Admin Authentication
                </h3>
                <p className="text-xs text-gray-600">
                  Log in with your Admin Email and Password to manage products and Firebase Firestore database.
                </p>
              </div>

              {/* Auth Mode Tabs: Firebase Auth vs Master Account */}
              <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setAuthMode('firebase'); setAuthError(''); }}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    authMode === 'firebase'
                      ? 'bg-[#4A0E17] text-[#D4AF37] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Firebase Auth</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setAuthMode('master'); setAuthError(''); }}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    authMode === 'master'
                      ? 'bg-[#4A0E17] text-[#D4AF37] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Master Admin</span>
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{authError}</span>
                </div>
              )}

              {/* FIREBASE EMAIL & PASSWORD LOGIN FORM */}
              {authMode === 'firebase' && (
                <form onSubmit={handleFirebaseLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Admin Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="admin@yaarika.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A0E17]"
                      />
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Enter password"
                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A0E17]"
                      />
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {isFirebaseAccountCreation && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={confirmPasswordInput}
                          onChange={(e) => setConfirmPasswordInput(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A0E17]"
                        />
                        <CheckCircle2 className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 rounded-xl gold-gradient-btn font-bold text-sm uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
                  >
                    {authLoading
                      ? 'Authenticating with Firebase...'
                      : isFirebaseAccountCreation
                      ? 'Register Admin Account in Firebase'
                      : 'Login with Firebase Email & Password'}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFirebaseAccountCreation(!isFirebaseAccountCreation);
                        setAuthError('');
                      }}
                      className="text-xs text-[#4A0E17] hover:underline font-semibold"
                    >
                      {isFirebaseAccountCreation
                        ? 'Already have an Admin account? Log in'
                        : 'First time setup? Create new Admin account'}
                    </button>
                  </div>
                </form>
              )}

              {/* MASTER USERNAME & PASSWORD FORM */}
              {authMode === 'master' && (
                <form onSubmit={handleMasterLogin} className="space-y-4">
                  {!AdminStorage.isSetupComplete() && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Initial Admin Setup:</strong>
                        <span>Create your master admin username and password (min 4 characters) to secure your boutique dashboard.</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Admin Username
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="admin"
                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A0E17]"
                      />
                      <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Enter password (min 4 chars)"
                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A0E17]"
                      />
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {!AdminStorage.isSetupComplete() && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={confirmPasswordInput}
                          onChange={(e) => setConfirmPasswordInput(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A0E17]"
                        />
                        <CheckCircle2 className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 rounded-xl gold-gradient-btn font-bold text-sm uppercase tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    {authLoading 
                      ? 'Verifying...' 
                      : (!AdminStorage.isSetupComplete() ? 'Create Master Admin Account' : 'Login to Admin Dashboard')}
                  </button>

                  {AdminStorage.isSetupComplete() && (
                    <div className="text-center pt-1 text-[11px] text-gray-500">
                      Default username is <strong className="text-[#4A0E17]">admin</strong>. Password can be updated in Settings tab.
                    </div>
                  )}
                </form>
              )}

            </div>
          )}

          {/* AUTHENTICATED DASHBOARD */}
          {isAuthenticated && (
            <div className="space-y-6">

              {/* FIRESTORE CLOUD SYNC BAR */}
              <div className="bg-gradient-to-r from-[#4A0E17]/15 via-amber-500/10 to-[#4A0E17]/15 border border-[#D4AF37]/40 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-[#4A0E17] text-[#D4AF37] flex items-center justify-center shrink-0 shadow-md">
                    <Cloud className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-[#4A0E17]">GitHub Storage:</span>
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Connected
                      </span>
                      <span className="text-xs text-gray-600 font-medium">
                        ({products.length.toLocaleString()} Products in Catalog)
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Changes are automatically saved to products.json in GitHub.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                  <button
                    onClick={handleFetchFromGitHub}
                    disabled={isSyncingFirestore}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    title="Pull latest product catalog from GitHub"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                    <span>Fetch from GitHub</span>
                  </button>

                  <button
                    onClick={handleSyncAllToGitHub}
                    disabled={isSyncingFirestore}
                    className="px-4 py-1.5 rounded-xl bg-[#4A0E17] text-[#D4AF37] hover:bg-[#32080F] border border-[#D4AF37] text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                    title="Upload entire catalog to GitHub"
                  >
                    <Cloud className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isSyncingFirestore ? 'Syncing...' : 'Save All to GitHub'}</span>
                  </button>
                </div>
              </div>

              {firestoreStatusMessage && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 animate-fade-in">
                  {firestoreStatusMessage}
                </div>
              )}

              {/* TABS NAVIGATION */}
              <div className="flex items-center gap-2 border-b border-[#D4AF37]/30 pb-3 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => { resetForm(); setActiveTab('products'); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'products'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Live Catalog ({products.length.toLocaleString()})</span>
                </button>

                <button
                  onClick={() => { resetForm(); setActiveTab('add'); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'add'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>{editingProduct ? 'Edit Product' : 'Add New Product (Multi-Layer)'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('excel')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'excel'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-amber-50 border border-amber-300'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Excel (.xlsx) Sheet Upload</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-extrabold uppercase">
                    New
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'bulk'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>Bulk Tools &amp; Import</span>
                </button>

                <button
                  onClick={() => setActiveTab('banners')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'banners'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-amber-50 border border-amber-300'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-[#D4AF37]" />
                  <span>Hero Slider (മുകൾഭാഗത്തെ സ്ലൈഡർ)</span>
                </button>

                <button
                  onClick={() => setActiveTab('inquiries')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'inquiries'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp Inquiries ({inquiries.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('github-verify')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'github-verify'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-amber-50 border border-amber-300'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span>GitHub &amp; Sync Verification</span>
                  <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-extrabold uppercase">
                    Live Check
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'settings'
                      ? 'bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Settings className="w-4 h-4 text-amber-600" />
                  <span>Firebase &amp; Security</span>
                </button>
              </div>

              {/* TAB 1: VIEW & MANAGE ALL PRODUCTS */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  
                  {/* Search and Filters */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-64">
                        <input
                          type="text"
                          placeholder="Search product title..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#4A0E17]"
                        />
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      </div>

                      {/* Stock Filter Pills */}
                      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                        <button
                          onClick={() => setStockFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            stockFilter === 'all'
                              ? 'bg-[#4A0E17] text-[#D4AF37] shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          All ({products.length})
                        </button>

                        <button
                          onClick={() => setStockFilter('instock')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                            stockFilter === 'instock'
                              ? 'bg-emerald-700 text-white shadow-sm'
                              : 'text-emerald-800 hover:bg-emerald-50'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          In Stock ({inStockCount})
                        </button>

                        <button
                          onClick={() => setStockFilter('lowstock')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                            stockFilter === 'lowstock'
                              ? 'bg-amber-700 text-white shadow-sm'
                              : 'text-amber-800 hover:bg-amber-50'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          Low Stock ({lowStockCount})
                        </button>

                        <button
                          onClick={() => setStockFilter('outofstock')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                            stockFilter === 'outofstock'
                              ? 'bg-rose-700 text-white shadow-sm'
                              : 'text-rose-800 hover:bg-rose-50'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          Out of Stock ({outOfStockCount})
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                      {products.length > 0 && (
                        <button
                          onClick={handleClearAllProducts}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Remove all products from website and Firestore database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear All Products</span>
                        </button>
                      )}

                      <button
                        onClick={() => setActiveTab('excel')}
                        className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#4A0E17] border border-[#D4AF37] text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        title="Upload Excel (.xlsx/.xls) or CSV Sheet with Product Images"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Upload Excel (.xlsx)</span>
                      </button>

                      <button
                        onClick={handleExportCSV}
                        className="px-3 py-2 rounded-xl bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                        title="Export current catalog to CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Export CSV</span>
                      </button>

                      <button
                        onClick={() => { resetForm(); setActiveTab('add'); }}
                        className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-bold flex items-center gap-1.5 shadow"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Product</span>
                      </button>
                    </div>
                  </div>

                  {/* Product Table */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#32080F] text-[#FAF6F0] text-xs font-bold uppercase tracking-wider">
                            <th className="p-3.5">Product</th>
                            <th className="p-3.5">Category</th>
                            <th className="p-3.5">Offer Price / MRP</th>
                            <th className="p-3.5">Size &amp; Stock Count</th>
                            <th className="p-3.5">Inventory Status</th>
                            <th className="p-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {paginatedProducts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center">
                                {products.length === 0 ? (
                                  <div className="space-y-3 py-4 max-w-md mx-auto">
                                    <div className="w-12 h-12 rounded-full bg-amber-50 text-[#D4AF37] border border-[#D4AF37] flex items-center justify-center mx-auto shadow-sm">
                                      <Package className="w-6 h-6 text-[#4A0E17]" />
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-800">Your Catalog is Ready for Products</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                      നിങ്ങളുടെ ഉൽപ്പന്നങ്ങൾ ചേർക്കുക, അല്ലെങ്കിൽ എക്സൽ വഴി ബൾക്കായി അപ്‌ലോഡ് ചെയ്യുക. വെബ്സൈറ്റ് ടെസ്റ്റ് ചെയ്യാൻ സാമ്പിൾ കളക്ഷൻ ലോഡ് ചെയ്യാവുന്നതാണ്.
                                    </p>
                                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                                      <button
                                        onClick={() => { resetForm(); setActiveTab('add'); }}
                                        className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-bold shadow-sm"
                                      >
                                        + Add First Product
                                      </button>
                                      <button
                                        onClick={() => setActiveTab('excel')}
                                        className="px-4 py-2 rounded-xl bg-white border border-gray-300 hover:border-[#D4AF37] text-gray-700 text-xs font-bold shadow-sm"
                                      >
                                        Upload Excel Sheet
                                      </button>
                                      <button
                                        onClick={handleLoadSampleShowcase}
                                        className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                                        <span>Load Sample Showcase (5 Items)</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2 py-4">
                                    <p className="text-gray-500 italic text-xs">
                                      No products found matching active search or filters.
                                    </p>
                                    <button
                                      onClick={() => {
                                        setProductSearch('');
                                        setStockFilter('all');
                                      }}
                                      className="text-xs font-bold text-[#4A0E17] hover:underline"
                                    >
                                      Clear Search &amp; Filters
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : (
                            paginatedProducts.map((p) => {
                              const totalUnits = getProductTotalStock(p);
                              const isStocked = isProductInStock(p);
                              const isLow = isStocked && totalUnits <= 3;
                              const sizesList = p.sizes && p.sizes.length > 0 ? p.sizes : ['Free Size' as const];

                              return (
                                <tr key={p.id} className="hover:bg-amber-50/40 transition-colors">
                                  <td className="p-3 flex items-center gap-3">
                                    <div className="relative shrink-0">
                                      <img
                                        src={p.imageUrl}
                                        alt={p.title}
                                        className="w-12 h-14 object-cover rounded-lg border border-gray-200 bg-gray-100"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
                                        }}
                                      />
                                      {p.images && p.images.length > 1 && (
                                        <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[#D4AF37] text-[8px] font-extrabold px-1 rounded shadow-xs">
                                          {p.images.length}P
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-bold text-gray-900">{p.title}</div>
                                      <div className="text-[10px] text-gray-500 line-clamp-1 max-w-xs">{p.description}</div>
                                      {p.isNewArrival && (
                                        <span className="inline-block mt-0.5 text-[9px] bg-[#4A0E17] text-[#D4AF37] px-1.5 py-0.2 rounded font-bold uppercase">
                                          New Arrival
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 font-semibold text-[#A67C1E]">
                                    {p.category}
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold text-[#4A0E17]">
                                      ₹{p.price.toLocaleString()}
                                    </div>
                                    {p.originalPrice && (
                                      <div className="text-[10px] text-gray-400 line-through">
                                        ₹{p.originalPrice.toLocaleString()}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {sizesList.map(s => {
                                          const count = getSizeStockCount(p, s);
                                          const isZero = count === 0;
                                          return (
                                            <div 
                                              key={s} 
                                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                isZero
                                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                  : count <= 2
                                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                              }`}
                                            >
                                              <span>{s}:</span>
                                              <span className="font-mono">{count}</span>
                                              <div className="flex items-center ml-0.5 border-l pl-0.5 gap-0.5">
                                                <button
                                                  type="button"
                                                  onClick={() => handleInlineStockAdjust(p, s, -1)}
                                                  disabled={count === 0}
                                                  className="hover:text-red-700 disabled:opacity-30"
                                                  title={`Decrease ${s} stock`}
                                                >
                                                  -
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleInlineStockAdjust(p, s, 1)}
                                                  className="hover:text-emerald-700"
                                                  title={`Increase ${s} stock`}
                                                >
                                                  +
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="text-[10px] text-gray-500 font-medium">
                                        Total: <strong className={totalUnits === 0 ? 'text-rose-600' : 'text-gray-900'}>{totalUnits} units</strong>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-col items-start gap-1">
                                      <button
                                        onClick={() => handleToggleStock(p)}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1.5 transition-all shadow-sm ${
                                          isStocked
                                            ? isLow
                                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300'
                                        }`}
                                        title="Click to toggle product stock status"
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          isStocked 
                                            ? isLow ? 'bg-amber-500' : 'bg-emerald-600 animate-pulse' 
                                            : 'bg-rose-600'
                                        }`}></span>
                                        <span>{isStocked ? (isLow ? `Low (${totalUnits})` : `In Stock (${totalUnits})`) : 'Out of Stock'}</span>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleEditProductClick(p)}
                                        className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                                        title="Edit Product Details"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => setDeleteProductCandidate(p)}
                                        className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                                        title="Delete Product"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {filteredProducts.length > 0 && (
                      <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <span className="text-gray-600">
                          Showing <strong className="text-gray-900">{((safeCurrentPage - 1) * pageSize) + 1}</strong> to{' '}
                          <strong className="text-gray-900">{Math.min(safeCurrentPage * pageSize, filteredProducts.length)}</strong> of{' '}
                          <strong className="text-gray-900">{filteredProducts.length}</strong> items
                        </span>

                        {totalPages > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setCurrentPage(1)}
                              disabled={safeCurrentPage === 1}
                              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-30 hover:bg-gray-100"
                            >
                              <ChevronsLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={safeCurrentPage === 1}
                              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-30 hover:bg-gray-100"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>

                            <span className="px-3 py-1 bg-white border border-gray-300 rounded-lg font-bold text-gray-800">
                              Page {safeCurrentPage} of {totalPages}
                            </span>

                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={safeCurrentPage === totalPages}
                              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-30 hover:bg-gray-100"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setCurrentPage(totalPages)}
                              disabled={safeCurrentPage === totalPages}
                              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-30 hover:bg-gray-100"
                            >
                              <ChevronsRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: MULTI-LAYER ADD / EDIT PRODUCT */}
              {activeTab === 'add' && (
                <MultiLayerProductCreator
                  editingProduct={editingProduct}
                  onSuccess={(_count) => {
                    const fresh = ProductStorage.getProducts();
                    setProducts(fresh);
                    onRefreshProducts();
                    setEditingProduct(null);
                    setEditingProductId(null);
                    setActiveTab('products');
                  }}
                  onCancel={() => {
                    setEditingProduct(null);
                    setEditingProductId(null);
                    setActiveTab('products');
                  }}
                  onToast={onToast}
                />
              )}

              {/* TAB 3: EXCEL SHEET UPLOAD */}
              {activeTab === 'excel' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <ExcelProductUploader
                    onImportComplete={(count) => {
                      const fresh = ProductStorage.getProducts();
                      setProducts(fresh);
                      onRefreshProducts();
                      onToast(`Imported ${count} products from Excel sheet!`);
                    }}
                    onToast={onToast}
                    onRefreshCatalog={() => {
                      const fresh = ProductStorage.getProducts();
                      setProducts(fresh);
                      onRefreshProducts();
                    }}
                  />
                </div>
              )}

              {/* TAB 4: BULK IMPORT TOOLS */}
              {activeTab === 'bulk' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  
                  {/* Excel Sheet Card Banner */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100/50 border border-[#D4AF37] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#4A0E17] text-[#D4AF37] flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-cinzel text-sm font-bold text-[#4A0E17]">
                          Have an Excel Sheet (.xlsx / .xls)?
                        </h4>
                        <p className="text-xs text-gray-600">
                          Use our dedicated Excel Uploader with file drag-and-drop, template download, and photo previews.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('excel')}
                      className="px-4 py-2 bg-[#4A0E17] text-[#D4AF37] hover:bg-[#32080F] border border-[#D4AF37] rounded-xl text-xs font-bold shrink-0 shadow-sm flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Open Excel Sheet Uploader</span>
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="font-cinzel text-lg font-bold text-[#4A0E17] flex items-center gap-2">
                      <Database className="w-5 h-5 text-amber-600" />
                      <span>Bulk Product Import (CSV &amp; JSON)</span>
                    </h3>
                    <p className="text-xs text-gray-600">
                      Import multiple products at once into your catalog and sync directly to Firebase Firestore.
                    </p>

                    {bulkStatus && (
                      <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        bulkStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : bulkStatus.type === 'error'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}>
                        <span>{bulkStatus.message}</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-xs font-bold text-gray-700">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="bulkFormat"
                            checked={bulkFormat === 'csv'}
                            onChange={() => setBulkFormat('csv')}
                          />
                          <span>CSV Format</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="bulkFormat"
                            checked={bulkFormat === 'json'}
                            onChange={() => setBulkFormat('json')}
                          />
                          <span>JSON Format</span>
                        </label>
                      </div>

                      <textarea
                        rows={8}
                        value={bulkInputText}
                        onChange={(e) => setBulkInputText(e.target.value)}
                        placeholder={
                          bulkFormat === 'csv'
                            ? 'Title,Category,Price,OriginalPrice,InStock,IsNewArrival,Sizes,ImageUrl,Description\nRoyal Kasavu Saree,Traditional Sarees,1899,2499,TRUE,TRUE,Free Size|M|L,https://...,Festive wear'
                            : '[\n  {\n    "title": "Kasavu Saree",\n    "category": "Traditional Sarees",\n    "price": 1899,\n    "sizes": ["M", "L", "XL"],\n    "imageUrl": "https://..."\n  }\n]'
                        }
                        className="w-full p-3 font-mono text-xs bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                      />

                      <button
                        onClick={handleProcessBulkImport}
                        disabled={isProcessingBulk}
                        className="px-6 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-md"
                      >
                        {isProcessingBulk ? 'Processing Import...' : 'Start Bulk Import'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: WHATSAPP INQUIRIES LOG */}
              {activeTab === 'inquiries' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <h3 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-emerald-600" />
                      <span>WhatsApp Customer Order Inquiries</span>
                    </h3>
                    <span className="text-xs text-gray-500 font-medium">
                      Total Inquiries: {inquiries.length}
                    </span>
                  </div>

                  {inquiries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-xs italic">
                      No customer inquiries logged yet. Inquiries automatically record when customers click "Order on WhatsApp"!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-gray-100 text-gray-700 uppercase font-bold border-b border-gray-200">
                            <th className="p-3">Timestamp</th>
                            <th className="p-3">Product Title</th>
                            <th className="p-3">Selected Size</th>
                            <th className="p-3">WhatsApp Number</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {inquiries.map(inq => (
                            <tr key={inq.id} className="hover:bg-amber-50/50">
                              <td className="p-3 text-gray-500">
                                {new Date(inq.timestamp).toLocaleString()}
                              </td>
                              <td className="p-3 font-bold text-gray-900">
                                {inq.productTitle}
                              </td>
                              <td className="p-3">
                                <span className="bg-[#4A0E17] text-[#D4AF37] px-2 py-0.5 rounded text-[10px] font-bold">
                                  {inq.selectedSize}
                                </span>
                              </td>
                              <td className="p-3 text-emerald-700 font-bold">
                                +{inq.phoneContact}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: FIREBASE CONFIG & SECURITY SETTINGS */}
              {activeTab === 'settings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  
                  {/* Firebase Firestore Cloud Configuration */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="border-b border-gray-200 pb-3">
                      <h3 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
                        <Flame className="w-5 h-5 text-amber-500" />
                        <span>Firebase Project Settings</span>
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Connect your live Firebase Authentication and Firestore database.
                      </p>
                    </div>

                    {fbConfigStatus && (
                      <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        fbConfigStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        <span>{fbConfigStatus.msg}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveFirebaseConfig} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Firebase API Key *
                        </label>
                        <input
                          type="text"
                          required
                          value={fbApiKey}
                          onChange={(e) => setFbApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Firebase Project ID *
                        </label>
                        <input
                          type="text"
                          required
                          value={fbProjectId}
                          onChange={(e) => setFbProjectId(e.target.value)}
                          placeholder="yaarika-store-app"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Auth Domain
                        </label>
                        <input
                          type="text"
                          value={fbAuthDomain}
                          onChange={(e) => setFbAuthDomain(e.target.value)}
                          placeholder="yaarika-store-app.firebaseapp.com"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Firebase App ID
                        </label>
                        <input
                          type="text"
                          value={fbAppId}
                          onChange={(e) => setFbAppId(e.target.value)}
                          placeholder="1:123456789:web:abcdef"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-md"
                      >
                        Save &amp; Activate Firebase Config
                      </button>
                    </form>
                  </div>

                  {/* Password & Master Admin Security */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="border-b border-gray-200 pb-3">
                      <h3 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-amber-600" />
                        <span>Change Master Password</span>
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Update fallback security password for master admin login.
                      </p>
                    </div>

                    {passChangeMessage && (
                      <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        passChangeMessage.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        <span>{passChangeMessage.text}</span>
                      </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          required
                          value={currentPassInput}
                          onChange={(e) => setCurrentPassInput(e.target.value)}
                          placeholder="Current password"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          required
                          value={newPassInput}
                          onChange={(e) => setNewPassInput(e.target.value)}
                          placeholder="New password"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmNewPassInput}
                          onChange={(e) => setConfirmNewPassInput(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-md"
                      >
                        Update Master Password
                      </button>
                    </form>
                  </div>

                </div>
              )}

              {/* TAB: GITHUB & LIVE SYNC VERIFICATION */}
              {activeTab === 'github-verify' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Overview Card */}
                  <div className="bg-gradient-to-r from-[#4A0E17] to-[#2B050B] text-[#FAF6F0] p-6 rounded-2xl shadow-xl border border-[#D4AF37]/50 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl gold-gradient-bg p-0.5 shadow-md flex items-center justify-center">
                        <div className="w-full h-full bg-[#4A0E17] rounded-[10px] flex items-center justify-center">
                          <Cloud className="w-6 h-6 text-[#D4AF37]" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-cinzel text-lg sm:text-xl font-bold gold-gradient-text">
                          GitHub &amp; Live Website Synchronization System
                        </h3>
                        <p className="text-xs text-[#F3E5AB]/90">
                          Configure your GitHub credentials and run the verification process to ensure products added in the Admin Portal automatically update on the front end via GitHub in real-time.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Configuration Form */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <h4 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
                      <Settings className="w-5 h-5 text-amber-600" />
                      <span>GitHub Repository &amp; Token Settings</span>
                    </h4>
                    <p className="text-xs text-gray-500">
                      Provide your GitHub personal access token and repository name (e.g. <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">owner/repo</code>) to enable automated commits to <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">products.json</code>.
                    </p>

                    <form onSubmit={handleSaveGhConfig} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          GitHub Repository (<code className="lowercase font-normal">owner/repo</code>)
                        </label>
                        <input
                          type="text"
                          value={ghRepoInput}
                          onChange={(e) => setGhRepoInput(e.target.value)}
                          placeholder="e.g. yaarika/yaarika-boutique"
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          GitHub Personal Access Token (PAT)
                        </label>
                        <input
                          type="password"
                          value={ghTokenInput}
                          onChange={(e) => setGhTokenInput(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-md"
                        >
                          Save GitHub Credentials
                        </button>

                        <button
                          type="button"
                          onClick={handleRunGhVerification}
                          disabled={isVerifyingGh}
                          className="px-6 py-2.5 rounded-xl bg-[#4A0E17] text-[#D4AF37] hover:bg-[#32080F] border border-[#D4AF37] text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-2 transition-all"
                        >
                          <RefreshCw className={`w-4 h-4 text-amber-400 ${isVerifyingGh ? 'animate-spin' : ''}`} />
                          <span>{isVerifyingGh ? 'Running Verification...' : 'Run Full System Verification'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Verification Results Dashboard */}
                  {ghVerifyResult && (
                    <div className={`p-6 rounded-2xl border shadow-md space-y-4 animate-fade-in ${
                      ghVerifyResult.writeSuccess && ghVerifyResult.repoAccess
                        ? 'bg-emerald-50/60 border-emerald-300'
                        : 'bg-amber-50/60 border-amber-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-cinzel text-base font-bold text-gray-900 flex items-center gap-2">
                          {ghVerifyResult.writeSuccess && ghVerifyResult.repoAccess ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-6 h-6 text-amber-600" />
                          )}
                          <span>Sync &amp; Connection Verification Results</span>
                        </h4>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          ghVerifyResult.writeSuccess && ghVerifyResult.repoAccess
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-amber-200 text-amber-900'
                        }`}>
                          {ghVerifyResult.writeSuccess && ghVerifyResult.repoAccess ? 'All Checks Passed ✅' : 'Warning / Needs Attention'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-1">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">1. GitHub Token &amp; Repo</span>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                            {ghVerifyResult.hasToken && ghVerifyResult.hasRepo ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span>Configured &amp; Present</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span>Missing Token or Repo</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-1">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">2. Repository Access</span>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                            {ghVerifyResult.repoAccess ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="text-emerald-700">Read &amp; Write Access Verified</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                <span className="text-rose-700">Access Denied / Invalid Token</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-1">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">3. Live Sync (<code className="lowercase">products.json</code>)</span>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                            {ghVerifyResult.writeSuccess ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="text-emerald-700">Test Commit Successful</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                <span className="text-rose-700">Commit Failed</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {ghVerifyResult.error && (
                        <div className="p-3 bg-rose-100 text-rose-900 border border-rose-300 rounded-xl text-xs font-medium">
                          <strong>Error Details:</strong> {ghVerifyResult.error}
                        </div>
                      )}

                      <div className="text-xs text-gray-600 bg-white p-3.5 rounded-xl border border-gray-200 space-y-1">
                        <strong className="text-gray-900 block font-bold">✨ How Automatic Synchronization Works:</strong>
                        <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-600">
                          <li>Products added or edited in the Admin Portal are instantly saved in local storage &amp; IndexedDB.</li>
                          <li>Simultaneously, a background request pushes the updated product array to <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">products.json</code> via GitHub API.</li>
                          <li>Front-end users receive live updates automatically, ensuring all new products appear immediately for all visitors.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Quick Test Action */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-cinzel text-sm font-bold text-[#4A0E17]">
                        Test Live Product Broadcast
                      </h4>
                      <p className="text-xs text-gray-500">
                        Add a sample test verification product to immediately test the full pipeline (Admin Portal -&gt; GitHub -&gt; Live Website).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const testProd = ProductStorage.addProduct({
                          title: `Verification Test Piece ${new Date().toLocaleTimeString()}`,
                          category: 'New Arrivals',
                          price: 1999,
                          originalPrice: 2799,
                          inStock: true,
                          isNewArrival: true,
                          sizes: ['M', 'L', 'XL', 'XXL'],
                          sizeStock: { M: 5, L: 5, XL: 5, XXL: 5 },
                          description: 'Automated verification test product created via Admin Portal.',
                          imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800'
                        });
                        const fresh = ProductStorage.getProducts();
                        setProducts(fresh);
                        onRefreshProducts();
                        onToast(`Successfully created verification test product "${testProd.title}"!`);
                      }}
                      className="px-5 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-md whitespace-nowrap"
                    >
                      + Add Test Live Product
                    </button>
                  </div>

                </div>
              )}

              {/* TAB: HERO SLIDER BANNER MANAGEMENT */}
              {activeTab === 'banners' && (
                <BannerSliderManager onToast={onToast} />
              )}

            </div>
          )}

        </div>

      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteProductCandidate && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-gray-300 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-bold text-base text-gray-900">
                Confirm Product Deletion
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                Are you sure you want to permanently delete <strong>"{deleteProductCandidate.title}"</strong> from the catalog and Firebase Firestore database?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteProductCandidate(null)}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
              >
                Cancel
              </button>

              <button
                onClick={confirmDeleteProduct}
                className="flex-1 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
