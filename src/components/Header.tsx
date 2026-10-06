import React, { useState } from 'react';
import { Search, Heart, Phone, Sparkles, Menu, X, ArrowRight } from 'lucide-react';
import { CategoryType, ViewMode } from '../types';
import { CONTACT_NUMBERS } from '../utils/whatsapp';
import yaarikaLogo from '../assets/images/regenerated_image_1787041748700.png';

interface HeaderProps {
  activeCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  wishlistCount: number;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  isAdminSetupComplete: boolean;
  totalResultsCount?: number;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  wishlistCount,
  viewMode,
  onSetViewMode,
  isAdminSetupComplete,
  totalResultsCount,
  onOpenAdmin,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastTapTime < 800) {
      const nextCount = logoTapCount + 1;
      setLogoTapCount(nextCount);
      if (nextCount >= 5) {
        setLogoTapCount(0);
        if (onOpenAdmin) {
          onOpenAdmin();
        } else {
          window.history.pushState(null, '', '/admin-dashboard');
          onSetViewMode('admin');
        }
        return;
      }
    } else {
      setLogoTapCount(1);
    }
    setLastTapTime(now);
    onSetViewMode('catalog');
  };

  const categories: CategoryType[] = [
    'All',
    'Traditional Sarees',
    'Co-ord Sets',
    'Churidar Sets',
    'Fusion Wear',
    'New Arrivals'
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const el = document.getElementById('catalog-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-b from-[#2B050B] via-[#3E0912] to-[#2E060D] text-[#D4AF37] border-b-2 border-[#D4AF37]/80 shadow-[0_10px_35px_rgba(0,0,0,0.5)] select-none">
      {/* Kasavu Gold Decorative Top Micro-Stripe */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />

      {/* Top Announcement Bar */}
      <div className="bg-black/40 text-[#D4AF37] px-4 sm:px-8 py-1.5 flex justify-between items-center text-[10px] sm:text-[11px] uppercase tracking-widest font-semibold border-b border-[#D4AF37]/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#D4AF37]/20 text-[#D4AF37]">
            <Sparkles className="w-2.5 h-2.5 text-[#FDE047]" />
          </span>
          <span className="text-[#FDFBF7] font-medium tracking-wider">
            All Kerala Free Shipping
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a 
            href={`https://wa.me/${CONTACT_NUMBERS[0].value}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="group flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 hover:bg-[#25D366]/30 text-emerald-300 hover:text-white transition-all text-[9.5px] sm:text-[10px] font-bold"
            title="Chat on WhatsApp"
          >
            <Phone className="w-2.5 h-2.5 text-[#25D366] group-hover:scale-110 transition-transform" />
            <span>WhatsApp: {CONTACT_NUMBERS[0].display}</span>
          </a>
        </div>
      </div>

      {/* Main Brand & Actions Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-3 pb-2 sm:pt-4 sm:pb-3">
        <div className="relative flex items-center justify-between gap-2">
          
          {/* Left Action / New Arrivals Quick Pill (on desktop) */}
          <div className="flex items-center gap-2 lg:w-56">
            <button
              onClick={() => {
                onSelectCategory('New Arrivals');
                onSetViewMode('catalog');
                const el = document.getElementById('catalog-grid');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#D4AF37] text-[#2B050B] px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wider rounded-full hover:brightness-110 transition-all hidden sm:flex items-center gap-1.5 shadow-[0_2px_10px_rgba(212,175,55,0.3)] cursor-pointer"
              title="Explore New Arrivals"
            >
              <Sparkles className="w-3 h-3 group-hover:rotate-12 transition-transform" />
              <span>New Arrivals</span>
            </button>
          </div>

          {/* Centered Brand Title with Monogram Royal Medallion */}
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3.5 cursor-pointer group mx-auto text-center py-0.5" 
            onClick={handleLogoClick}
            title="Yaarika Collections - Click for Home"
          >
            {/* Medallion Logo with Golden Halo Ring */}
            <div className="w-13 h-13 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden border-2 border-[#D4AF37] shadow-[0_0_18px_rgba(212,175,55,0.35)] group-hover:scale-105 group-hover:border-amber-300 transition-all bg-gradient-to-br from-[#2B050B] via-[#3E0912] to-[#1A0307] flex-shrink-0 flex items-center justify-center p-1.5">
              <img 
                src={yaarikaLogo} 
                alt="Yaarika Collections Logo" 
                className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png';
                }}
              />
            </div>

            {/* Typography */}
            <div className="text-center sm:text-left flex flex-col items-center sm:items-start">
              <h1 
                style={{ fontFamily: 'Georgia, serif' }} 
                className="text-2xl sm:text-3xl lg:text-[34px] italic font-black tracking-tight text-[#FDE047] leading-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)] group-hover:text-white transition-colors"
              >
                Yaarika
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-[1px] w-3 bg-[#D4AF37]/60 hidden sm:inline-block" />
                <p className="text-[9.5px] sm:text-[10.5px] uppercase tracking-[0.3em] text-[#F5EDE0] font-bold">
                  Collections
                </p>
                <span className="h-[1px] w-3 bg-[#D4AF37]/60 hidden sm:inline-block" />
              </div>
            </div>
          </div>

          {/* Right Header Actions (Wishlist & Mobile Toggle) */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 lg:w-56">
            {/* Wishlist Button */}
            <button
              onClick={() => onSetViewMode('wishlist')}
              className={`px-3.5 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                viewMode === 'wishlist'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#E5C158] text-[#2B050B] border-[#D4AF37] shadow-[0_2px_10px_rgba(212,175,55,0.4)]'
                  : 'border-[#D4AF37]/50 bg-black/30 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#2B050B] hover:border-[#D4AF37]'
              }`}
              title="Saved Wishlist"
            >
              <Heart className={`w-3.5 h-3.5 transition-colors ${wishlistCount > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="hidden sm:inline">Wishlist</span>
              {wishlistCount > 0 && (
                <span className="bg-[#2B050B] text-[#FDE047] text-[9.5px] font-black px-1.5 py-0.5 rounded-full border border-[#D4AF37]/60 leading-none">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[#D4AF37] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* High-End Search Capsule directly below Brand Title */}
        <div className="mt-3 sm:mt-3.5 max-w-xl mx-auto w-full px-1 sm:px-0">
          <form 
            onSubmit={handleSearchSubmit}
            className="relative w-full"
          >
            <div className={`flex items-center bg-[#FFFDF9] rounded-full border-2 p-1 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.25)] ${
              searchQuery && totalResultsCount === 0
                ? 'border-rose-400 ring-2 ring-rose-400/30'
                : 'border-[#D4AF37] focus-within:ring-2 focus-within:ring-[#D4AF37]/50 focus-within:border-[#B8860B]'
            }`}>
              <div className="pl-3.5 sm:pl-4 text-[#3E0912] flex items-center justify-center">
                <Search className="w-4 h-4 text-[#3E0912]" />
              </div>
              <input
                type="text"
                placeholder="Search Sarees, Co-ords, Churidars, Kurtis, Codes..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-transparent text-gray-900 placeholder:text-gray-400 text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 sm:py-2 focus:outline-none tracking-normal"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="px-2 text-gray-400 hover:text-[#2B050B] transition-colors p-1 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Gold Gradient Search Action Button */}
              <button
                type="submit"
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#D4AF37] text-[#2B050B] hover:brightness-110 font-black text-xs sm:text-sm px-4 sm:px-5 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 shadow-sm transition-all transform active:scale-95 shrink-0 border border-amber-200 cursor-pointer"
                title="Search Products"
              >
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="tracking-wide">Search</span>
              </button>
            </div>

            {/* Search feedback tag if searching */}
            {searchQuery && totalResultsCount === 0 && (
              <p className="text-[11px] text-rose-200 mt-1.5 text-center font-semibold drop-shadow-sm bg-rose-950/60 py-0.5 px-3 rounded-full inline-block mx-auto">
                No matching items found. Try searching by fabric, color, or category.
              </p>
            )}
          </form>
        </div>

        {/* Desktop & Tablet Categories Nav Bar (Refined Luxury Pills) */}
        <div className="hidden sm:flex items-center justify-center gap-2 sm:gap-3 lg:gap-4 mt-3 pt-2.5 border-t border-[#D4AF37]/25 text-[11px] uppercase tracking-wider font-bold">
          {categories.map((cat) => {
            const isActive = activeCategory === cat && viewMode === 'catalog';
            return (
              <button
                key={cat}
                onClick={() => {
                  onSelectCategory(cat);
                  if (viewMode !== 'catalog') onSetViewMode('catalog');
                }}
                className={`transition-all px-3.5 py-1.2 rounded-full cursor-pointer select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#D4AF37] text-[#2B050B] font-black shadow-[0_2px_10px_rgba(212,175,55,0.4)] scale-105'
                    : 'text-[#F5EDE0]/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Mobile Horizontal Category Pills (Smooth Scrolling) */}
        <div className="flex sm:hidden items-center gap-2 mt-2.5 pt-2 border-t border-[#D4AF37]/20 overflow-x-auto no-scrollbar pb-1 px-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat && viewMode === 'catalog';
            return (
              <button
                key={cat}
                onClick={() => {
                  onSelectCategory(cat);
                  if (viewMode !== 'catalog') onSetViewMode('catalog');
                }}
                className={`text-[10px] uppercase font-extrabold tracking-wider whitespace-nowrap px-3 py-1 rounded-full border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#E5C158] text-[#2B050B] border-[#D4AF37] shadow-sm'
                    : 'bg-black/30 text-[#D4AF37]/90 border-[#D4AF37]/30 hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#240409] border-t border-[#D4AF37]/40 px-5 py-4 space-y-3 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#D4AF37] uppercase tracking-widest border-b border-[#D4AF37]/20 pb-2">
            <span>Explore Collections</span>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="text-white/60 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => {
              const isActive = activeCategory === cat && viewMode === 'catalog';
              return (
                <button
                  key={cat}
                  onClick={() => {
                    onSelectCategory(cat);
                    onSetViewMode('catalog');
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-2 text-xs font-bold uppercase tracking-wider text-left rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    isActive
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#E5C158] text-[#2B050B] border-[#D4AF37] shadow-sm'
                      : 'bg-[#3A070F] text-[#F5EDE0] border-[#D4AF37]/30 hover:bg-[#520C17]'
                  }`}
                >
                  <span>{cat}</span>
                  {isActive && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#D4AF37]/20 flex flex-col gap-2">
            <a
              href={`https://wa.me/${CONTACT_NUMBERS[0].value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white text-[11px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 rounded-lg shadow-md transition-colors"
            >
              <Phone className="w-4 h-4" /> Direct WhatsApp Order Desk
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
