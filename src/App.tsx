import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ProductCard } from './components/ProductCard';
import { ProductDetailPage } from './components/ProductDetailPage';
import { Welcome3DIntro } from './components/Welcome3DIntro';
import { AdminPortal } from './components/AdminPortal';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { CategoryType, Product, ViewMode, SortOption, PriceRangeOption, SizeType } from './types';
import { CatalogFilterBar } from './components/CatalogFilterBar';
import { ProductStorage, WishlistStorage, AdminStorage, PRODUCTS_UPDATED_EVENT } from './services/storage';
import { GitHubStorageService } from './services/githubStorage';
import { 
  FirestoreProductService, 
  isFirebaseConfigured, 
  getSavedFirebaseConfig 
} from './services/firebase';
import { 
  Sparkles, 
  Heart, 
  Filter, 
  SlidersHorizontal,
  MessageCircle, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  SearchX, 
  AlertTriangle, 
  RotateCcw, 
  Search,
  Cloud,
  RefreshCw,
  Boxes,
  ChevronUp,
  ShoppingBag,
  Lock
} from 'lucide-react';
import { CONTACT_NUMBERS } from './utils/whatsapp';

const VALID_CATEGORIES: CategoryType[] = [
  'All',
  'Traditional Sarees',
  'Co-ord Sets',
  'Churidar Sets',
  'Fusion Wear',
  'New Arrivals'
];

const sanitizeCategory = (cat: unknown): CategoryType => {
  if (typeof cat === 'string' && (VALID_CATEGORIES as readonly string[]).includes(cat)) {
    return cat as CategoryType;
  }
  return 'All';
};

