import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageCircle, 
  Phone, 
  Sparkles, 
  Check, 
  Share2, 
  Heart, 
  Truck, 
  ShieldCheck, 
  AlertTriangle, 
  PackageCheck, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Images
} from 'lucide-react';
import { Product, SizeType } from '../types';
import { createWhatsAppOrderLink, openWhatsAppLink, CONTACT_NUMBERS } from '../utils/whatsapp';
import { InquiryStorage } from '../services/storage';
import { isProductInStock, getSizeStockCount, isSizeInStock, getProductTotalStock } from '../utils/inventory';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onToast: (msg: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  isWishlisted,
  onToggleWishlist,
  onToast
}) => {
  if (!product) return null;

  // Assemble all available product images (up to 5)
  const productImages = React.useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images.filter(Boolean);
    }
    return product.imageUrl ? [product.imageUrl] : [];
  }, [product]);

  // Initialize selected size with first in-stock size if possible
  const firstInStockSize = product.sizes.find(s => isSizeInStock(product, s)) || product.sizes[0] || 'Free Size';
  const [selectedSize, setSelectedSize] = useState<SizeType>(firstInStockSize);
  const [copied, setCopied] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  useEffect(() => {
    if (product) {
      setActiveImageIndex(0);
      const inStockSize = product.sizes.find(s => isSizeInStock(product, s)) || product.sizes[0] || 'Free Size';
      setSelectedSize(inStockSize);
    }
  }, [product]);

  const currentDisplayImage = productImages[activeImageIndex] || product.imageUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';

  const handleNextImage = () => {
    if (productImages.length > 1) {
      setActiveImageIndex(prev => (prev + 1) % productImages.length);
    }
  };

  const handlePrevImage = () => {
    if (productImages.length > 1) {
      setActiveImageIndex(prev => (prev - 1 + productImages.length) % productImages.length);
    }
  };

  const isOverallInStock = isProductInStock(product);
  const isSelectedSizeInStock = isProductInStock(product, selectedSize);
  const totalUnits = getProductTotalStock(product);
  const selectedSizeUnits = getSizeStockCount(product, selectedSize);

  const handleOrderWhatsApp = (phoneNumber: string, contactLabel: string) => {
    if (!isOverallInStock || !isSelectedSizeInStock) {
      onToast(`Sorry, ${product.title} (${selectedSize}) is currently out of stock.`);
      return;
    }

    InquiryStorage.logInquiry(product.id, product.title, selectedSize, phoneNumber);
    
    const url = createWhatsAppOrderLink(
      product.title,
      product.price,
      selectedSize,
      phoneNumber
    );

    openWhatsAppLink(url);
    onToast(`Opening WhatsApp order with ${contactLabel}`);
  };

  const handleShare = async () => {
    const text = `Check out "${product.title}" - ₹${product.price.toLocaleString('en-IN')} at Yaarika Collections! WhatsApp Order: ${CONTACT_NUMBERS[0].display}`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Yaarika Collections - ${product.title}`,
          text: text,
          url: url
        });
        onToast('Shared successfully!');
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      onToast('Product link & order details copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      onToast('Please copy: ' + text);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      
      {/* Modal Card */}
      <div className="relative w-full max-w-3xl bg-[#FDFCF8] overflow-hidden shadow-2xl border-2 border-[#D4AF37] max-h-[90vh] flex flex-col md:flex-row">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 bg-[#4A0E17] text-[#D4AF37] hover:bg-black transition-colors border border-[#D4AF37]/50"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Column: Image & Gallery */}
        <div className="md:w-1/2 relative bg-[#F3F0E9] p-4 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-[#D4AF37]/30">
          
          {/* Main Large Image Stage */}
          <div className="relative w-full aspect-[3/4] overflow-hidden border border-[#D4AF37]/30 bg-black/5 rounded-xs">
            <img
              src={currentDisplayImage}
              alt={`${product.title} - View ${activeImageIndex + 1}`}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const fallback = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
                if (e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
                }
              }}
              className={`w-full h-full object-cover object-top transition-opacity duration-300 ${!isOverallInStock ? 'opacity-75 grayscale-[25%]' : ''}`}
            />
            
            {product.isNewArrival && (
              <span className="absolute top-3 left-3 bg-[#4A0E17] text-[#D4AF37] text-[9px] font-bold px-2.5 py-1 border border-[#D4AF37] uppercase tracking-widest flex items-center gap-1 shadow-md z-10">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" /> New Edit
              </span>
            )}

            {/* Photo Counter Pill (e.g. 2 / 5) */}
            {productImages.length > 1 && (
              <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10 border border-white/20">
                <Images className="w-3 h-3 text-[#D4AF37]" />
                <span>{activeImageIndex + 1} / {productImages.length}</span>
              </span>
            )}

            {/* Left / Right Carousel Arrow Buttons */}
            {productImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all z-10 border border-white/30 backdrop-blur-xs cursor-pointer active:scale-95"
                  title="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all z-10 border border-white/30 backdrop-blur-xs cursor-pointer active:scale-95"
                  title="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {!isOverallInStock && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-3 pointer-events-none z-10">
                <span className="bg-rose-900/95 text-white text-xs font-black uppercase tracking-widest px-4 py-2 border border-rose-400 shadow-2xl flex items-center gap-2 rounded-sm">
                  <AlertCircle className="w-4 h-4 text-rose-300" />
                  OUT OF STOCK
                </span>
              </div>
            )}
          </div>

          {/* Thumbnail Gallery (Shows up to 5 clickable photo thumbnails) */}
          {productImages.length > 1 && (
            <div className="w-full pt-3 flex items-center justify-center gap-2 overflow-x-auto">
              {productImages.map((img, idx) => {
                const isActive = idx === activeImageIndex;
                return (
                  <button
                    key={`${idx}-${img.slice(0, 30)}`}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-12 h-14 rounded overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                      isActive 
                        ? 'border-[#D4AF37] ring-2 ring-[#4A0E17] scale-105 shadow-md' 
                        : 'border-gray-300 opacity-65 hover:opacity-100 hover:border-gray-500'
                    }`}
                    title={`View photo ${idx + 1}`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const fallback = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-[#4A0E17]/80 text-[#D4AF37] text-[7px] font-bold text-center uppercase tracking-tighter py-0.2">
                        Cover
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Right Column: Details & Order CTA */}
        <div className="md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto space-y-4">
          
          <div>
            {/* Category & Shipping Badge */}
            <div className="flex items-center justify-between text-[10px] mb-2">
              <span className="font-bold text-[#4A0E17] uppercase tracking-widest">{product.category}</span>
              <span className="text-[#4A0E17] bg-[#D4AF37]/20 font-bold px-2 py-0.5 border border-[#D4AF37]/40 text-[9px] flex items-center gap-1 uppercase tracking-wider">
                <Truck className="w-3 h-3" /> All Kerala Free Shipping
              </span>
            </div>

            {/* Title */}
            <h2 style={{ fontFamily: 'Georgia, serif' }} className="text-2xl font-bold text-[#1A1A1A] mb-2 leading-tight">
              {product.title}
            </h2>

            {/* Price Tag & Stock Badge */}
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-baseline gap-3">
                <span style={{ fontFamily: 'Georgia, serif' }} className="text-2xl italic font-bold text-[#4A0E17]">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
                {product.originalPrice && (
                  <span className="text-xs text-gray-400 line-through">
                    ₹{product.originalPrice.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              {/* Dynamic Stock Status Badge */}
              {isOverallInStock && isSelectedSizeInStock ? (
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-1 border border-emerald-300 rounded-md flex items-center gap-1 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    In Stock ({selectedSizeUnits} available)
                  </span>
                </div>
              ) : (
                <span className="bg-rose-100 text-rose-900 text-[10px] font-extrabold px-2.5 py-1 border border-rose-400 rounded-md flex items-center gap-1 uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3 text-rose-700" />
                  {!isOverallInStock ? 'Out of Stock' : `Size ${selectedSize} Sold Out`}
                </span>
              )}
            </div>

            {/* Description */}
            <div className="text-xs text-gray-700 leading-relaxed space-y-1.5 mb-4 bg-[#F3F0E9] p-3 border border-[#D4AF37]/30">
              <p><strong>Description:</strong> {product.description}</p>
              {product.fabricDetails && (
                <p><strong>Fabric &amp; Work:</strong> {product.fabricDetails}</p>
              )}
            </div>

            {/* Size Selector with Stock Counts */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-[#4A0E17] uppercase tracking-widest">
                  Select Size: <span className="text-[#4A0E17] font-extrabold">{selectedSize}</span>
                </label>
                <span className="text-[9px] text-gray-500">
                  {selectedSizeUnits > 0 ? `${selectedSizeUnits} units in stock` : '0 in stock'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {product.sizes.map((s) => {
                  const sizeInStock = isSizeInStock(product, s);
                  const isSelected = selectedSize === s;
                  const count = getSizeStockCount(product, s);
                  return (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`px-3 py-1.5 text-xs font-bold uppercase border transition-all relative flex items-center gap-1.5 ${
                        isSelected
                          ? (sizeInStock
                              ? 'bg-[#4A0E17] text-[#D4AF37] border-[#D4AF37] shadow-sm'
                              : 'bg-rose-900 text-white border-rose-900 shadow-sm')
                          : (sizeInStock
                              ? 'bg-white text-gray-700 border-gray-300 hover:border-[#D4AF37]'
                              : 'bg-gray-100 text-gray-400 border-gray-200 line-through decoration-rose-500')
                      }`}
                      title={sizeInStock ? `${s} - ${count} in stock` : `${s} - Out of stock`}
                    >
                      <span>{s}</span>
                      {sizeInStock && count > 0 && (
                        <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-[#D4AF37] text-[#4A0E17]' : 'bg-gray-200 text-gray-700'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Action Area: WhatsApp Direct Order Numbers */}
          <div className="space-y-2 pt-2 border-t border-[#D4AF37]/30">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#4A0E17] uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Direct WhatsApp Desk:</span>
              </p>
              {!isOverallInStock || !isSelectedSizeInStock ? (
                <span className="text-[10px] text-rose-700 font-bold uppercase">
                  Ordering Disabled (Out of Stock)
                </span>
              ) : null}
            </div>

            {/* Button 1: Primary Order Desk (Automatically disabled if out of stock) */}
            {isOverallInStock && isSelectedSizeInStock ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => handleOrderWhatsApp(CONTACT_NUMBERS[0].value, CONTACT_NUMBERS[0].display)}
                  className="w-full py-2.5 px-4 bg-[#25D366] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between transition-all rounded-sm hover:opacity-95 shadow-sm cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Primary Desk ({CONTACT_NUMBERS[0].display})</span>
                  </div>
                  <span className="text-[9px] bg-black/20 px-2 py-0.5 font-normal">Order Size {selectedSize}</span>
                </button>

                {CONTACT_NUMBERS[1] && (
                  <button
                    onClick={() => handleOrderWhatsApp(CONTACT_NUMBERS[1].value, CONTACT_NUMBERS[1].display)}
                    className="w-full py-1.5 px-3 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[10.5px] uppercase tracking-wider flex items-center justify-between transition-all rounded-sm hover:bg-emerald-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-emerald-700" />
                      <span>Alternate Order Desk ({CONTACT_NUMBERS[1].display})</span>
                    </div>
                    <span className="text-[8.5px] text-emerald-600 font-semibold">WhatsApp</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                disabled
                className="w-full py-2.5 px-4 bg-gray-200 text-gray-500 border border-gray-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed rounded-sm"
              >
                <AlertTriangle className="w-4 h-4 text-gray-500" />
                <span>
                  {!isOverallInStock 
                    ? 'Product is Currently Out of Stock' 
                    : `Size ${selectedSize} is Out of Stock - Select another size`}
                </span>
              </button>
            )}

            {/* Secondary Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => onToggleWishlist(product.id)}
                className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'bg-[#4A0E17] text-[#D4AF37] border-[#D4AF37]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#D4AF37]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
                <span>{isWishlisted ? 'Saved' : 'Wishlist'}</span>
              </button>

              <button
                onClick={handleShare}
                className="flex-1 py-2 px-3 bg-white text-gray-700 border border-gray-300 hover:border-[#D4AF37] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Share'}</span>
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
