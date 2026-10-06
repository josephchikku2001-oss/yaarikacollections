import React, { useState } from 'react';
import { 
  ArrowDownUp, 
  Filter, 
  SlidersHorizontal, 
  X, 
  RotateCcw, 
  Check, 
  Tag, 
  Ruler, 
  IndianRupee, 
  CheckCircle2, 
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { PriceRangeOption, SizeType, SortOption } from '../types';

interface CatalogFilterBarProps {
  selectedSort: SortOption;
  onSelectSort: (sort: SortOption) => void;
  selectedSize: SizeType | 'All';
  onSelectSize: (size: SizeType | 'All') => void;
  selectedPriceRange: PriceRangeOption;
  onSelectPriceRange: (range: PriceRangeOption) => void;
  inStockOnly: boolean;
  onToggleInStockOnly: (val: boolean) => void;
  totalFilteredCount: number;
  totalProductsCount: number;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export const CatalogFilterBar: React.FC<CatalogFilterBarProps> = ({
  selectedSort,
  onSelectSort,
  selectedSize,
  onSelectSize,
  selectedPriceRange,
  onSelectPriceRange,
  inStockOnly,
  onToggleInStockOnly,
  totalFilteredCount,
  totalProductsCount,
  onResetFilters,
  hasActiveFilters,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const availableSizes: (SizeType | 'All')[] = [
    'All',
    'Free Size',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    '3XL'
  ];

  const priceRanges: { id: PriceRangeOption; label: string; sub: string }[] = [
    { id: 'all', label: 'All Prices', sub: 'എല്ലാ വിലയും' },
    { id: 'under_1000', label: 'Under ₹1,000', sub: '₹1,000 ൽ താഴെ' },
    { id: '1000_2000', label: '₹1,000 – ₹2,000', sub: 'ബജറ്റ് കളക്ഷൻ' },
    { id: '2000_3500', label: '₹2,000 – ₹3,500', sub: 'പ്രീമിയം' },
    { id: 'above_3500', label: 'Above ₹3,500', sub: 'റോയൽ & ബ്രൈഡൽ' },
  ];

  const sortOptions: { id: SortOption; label: string; sub: string }[] = [
    { id: 'featured', label: 'Featured / Recommended', sub: 'പ്രത്യേകം തിരഞ്ഞെടുത്തവ' },
    { id: 'price_low_high', label: 'Price: Low to High', sub: 'വില: കുറഞ്ഞതിൽ നിന്ന് കൂടിയതിലേക്ക്' },
    { id: 'price_high_low', label: 'Price: High to Low', sub: 'വില: കൂടിയതിൽ നിന്ന് കുറഞ്ഞതിലേക്ക്' },
    { id: 'newest', label: 'Newest Arrivals First', sub: 'പുതിയ ഡിസൈനുകൾ' },
  ];

  return (
    <div className="mb-6 bg-white border border-[#D4AF37]/30 rounded-2xl shadow-xs overflow-hidden transition-all">
      
      {/* Top Bar: Quick Sort & Filter Toggle */}
      <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 bg-[#FDFCF8]">
        
        {/* Left: Filter Toggle & Results Count */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all shadow-2xs ${
              isExpanded || hasActiveFilters
                ? 'bg-[#4A0E17] text-[#D4AF37] border-[#4A0E17]'
                : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#4A0E17]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters & Sort</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* In Stock Only Switch */}
          <button
            type="button"
            onClick={() => onToggleInStockOnly(!inStockOnly)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              inStockOnly
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-extrabold'
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${inStockOnly ? 'text-emerald-600' : 'text-gray-400'}`} />
            <span>In Stock Only</span>
          </button>

          {/* Quick Count Badge */}
          <span className="text-[11px] text-gray-500 font-medium hidden md:inline">
            Showing <strong className="text-gray-900">{totalFilteredCount}</strong> of {totalProductsCount} items
          </span>
        </div>

        {/* Right: Quick Sort Selector */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1 shadow-2xs">
            <ArrowDownUp className="w-3.5 h-3.5 text-[#4A0E17]" />
            <span className="text-[10px] uppercase font-bold text-gray-500 hidden sm:inline">Sort:</span>
            <select
              value={selectedSort}
              onChange={(e) => onSelectSort(e.target.value as SortOption)}
              className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer pr-1"
            >
              {sortOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset button if active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="p-1.5 px-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Filter Details Panel */}
      {isExpanded && (
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white space-y-4">
          
          {/* Section 1: Filter by Size (M, L, XL, etc.) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-900">
                <Ruler className="w-3.5 h-3.5 text-[#4A0E17]" />
                <span>Filter by Size (സൈസ് തിരഞ്ഞെടുക്കുക)</span>
              </div>
              {selectedSize !== 'All' && (
                <button
                  type="button"
                  onClick={() => onSelectSize('All')}
                  className="text-[10px] font-bold text-[#4A0E17] hover:underline"
                >
                  Clear Size
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {availableSizes.map((sz) => {
                const isSelected = selectedSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onSelectSize(sz)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border ${
                      isSelected
                        ? 'bg-[#4A0E17] text-[#D4AF37] border-[#4A0E17] shadow-xs scale-105'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:bg-white'
                    }`}
                  >
                    {sz === 'All' ? 'All Sizes (എല്ലാം)' : sz}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Filter by Price Range */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-900">
                <IndianRupee className="w-3.5 h-3.5 text-[#4A0E17]" />
                <span>Price Range (വില പരിധി)</span>
              </div>
              {selectedPriceRange !== 'all' && (
                <button
                  type="button"
                  onClick={() => onSelectPriceRange('all')}
                  className="text-[10px] font-bold text-[#4A0E17] hover:underline"
                >
                  Clear Price
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {priceRanges.map((pr) => {
                const isSelected = selectedPriceRange === pr.id;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => onSelectPriceRange(pr.id)}
                    className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#4A0E17] text-[#D4AF37] border-[#4A0E17] shadow-xs'
                        : 'bg-gray-50 text-gray-800 border-gray-200 hover:border-[#D4AF37] hover:bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold">{pr.label}</span>
                    <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-[#D4AF37]/80' : 'text-gray-400'}`}>
                      {pr.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Sort Options Grid for Mobile / Expanded */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-900 mb-2">
              <ArrowDownUp className="w-3.5 h-3.5 text-[#4A0E17]" />
              <span>Sorting Mode (വില ക്രമീകരണം)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {sortOptions.map((opt) => {
                const isSelected = selectedSort === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSelectSort(opt.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-start justify-between ${
                      isSelected
                        ? 'bg-amber-50/80 border-[#D4AF37] text-[#4A0E17] shadow-2xs font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1">
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {opt.sub}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#4A0E17] shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filters Bar */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-500">Active:</span>
                
                {selectedSize !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4A0E17]/10 text-[#4A0E17] border border-[#4A0E17]/20 rounded-md text-[10px] font-bold">
                    Size: {selectedSize}
                    <button type="button" onClick={() => onSelectSize('All')}>
                      <X className="w-3 h-3 hover:text-rose-600" />
                    </button>
                  </span>
                )}

                {selectedPriceRange !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4A0E17]/10 text-[#4A0E17] border border-[#4A0E17]/20 rounded-md text-[10px] font-bold">
                    Price: {priceRanges.find(p => p.id === selectedPriceRange)?.label}
                    <button type="button" onClick={() => onSelectPriceRange('all')}>
                      <X className="w-3 h-3 hover:text-rose-600" />
                    </button>
                  </span>
                )}

                {selectedSort !== 'featured' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-bold">
                    Sort: {sortOptions.find(s => s.id === selectedSort)?.label}
                    <button type="button" onClick={() => onSelectSort('featured')}>
                      <X className="w-3 h-3 hover:text-rose-600" />
                    </button>
                  </span>
                )}

                {inStockOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md text-[10px] font-bold">
                    In Stock Only
                    <button type="button" onClick={() => onToggleInStockOnly(false)}>
                      <X className="w-3 h-3 hover:text-rose-600" />
                    </button>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onResetFilters}
                className="text-xs font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1 ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                Clear All Filters (എല്ലാം മാറ്റുക)
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
