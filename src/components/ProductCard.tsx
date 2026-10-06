import React, { useState } from 'react';
import { Heart, MessageCircle, Eye, Tag, Sparkles, AlertCircle, PackageX, Images } from 'lucide-react';
import { Product, SizeType } from '../types';
import { createWhatsAppOrderLink, openWhatsAppLink, CONTACT_NUMBERS } from '../utils/whatsapp';
import { InquiryStorage } from '../services/storage';
import { isProductInStock, getSizeStockCount, isSizeInStock, getProductTotalStock } from '../utils/inventory';

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onQuickView: (product: Product) => void;
  onToast: (msg: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWishlisted,
  onToggleWishlist,
  onQuickView,
  onToast
}) => {
  // Find first size that is in stock, or fallback to first size
  const firstInStockSize = product.sizes.find(s => isSizeInStock(product, s)) || product.sizes[0] || 'Free Size';
  const [selectedSize, setSelectedSize] = useState<SizeType>(firstInStockSize);
  const [isHovered, setIsHovered] = useState(false);

  const productImages = product.images && product.images.length > 0
    ? product.images.filter(Boolean)
    : [product.imageUrl];

  const primaryImage = productImages[0] || product.imageUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
  const secondaryImage = productImages[1] || primaryImage;
  const hasMultipleImages = productImages.length > 1;

  const [imgSrc, setImgSrc] = useState<string>(primaryImage);

  // Synchronize imgSrc if product changes
  React.useEffect(() => {
    setImgSrc(primaryImage);
  }, [primaryImage]);

  const isOverallInStock = isProductInStock(product);
  const isSelectedSizeInStock = isProductInStock(product, selectedSize);
  const totalUnits = getProductTotalStock(product);
  const selectedSizeUnits = getSizeStockCount(product, selectedSize);

  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleWhatsAppOrder = (phone: string = CONTACT_NUMBERS[0].value) => {
    if (!isOverallInStock || !isSelectedSizeInStock) {
      onToast(`Sorry, ${product.title} (${selectedSize}) is currently out of stock.`);
      return;
    }

    // Log inquiry for admin analytics
    InquiryStorage.logInquiry(product.id, product.title, selectedSize, phone);
    
    const url = createWhatsAppOrderLink(
      product.title,
      product.price,
      selectedSize,
      phone
    );

    openWhatsAppLink(url);
    onToast(`Opening WhatsApp order for ${product.title} (${selectedSize})`);
  };

  return (
    <div className={`group bg-[#FDFCF8] p-2 sm:p-3.5 border transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-md h-full w-full ${
      isOverallInStock ? 'border-[#D4AF37]/20 hover:border-[#D4AF37]/60' : 'border-rose-200 bg-rose-50/15'
    }`}>
      
      {/* Top Aspect Ratio Frame */}
      <div 
        className="w-full aspect-[3/4] bg-[#F3F0E9] border border-[#D4AF37]/20 relative mb-2.5 overflow-hidden flex items-center justify-center cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onQuickView(product)}
      >
        
        {/* Main Product Image with Secondary Image on Hover */}
        <img
          src={hasMultipleImages && isHovered ? secondaryImage : (imgSrc || primaryImage)}
          alt={product.title}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const fallback = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
            if (e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
              setImgSrc(fallback);
            }
          }}
          className={`w-full h-full object-cover object-top block transition-all duration-500 group-hover:scale-105 ${
            !isOverallInStock ? 'opacity-75 grayscale-[30%]' : ''
          }`}
          loading="lazy"
        />

        {/* Multi-Photo Count Indicator Badge */}
        {hasMultipleImages && (
          <div className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/20 shadow-xs z-10">
            <Images className="w-3 h-3 text-[#D4AF37]" />
            <span>{productImages.length}</span>
          </div>
        )}

        {/* Out of Stock Overlay Ribbon / Badge */}
        {!isOverallInStock && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-2 z-10 pointer-events-none">
            <span className="bg-rose-900/95 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 py-1 sm:px-3 sm:py-1.5 border border-rose-400 shadow-xl flex items-center gap-1.5 rounded-xs text-center">
              <AlertCircle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              OUT OF STOCK
            </span>
          </div>
        )}

        {/* Top Right Badge */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1 z-10 items-end">
          {!isOverallInStock ? (
            <span className="bg-rose-800 text-white text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider border border-rose-400 shadow-sm">
              SOLD OUT
            </span>
          ) : (
            <>
              {product.isNewArrival && (
                <span className="bg-[#4A0E17] text-[#D4AF37] text-[8px] sm:text-[9px] px-1.5 py-0.5 sm:px-2 sm:py-1 font-bold tracking-widest uppercase border border-[#D4AF37]/30 shadow-xs">
                  NEW
                </span>
              )}
              {discountPercent > 0 && (
                <span className="bg-[#D4AF37] text-[#4A0E17] text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 uppercase shadow-xs">
                  {discountPercent}% OFF
                </span>
              )}
              {totalUnits > 0 && totalUnits <= 3 && (
                <span className="bg-amber-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 uppercase rounded-xs shadow-xs">
                  Only {totalUnits} left
                </span>
              )}
            </>
          )}
        </div>

        {/* Wishlist Icon Button */}
        <button
          onClick={() => onToggleWishlist(product.id)}
          className={`absolute top-2 left-2 sm:top-3 sm:left-3 p-1 sm:p-1.5 backdrop-blur-md transition-transform active:scale-95 z-20 border shadow-xs ${
            isWishlisted
              ? 'bg-[#4A0E17] text-[#D4AF37] border-[#D4AF37]'
              : 'bg-white/90 text-gray-700 border-gray-200 hover:text-[#4A0E17]'
          }`}
          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          <Heart className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Quick View Button on Hover */}
        <button
          onClick={() => onQuickView(product)}
          className="hidden sm:block absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#4A0E17] text-[#D4AF37] text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-[#D4AF37]/50 z-20"
        >
          Quick View
        </button>
      </div>

      {/* Product Information */}
      <div className="flex-1 flex flex-col justify-between pt-0.5 w-full">
        <div>
          <div className="flex items-start justify-between gap-1 min-h-[30px] sm:min-h-[36px]">
            <h4 
              onClick={() => onQuickView(product)}
              className="text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-wide line-clamp-2 cursor-pointer hover:text-[#4A0E17] transition-colors flex-1 leading-tight text-gray-900"
              title={product.title}
            >
              {product.title}
            </h4>
          </div>

          <div className="flex items-baseline justify-between mt-1 gap-1">
            <p style={{ fontFamily: 'Georgia, serif' }} className="text-[#4A0E17] text-xs sm:text-sm md:text-base italic font-extrabold">
              ₹{product.price.toLocaleString('en-IN')}
            </p>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[9px] sm:text-[10px] text-gray-400 line-through font-medium">
                ₹{product.originalPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Sizes Pill selector with Stock availability */}
          <div className="mt-1.5 pt-1.5 border-t border-[#D4AF37]/20">
            <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-wider mb-1">
              <span>Sizes: <strong className="text-[#4A0E17]">{selectedSize}</strong></span>
              {isOverallInStock && (
                <span className={`font-semibold text-[7px] sm:text-[8px] ${selectedSizeUnits > 0 ? (selectedSizeUnits <= 2 ? 'text-amber-700 font-bold' : 'text-emerald-700') : 'text-rose-600 font-bold'}`}>
                  {selectedSizeUnits > 0 ? `${selectedSizeUnits} in stock` : 'Out of Stock'}
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1">
              {product.sizes.map((s) => {
                const sizeAvailable = isSizeInStock(product, s);
                const isSelected = selectedSize === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSize(s)}
                    className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 uppercase font-bold border transition-colors relative min-w-[20px] sm:min-w-[24px] text-center ${
                      isSelected
                        ? (sizeAvailable 
                            ? 'bg-[#4A0E17] text-[#D4AF37] border-[#D4AF37]' 
                            : 'bg-rose-900 text-white border-rose-900')
                        : (sizeAvailable 
                            ? 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]' 
                            : 'bg-gray-100 text-gray-400 border-gray-200 line-through decoration-rose-500')
                    }`}
                    title={sizeAvailable ? `${s} (In Stock)` : `${s} (Out of Stock)`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order on WhatsApp CTA or Out of Stock Button (Automatically disabled when out of stock) */}
        <button
          type="button"
          onClick={() => handleWhatsAppOrder(CONTACT_NUMBERS[0].value)}
          disabled={!isOverallInStock || !isSelectedSizeInStock}
          aria-disabled={!isOverallInStock || !isSelectedSizeInStock}
          className={`mt-2.5 w-full flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 text-[9px] sm:text-[10px] font-bold uppercase rounded-xs transition-all shadow-xs ${
            isOverallInStock && isSelectedSizeInStock
              ? 'bg-[#25D366] text-white hover:opacity-90 active:scale-98 cursor-pointer'
              : 'bg-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed opacity-75'
          }`}
          title={
            !isOverallInStock 
              ? 'Product is currently Out of Stock' 
              : !isSelectedSizeInStock 
                ? `Size ${selectedSize} is Out of Stock` 
                : 'Order directly via WhatsApp'
          }
        >
          {isOverallInStock && isSelectedSizeInStock ? (
            <>
              <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
              <span className="truncate">Order on WhatsApp</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 shrink-0" />
              <span className="truncate">
                {!isOverallInStock ? 'Out of Stock' : `Size ${selectedSize} Sold Out`}
              </span>
            </>
          )}
        </button>

      </div>

    </div>
  );
};
