import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MessageCircle, 
  Heart, 
  Share2, 
  Sparkles, 
  Check, 
  Truck, 
  ShieldCheck, 
  Images, 
  ChevronLeft, 
  ChevronRight,
  PackageCheck,
  AlertCircle
} from 'lucide-react';
import { Product, SizeType } from '../types';
import { createWhatsAppOrderLink, openWhatsAppLink, CONTACT_NUMBERS } from '../utils/whatsapp';
import { InquiryStorage } from '../services/storage';
import { isProductInStock, getSizeStockCount, isSizeInStock, getProductTotalStock } from '../utils/inventory';
import { ProductCard } from './ProductCard';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  wishlist: string[];
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  onBackToCatalog: () => void;
  onToast: (msg: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  allProducts,
  wishlist,
  onToggleWishlist,
  onSelectProduct,
  onBackToCatalog,
  onToast
}) => {
  const productImages = React.useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images.filter(Boolean);
    }
    return product.imageUrl ? [product.imageUrl] : [];
  }, [product]);

  const firstInStockSize = product.sizes.find(s => isSizeInStock(product, s)) || product.sizes[0] || 'Free Size';
  const [selectedSize, setSelectedSize] = useState<SizeType>(firstInStockSize);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    const inStockSize = product.sizes.find(s => isSizeInStock(product, s)) || product.sizes[0] || 'Free Size';
    setSelectedSize(inStockSize);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product]);

  const currentDisplayImage = productImages[activeImageIndex] || product.imageUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800';

  const isOverallInStock = isProductInStock(product);
  const isSelectedSizeInStock = isSizeInStock(product, selectedSize);
  const isWishlisted = wishlist.includes(product.id);

  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

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
      } catch (err) {}
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

  // Filter other related products for the bottom list
  const relatedProducts = allProducts.filter(p => p.id !== product.id).slice(0, 8);

  return (
    <div className="min-h-screen bg-[#FDFCF8] py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#F3F0E9] text-[#4A0E17] border border-[#D4AF37]/60 font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-[#D4AF37]" /> Back to Collections
          </button>
        </div>

        {/* Main Product Details Card */}
        <div className="bg-white rounded-xl shadow-xl border-2 border-[#D4AF37]/40 overflow-hidden mb-16 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 p-6 sm:p-10">
          
          {/* Left: Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-[#F3F0E9] border border-[#D4AF37]/30 shadow-inner">
              <img
                src={currentDisplayImage}
                alt={product.title}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover object-top transition-all duration-500 ${!isOverallInStock ? 'grayscale-[30%] opacity-80' : ''}`}
              />

              {product.isNewArrival && (
                <span className="absolute top-4 left-4 bg-[#4A0E17] text-[#D4AF37] text-[10px] font-bold px-3 py-1.5 border border-[#D4AF37] uppercase tracking-widest flex items-center gap-1.5 shadow-md z-10">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> New Edit
                </span>
              )}

              {productImages.length > 1 && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/20">
                  <Images className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{activeImageIndex + 1} / {productImages.length}</span>
                </div>
              )}

              {productImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImageIndex(prev => (prev - 1 + productImages.length) % productImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/30 backdrop-blur-xs cursor-pointer shadow-lg"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setActiveImageIndex(prev => (prev + 1) % productImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/30 backdrop-blur-xs cursor-pointer shadow-lg"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {!isOverallInStock && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
                  <span className="bg-[#4A0E17] text-[#D4AF37] px-6 py-3 border-2 border-[#D4AF37] font-serif font-bold text-sm tracking-widest uppercase shadow-2xl">
                    Currently Sold Out
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnails row */}
            {productImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-20 h-24 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                      activeImageIndex === idx ? 'border-[#4A0E17] ring-2 ring-[#D4AF37]' : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Name, Details, Wishlist & Order Buttons */}
          <div className="flex flex-col justify-between space-y-6">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#4A0E17] bg-[#F3F0E9] px-3 py-1 rounded-full border border-[#D4AF37]/30">
                  {product.category}
                </span>
                <span className="text-xs text-gray-500 font-medium">Product ID: {product.id}</span>
              </div>

              {/* Product Name */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#4A0E17] leading-tight">
                {product.title}
              </h1>

              {/* Price & Discount */}
              <div className="flex items-baseline gap-4 pt-1">
                <span className="text-3xl font-serif font-bold text-[#4A0E17]">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <>
                    <span className="text-lg text-gray-400 line-through font-medium">
                      ₹{product.originalPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold px-2.5 py-1 rounded-sm uppercase tracking-wider">
                      {discountPercent}% OFF
                    </span>
                  </>
                )}
              </div>

              {/* Description */}
              <div className="border-t border-b border-[#D4AF37]/20 py-4 my-4 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#4A0E17]">Description & Craftsmanship</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {product.description || 'Exquisite traditional Kerala ethnic wear handpicked for elegance and grace.'}
                </p>
                {product.fabricDetails && (
                  <p className="text-xs text-gray-600 font-medium pt-1">
                    <strong className="text-[#4A0E17]">Fabric & Weave:</strong> {product.fabricDetails}
                  </p>
                )}
              </div>

              {/* Size Selector */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#4A0E17]">
                    Select Size: <span className="text-[#D4AF37] font-extrabold">{selectedSize}</span>
                  </label>
                  <span className="text-xs text-gray-500">All India & Kerala Free Shipping</span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {product.sizes.map((size) => {
                    const inStock = isSizeInStock(product, size);
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2.5 text-xs font-bold rounded-md border transition-all ${
                          isSelected
                            ? 'bg-[#4A0E17] text-[#D4AF37] border-[#4A0E17] shadow-md ring-1 ring-[#D4AF37]'
                            : inStock
                            ? 'bg-white text-gray-800 border-[#D4AF37]/40 hover:border-[#4A0E17]'
                            : 'bg-gray-100 text-gray-400 border-gray-200 line-through cursor-not-allowed'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons: Order Now & Add to Wishlist */}
            <div className="space-y-4 pt-4 border-t border-[#D4AF37]/30">
              
              {/* WhatsApp Order Now Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleOrderWhatsApp(CONTACT_NUMBERS[0].value, CONTACT_NUMBERS[0].label)}
                  disabled={!isOverallInStock || !isSelectedSizeInStock}
                  className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg transition-all duration-300 ${
                    isOverallInStock && isSelectedSizeInStock
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 hover:scale-[1.01] active:scale-95 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <MessageCircle className="w-5 h-5 fill-white text-emerald-600" />
                  <span>Order Now via WhatsApp</span>
                </button>

                {CONTACT_NUMBERS.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleOrderWhatsApp(CONTACT_NUMBERS[1].value, CONTACT_NUMBERS[1].label)}
                    disabled={!isOverallInStock || !isSelectedSizeInStock}
                    className="w-full py-2.5 rounded-lg bg-[#4A0E17]/10 hover:bg-[#4A0E17]/20 text-[#4A0E17] border border-[#4A0E17]/30 font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Order via Secondary Support ({CONTACT_NUMBERS[1].display})
                  </button>
                )}
              </div>

              {/* Secondary Buttons Row: Add to Wishlist & Share */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onToggleWishlist(product.id)}
                  className={`py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${
                    isWishlisted
                      ? 'bg-[#4A0E17] text-[#D4AF37] border-[#4A0E17]'
                      : 'bg-white hover:bg-gray-50 text-[#4A0E17] border-[#D4AF37]/60'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#4A0E17]'}`} />
                  <span>{isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="py-3 px-4 rounded-xl bg-white hover:bg-gray-50 text-[#4A0E17] border border-[#D4AF37]/60 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Share2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>{copied ? 'Copied Link!' : 'Share Product'}</span>
                </button>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-gray-600 font-medium">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F3F0E9]/60 border border-[#D4AF37]/20">
                  <Truck className="w-4 h-4 text-[#4A0E17] shrink-0" />
                  <span>Free Shipping across Kerala</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F3F0E9]/60 border border-[#D4AF37]/20">
                  <ShieldCheck className="w-4 h-4 text-[#4A0E17] shrink-0" />
                  <span>100% Authentic Handloom</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Other Website Products Section (Related Products List / Grid) */}
        <div className="space-y-6 pt-6 border-t-2 border-[#D4AF37]/30">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#D4AF37]">Explore More</span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#4A0E17]">Other Exquisite Pieces</h2>
            </div>
            <p className="text-xs text-gray-500">Click any product below to view its details and order options</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map(item => (
              <div 
                key={item.id} 
                className="cursor-pointer"
                onClick={() => {
                  onSelectProduct(item);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <ProductCard
                  product={item}
                  isWishlisted={wishlist.includes(item.id)}
                  onToggleWishlist={onToggleWishlist}
                  onQuickView={(p) => {
                    onSelectProduct(p);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onToast={onToast}
                />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