// Helper to verify if the URL points to admin dashboard
export const checkIsAdminUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  
  const adminPaths = ['/admin', '/admin-dashboard', '/admin-portal', '/dashboard'];
  const isPathMatch = adminPaths.includes(path) || path.startsWith('/admin/') || path.startsWith('/admin-dashboard/');
  const isHashMatch = hash.includes('admin') || hash.includes('dashboard');
  const isSearchMatch = search.includes('admin=true') || search.includes('portal=admin') || search.includes('view=admin') || search.includes('admin-dashboard');

  return isPathMatch || isHashMatch || isSearchMatch;
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => ProductStorage.getProducts());
  const [activeCategory, setActiveCategory] = useState<CategoryType>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => checkIsAdminUrl() ? 'admin' : 'catalog');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAdminSetupComplete, setIsAdminSetupComplete] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(24);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [showWelcomeIntro, setShowWelcomeIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (checkIsAdminUrl()) return false;
    try {
      if (sessionStorage.getItem('yaarika_intro_seen') === 'true') {
        return false;
      }
    } catch {}
    return true;
  });

  // Navigation handlers
  const navigateToAdmin = useCallback(() => {
    setViewMode('admin');
    setShowWelcomeIntro(false);
    if (!checkIsAdminUrl()) {
      window.history.pushState(null, '', '/admin-dashboard');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToCatalog = useCallback((category?: unknown) => {
    setViewMode('catalog');
    setActiveCategory(sanitizeCategory(category));
    if (checkIsAdminUrl()) {
      window.history.pushState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // New Filters & Sorting States
  const [selectedSort, setSelectedSort] = useState<SortOption>('featured');
  const [selectedSize, setSelectedSize] = useState<SizeType | 'All'>('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRangeOption>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // Synchronize URL and listen for admin route / hash changes & hotkeys
  useEffect(() => {
    const handleUrlChange = () => {
      if (checkIsAdminUrl()) {
        setViewMode('admin');
        setShowWelcomeIntro(false);
      } else if (window.location.hash === '#wishlist') {
        setViewMode('wishlist');
      } else {
        setViewMode('catalog');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    // Secret Admin Keyboard Shortcut: Ctrl + Shift + A (or Alt + Shift + A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setViewMode((prev) => {
          const next = prev === 'admin' ? 'catalog' : 'admin';
          if (next === 'admin') {
            window.history.pushState(null, '', '/admin-dashboard');
            setShowWelcomeIntro(false);
            setToastMessage('🔒 Yaarika Admin Portal Opened');
          } else {
            window.history.pushState(null, '', '/');
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initial Data Load & Dynamic Real-Time Fetch from Firebase Firestore
  useEffect(() => {
    // 1. Initial Synchronous & Local Cache fetch for zero-delay rendering
    const syncProducts = ProductStorage.getProducts();
    setProducts(syncProducts);
    setWishlist(WishlistStorage.getWishlist());
    setIsAdminSetupComplete(AdminStorage.isSetupComplete());

    let unsubscribeFirestore: (() => void) | null = null;

    // 2. Check if Firebase Firestore is configured
    if (isFirebaseConfigured()) {
      setIsFirestoreConnected(false);
      setIsLoadingCatalog(false); // Render instantly from local cache without blocking

      // A. Perform dynamic fetch from Firestore with safe fallback & merge
      FirestoreProductService.fetchProducts()
        .then((cloudProducts) => {
          const merged = ProductStorage.mergeWithCloudProducts(cloudProducts);
          const filtered = merged.filter(p => !ProductStorage.isDeleted(p.id));
          setProducts(filtered);
          setIsFirestoreConnected(true);
        })
        .catch(() => {
          // Graceful fallback to verified local catalog cache
          setIsFirestoreConnected(false);
          const cached = ProductStorage.getProducts().filter(p => !ProductStorage.isDeleted(p.id));
          setProducts(cached);
        });

      // B. Set up Real-Time Dynamic Listener for live updates across all devices
      unsubscribeFirestore = FirestoreProductService.subscribeToProducts(
        (liveProducts) => {
          const merged = ProductStorage.mergeWithCloudProducts(liveProducts);
          const filtered = merged.filter(p => !ProductStorage.isDeleted(p.id));
          setProducts(filtered);
          setIsFirestoreConnected(true);
        },
        () => {
          setIsFirestoreConnected(false);
        }
      );
    } else {
      setIsLoadingCatalog(false);
      // If Firebase is not yet configured, load from local IndexedDB storage and fetch from GitHub repository
      ProductStorage.loadProductsAsync().then((allProducts) => {
        const filtered = (allProducts || []).filter(p => !ProductStorage.isDeleted(p.id));
        setProducts(filtered);
      });

      GitHubStorageService.fetchProducts().then((remoteProducts) => {
        if (remoteProducts && Array.isArray(remoteProducts) && remoteProducts.length > 0) {
          const merged = ProductStorage.mergeWithCloudProducts(remoteProducts);
          const filtered = merged.filter(p => !ProductStorage.isDeleted(p.id));
          setProducts(filtered);
        }
      }).catch(() => {});
    }

    // 3. Listen to instant broadcast events when admin adds/edits/deletes products locally
    const handleProductsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<Product[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setProducts(customEvent.detail);
      } else {
        setProducts(ProductStorage.getProducts());
      }
    };

    window.addEventListener(PRODUCTS_UPDATED_EVENT, handleProductsUpdated);

    // Periodic auto-sync with GitHub JSON repository to ensure any new products appear immediately for all users across sessions & refreshes
    const pollInterval = setInterval(() => {
      GitHubStorageService.fetchProducts().then((remoteProducts) => {
        if (remoteProducts && Array.isArray(remoteProducts) && remoteProducts.length > 0) {
          const merged = ProductStorage.mergeWithCloudProducts(remoteProducts);
          const filtered = merged.filter(p => !ProductStorage.isDeleted(p.id));
          setProducts(filtered);
        }
      }).catch(() => {
        ProductStorage.loadProductsAsync().then((items) => {
          if (items && Array.isArray(items)) {
            const filtered = items.filter(p => !ProductStorage.isDeleted(p.id));
            setProducts(filtered);
          }
        }).catch(() => {});
      });
    }, 15000);

    return () => {
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, handleProductsUpdated);
      clearInterval(pollInterval);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  // Reset pagination when active filter changes
  useEffect(() => {
    setVisibleCount(24);
  }, [activeCategory, searchQuery, viewMode, selectedSort, selectedSize, selectedPriceRange, inStockOnly]);

  // Dynamic Manual Re-fetch from Firebase Firestore
  const handleSyncFirestore = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      // Fallback local refresh
      setIsSyncingFirestore(true);
      const items = await ProductStorage.loadProductsAsync();
      setProducts(items);
      setIsSyncingFirestore(false);
      setToastMessage(`Refreshed catalog (${items.length} items from local cache)`);
      return;
    }

    setIsSyncingFirestore(true);
    try {
      const cloudProducts = await FirestoreProductService.fetchProducts();
      const filtered = (cloudProducts || []).filter(p => !ProductStorage.isDeleted(p.id));
      setProducts(filtered);
      ProductStorage.saveProducts(filtered);
      if (filtered.length > 0) {
        setToastMessage(`✨ Successfully refreshed catalog (${filtered.length} items)!`);
      } else {
        setToastMessage('Catalog is currently empty.');
      }
    } catch (err: any) {
      console.error('Catalog refresh error:', err);
      setToastMessage('Refreshed from catalog cache.');
    } finally {
      setIsSyncingFirestore(false);
    }
  }, []);

  const refreshProducts = () => {
    if (isFirebaseConfigured()) {
      FirestoreProductService.fetchProducts()
        .then((cloudProducts) => {
          const filtered = (cloudProducts || []).filter(p => !ProductStorage.isDeleted(p.id));
          setProducts(filtered);
          ProductStorage.saveProducts(filtered);
          setIsFirestoreConnected(true);
        })
        .catch(() => {
          setIsFirestoreConnected(false);
          ProductStorage.loadProductsAsync().then((items) => {
            setProducts((items || []).filter(p => !ProductStorage.isDeleted(p.id)));
          });
        });
    } else {
      setIsFirestoreConnected(false);
      ProductStorage.loadProductsAsync().then((allProducts) => {
        setProducts((allProducts || []).filter(p => !ProductStorage.isDeleted(p.id)));
      });
    }
    setIsAdminSetupComplete(AdminStorage.isSetupComplete());
  };

  const handleToggleWishlist = (productId: string) => {
    const updated = WishlistStorage.toggleWishlist(productId);
    setWishlist(updated);
    if (updated.includes(productId)) {
      setToastMessage('Added item to your Wishlist ❤️');
    } else {
      setToastMessage('Removed item from Wishlist');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Filtered & Sorted Products Calculation
  const filteredProducts = useMemo(() => {
    const result = products.filter((p) => {
      // Category Filter
      if (activeCategory === 'New Arrivals') {
        if (!p.isNewArrival) return false;
      } else if (activeCategory !== 'All' && p.category !== activeCategory) {
        return false;
      }

      // Wishlist Mode Filter
      if (viewMode === 'wishlist' && !wishlist.includes(p.id)) {
        return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchSizes = p.sizes.some(s => s.toLowerCase().includes(q));
        const matchFabric = p.fabricDetails?.toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchDesc && !matchSizes && !matchFabric) {
          return false;
        }
      }

      // Size Filter (e.g. 'M', 'L', 'XL', 'Free Size')
      if (selectedSize !== 'All') {
        if (!p.sizes || !p.sizes.includes(selectedSize)) {
          return false;
        }
      }

      // In-Stock Only Filter
      if (inStockOnly && !p.inStock) {
        return false;
      }

      // Price Range Filter
      if (selectedPriceRange === 'under_1000') {
        if (p.price >= 1000) return false;
      } else if (selectedPriceRange === '1000_2000') {
        if (p.price < 1000 || p.price > 2000) return false;
      } else if (selectedPriceRange === '2000_3500') {
        if (p.price < 2000 || p.price > 3500) return false;
      } else if (selectedPriceRange === 'above_3500') {
        if (p.price <= 3500) return false;
      }

      return true;
    });

    // Apply Sorting
    if (selectedSort === 'price_low_high') {
      result.sort((a, b) => a.price - b.price);
    } else if (selectedSort === 'price_high_low') {
      result.sort((a, b) => b.price - a.price);
    } else if (selectedSort === 'newest') {
      result.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    return result;
  }, [
    products, 
    activeCategory, 
    searchQuery, 
    wishlist, 
    viewMode, 
    selectedSize, 
    selectedPriceRange, 
    inStockOnly, 
    selectedSort
  ]);

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleWindowScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const hasActiveFilters = useMemo(() => {
    return selectedSize !== 'All' || selectedPriceRange !== 'all' || inStockOnly || selectedSort !== 'featured';
  }, [selectedSize, selectedPriceRange, inStockOnly, selectedSort]);

  const handleResetFilters = useCallback(() => {
    setSelectedSize('All');
    setSelectedPriceRange('all');
    setInStockOnly(false);
    setSelectedSort('featured');
    setToastMessage('Filters cleared');
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFCF8] text-[#1A1A1A]">
      
      {/* 3D WELCOME INTRO OVERLAY */}
      {showWelcomeIntro && (
        <Welcome3DIntro 
          onEnterCatalog={() => {
            setShowWelcomeIntro(false);
            try {
              sessionStorage.setItem('yaarika_intro_seen', 'true');
            } catch {}
          }} 
        />
      )}

      {/* HEADER NAVBAR */}
      <Header
        activeCategory={activeCategory}
        onSelectCategory={(cat) => {
          const safeCat = sanitizeCategory(cat);
          setActiveCategory(safeCat);
          if (viewMode !== 'catalog') navigateToCatalog(safeCat);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        wishlistCount={wishlist.length}
        viewMode={viewMode}
        onSetViewMode={(mode) => {
          if (mode === 'admin') {
            navigateToAdmin();
          } else {
            setViewMode(mode);
            if (checkIsAdminUrl()) {
              window.history.pushState(null, '', '/');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onOpenAdmin={navigateToAdmin}
        isAdminSetupComplete={isAdminSetupComplete}
        totalResultsCount={filteredProducts.length}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1">
        
        {viewMode === 'product-detail' && selectedProduct ? (
          <ProductDetailPage
            product={selectedProduct}
            allProducts={products}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            onSelectProduct={(p) => {
              setSelectedProduct(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToCatalog={() => {
              setViewMode('catalog');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onToast={showToast}
          />
        ) : (
          <>
            {/* HERO BANNER (Only on Catalog Mode & No Active Search) */}
            {viewMode === 'catalog' && !searchQuery && (
              <Hero 
                onSelectCategory={(cat) => {
                  setActiveCategory(sanitizeCategory(cat));
                }}
                onShopClick={(cat) => {
                  if (cat) setActiveCategory(sanitizeCategory(cat));
                  const el = document.getElementById('catalog-grid');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }} 
              />
            )}

        {/* CATALOG / WISHLIST CONTAINER */}
        <div id="catalog-grid" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-12 w-full">
          
          {/* Section Heading & Category Filters */}
          <div className="mb-6 sm:mb-8">
            <div className="flex justify-between items-end mb-4 sm:mb-6">
              <h3 style={{ fontFamily: 'Georgia, serif' }} className="text-2xl italic font-bold text-[#1A1A1A]">
                {viewMode === 'wishlist'
                  ? 'Wishlist Collection'
                  : !activeCategory || typeof activeCategory !== 'string' || activeCategory === 'All' || String(activeCategory).includes('[object')
                  ? 'Featured Ensembles'
                  : `${activeCategory} Collection`}
              </h3>
              <div className="h-[1px] flex-1 bg-[#D4AF37]/30 mx-4 sm:mx-8 mb-2"></div>
              
              <div className="flex items-center gap-2">
                {viewMode === 'catalog' && (
                  <button
                    onClick={() => setActiveCategory('All')}
                    className="text-[10px] uppercase tracking-widest text-[#4A0E17] font-bold hover:text-[#D4AF37] transition-colors whitespace-nowrap px-3 py-1 bg-white border border-gray-200 rounded-lg hover:border-[#D4AF37]"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>

            {/* Quick Category Tabs */}
            {viewMode === 'catalog' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                {(['All', 'Traditional Sarees', 'Co-ord Sets', 'Churidar Sets', 'Fusion Wear', 'New Arrivals'] as CategoryType[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap border ${
                      activeCategory === cat
                        ? 'bg-[#4A0E17] text-[#D4AF37] border-[#D4AF37]'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Search Notification */}
          {searchQuery && (
            <div className={`mb-6 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all shadow-sm ${
              filteredProducts.length === 0
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-[#4A0E17]/10 border-[#D4AF37]/30 text-[#32080F]'
            }`}>
              <div className="flex items-center gap-2">
                <Search className={`w-4 h-4 shrink-0 ${filteredProducts.length === 0 ? 'text-rose-600' : 'text-[#4A0E17]'}`} />
                <span>
                  Search results for: <strong className="underline font-bold">"{searchQuery}"</strong>
                </span>
                {filteredProducts.length === 0 ? (
                  <span className="bg-rose-700 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ml-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-200" />
                    Invalid Search
                  </span>
                ) : (
                  <span className="bg-[#4A0E17] text-[#D4AF37] text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} found
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-[#4A0E17] font-bold underline hover:text-[#D4AF37] self-end sm:self-auto flex items-center gap-1 text-xs"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Interactive Filters & Sorting Control Bar (Price, Size, Stock, Sorting) */}
          <CatalogFilterBar
            selectedSort={selectedSort}
            onSelectSort={setSelectedSort}
            selectedSize={selectedSize}
            onSelectSize={setSelectedSize}
            selectedPriceRange={selectedPriceRange}
            onSelectPriceRange={setSelectedPriceRange}
            inStockOnly={inStockOnly}
            onToggleInStockOnly={setInStockOnly}
            totalFilteredCount={filteredProducts.length}
            totalProductsCount={products.length}
            onResetFilters={handleResetFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* SKELETON LOADING OR PRODUCTS GRID */}
          {isLoadingCatalog && filteredProducts.length === 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-6 md:gap-8 max-w-5xl mx-auto w-full items-stretch">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white p-2.5 sm:p-3.5 border border-gray-200 shadow-sm animate-pulse flex flex-col justify-between">
                  <div className="w-full aspect-[3/4] bg-gray-200 mb-3 rounded-xs"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-8 bg-gray-200 rounded mt-2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={`text-center py-12 px-6 sm:px-8 rounded-3xl border p-8 space-y-4 max-w-lg mx-auto shadow-md transition-all ${
              searchQuery ? 'bg-rose-50/40 border-2 border-rose-200' : 'bg-white border-dashed border-[#D4AF37]/40'
            }`}>
              
              {searchQuery ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto border-2 border-rose-300 shadow-inner">
                    <SearchX className="w-8 h-8 text-rose-700" />
                  </div>

                  <div className="inline-block bg-rose-800 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-rose-400 shadow-sm">
                    ⚠️ Invalid Search Query
                  </div>

                  <h3 style={{ fontFamily: 'Georgia, serif' }} className="text-xl sm:text-2xl italic font-bold text-rose-950">
                    No Products Found for "{searchQuery}"
                  </h3>

                  <p className="text-xs text-rose-900 leading-relaxed max-w-md mx-auto font-medium">
                    നിങ്ങൾ തിരഞ്ഞ <strong>"{searchQuery}"</strong> എന്ന വാക്കിന് യോജിച്ച ഉൽപ്പന്നങ്ങളൊന്നും കാറ്റലോഗിൽ കണ്ടെത്തിയില്ല. ദയവായി അക്ഷരത്തെറ്റുകൾ പരിശോധിക്കുക അല്ലെങ്കിൽ താഴെ നൽകിയിരിക്കുന്ന കീവേഡുകൾ ഉപയോഗിക്കുക.
                  </p>

                  <div className="pt-2 border-t border-rose-200/60 text-left">
                    <p className="text-[11px] font-bold text-gray-700 mb-2 text-center uppercase tracking-wider">
                      Popular Search Suggestions:
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {['Saree', 'Co-ord', 'Churidar', 'Cotton', 'Silk', 'Kanchipuram'].map((suggest) => (
                        <button
                          key={suggest}
                          onClick={() => setSearchQuery(suggest)}
                          className="px-2.5 py-1 bg-white hover:bg-[#4A0E17] hover:text-[#D4AF37] text-gray-800 text-[11px] font-semibold rounded-md border border-gray-300 transition-all shadow-xs"
                        >
                          {suggest}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 flex flex-wrap justify-center gap-2">
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear Filters</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setViewMode('catalog');
                        setActiveCategory('All');
                        setSearchQuery('');
                        handleResetFilters();
                      }}
                      className="px-5 py-2 rounded-xl bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] hover:bg-[#32080F] text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4 text-[#D4AF37]" />
                      <span>Show All Products</span>
                    </button>
                  </div>
                </>
              ) : hasActiveFilters ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-50 text-[#D4AF37] flex items-center justify-center mx-auto border border-[#D4AF37]">
                    <SlidersHorizontal className="w-8 h-8 text-[#4A0E17]" />
                  </div>
                  <h3 className="font-cinzel text-lg font-bold text-[#32080F]">No Items Match Your Filters</h3>
                  <p className="text-xs text-gray-600">
                    തിരഞ്ഞെടുത്ത സൈസ് (Size) അല്ലെങ്കിൽ വില പരിധിക്ക് (Price Range) അനുയോജ്യമായ ഉൽപ്പന്നങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല. ഫിൽട്ടറുകൾ മാറ്റി വീണ്ടും നോക്കാവുന്നതാണ്.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="px-6 py-2.5 rounded-full bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] hover:bg-[#32080F] text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Clear All Filters (ഫിൽട്ടറുകൾ മാറ്റുക)</span>
                  </button>
                </>
              ) : viewMode === 'wishlist' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#FAF6F0] text-[#D4AF37] flex items-center justify-center mx-auto border border-[#D4AF37]">
                    <Heart className="w-8 h-8" />
                  </div>
                  <h3 className="font-cinzel text-lg font-bold text-[#32080F]">Your Wishlist is Empty</h3>
                  <p className="text-xs text-gray-600">
                    Explore our traditional Kerala Sarees, Co-ord sets, and Churidar collections to save items here!
                  </p>
                  <button
                    onClick={() => {
                      setViewMode('catalog');
                      setActiveCategory('All');
                      setSearchQuery('');
                    }}
                    className="px-6 py-2.5 rounded-full gold-gradient-btn text-xs font-bold uppercase tracking-wider"
                  >
                    Browse All Products
                  </button>
                </>
              ) : products.length === 0 ? (
                <div className="py-6 space-y-4 max-w-lg mx-auto">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2B050B] to-[#4A0E17] text-[#D4AF37] flex items-center justify-center mx-auto border-2 border-[#D4AF37] shadow-lg">
                    <Sparkles className="w-8 h-8 text-[#FDE047] animate-pulse" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#4A0E17] bg-[#D4AF37]/20 px-3 py-1 rounded-full border border-[#D4AF37]/40 inline-block">
                      Exclusive Handloom Edit
                    </span>
                    <h3 style={{ fontFamily: 'Georgia, serif' }} className="text-xl sm:text-2xl italic font-bold text-[#32080F]">
                      New Festive Collection Arriving Soon
                    </h3>
                    <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed pt-1">
                      ഞങ്ങളുടെ പുതിയ ട്രെഡീഷണൽ കാസവ് സാരികളും ഡിസൈനർ കോ-ഓർഡ് സെറ്റുകളും ഓൺലൈൻ കാറ്റലോഗിലേക്ക് അപ്‌ലോഡ് ചെയ്തു വരുന്നു. കസ്റ്റം ഓർഡറുകൾക്കും കളക്ഷൻ വിവരങ്ങൾക്കും വാട്സാപ്പ് വഴി ബന്ധപ്പെടാം.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                      href={`https://wa.me/${CONTACT_NUMBERS[0].value}?text=${encodeURIComponent('Hello Yaarika Collections, I would like to inquire about your upcoming boutique collections and custom orders.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#25D366] text-white hover:bg-emerald-600 text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Custom Inquiry</span>
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#FAF6F0] text-[#D4AF37] flex items-center justify-center mx-auto border border-[#D4AF37]">
                    <Filter className="w-8 h-8" />
                  </div>
                  <h3 className="font-cinzel text-lg font-bold text-[#32080F]">No Products in this Category</h3>
                  <p className="text-xs text-gray-600">
                    Try selecting a different category or view all products.
                  </p>
                  <button
                    onClick={() => {
                      setViewMode('catalog');
                      setActiveCategory('All');
                      setSearchQuery('');
                    }}
                    className="px-6 py-2.5 rounded-full bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] hover:bg-[#32080F] text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    View All Categories
                  </button>
                </>
              )}

            </div>
          ) : (
            <div className="space-y-10">
              {/* Product Grid: 2 Items Per Row */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-6 md:gap-8 max-w-5xl mx-auto w-full items-stretch">
                {filteredProducts.slice(0, visibleCount).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isWishlisted={wishlist.includes(product.id)}
                    onToggleWishlist={handleToggleWishlist}
                    onQuickView={(p) => {
                      setSelectedProduct(p);
                      setViewMode('product-detail');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onToast={showToast}
                  />
                ))}
              </div>

              {/* Load More Button for large catalogs */}
              {filteredProducts.length > visibleCount && (
                <div className="text-center pt-4 pb-8 space-y-3">
                  <p className="text-xs text-gray-500 font-medium">
                    Showing <strong className="text-gray-900">{Math.min(visibleCount, filteredProducts.length).toLocaleString()}</strong> of <strong className="text-gray-900">{filteredProducts.length.toLocaleString()}</strong> exquisite items
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 24)}
                      className="px-8 py-3 rounded-full gold-gradient-btn text-xs font-extrabold uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
                    >
                      Load More Products (+24)
                    </button>
                    {filteredProducts.length > visibleCount + 24 && (
                      <button
                        onClick={() => setVisibleCount(filteredProducts.length)}
                        className="px-5 py-3 rounded-full bg-white hover:bg-gray-100 text-[#4A0E17] border border-[#D4AF37]/50 text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        Show All ({filteredProducts.length.toLocaleString()})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
        </>
        )}

      </main>

      {/* FOOTER */}
      <Footer
        onOpenAdmin={navigateToAdmin}
        isAdminSetupComplete={isAdminSetupComplete}
      />

      {/* ADMIN PORTAL OVERLAY */}
      {viewMode === 'admin' && (
        <AdminPortal
          onClose={navigateToCatalog}
          onToast={showToast}
          onRefreshProducts={refreshProducts}
        />
      )}

      {/* TOAST NOTIFICATION */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* SMOOTH SCROLL TO TOP FLOATING BUTTON */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top of website"
          className="fixed bottom-6 right-6 z-30 p-3 rounded-full bg-[#4A0E17] text-[#D4AF37] border border-[#D4AF37] shadow-xl hover:bg-[#32080F] hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group"
          title="Scroll to Top (മുകളിലേക്ക് സ്ക്രോൾ ചെയ്യുക)"
        >
          <ChevronUp className="w-5 h-5 text-[#D4AF37] group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}

    </div>
  );
}
