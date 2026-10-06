import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Layers, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Flame, 
  Boxes, 
  ChevronDown, 
  ChevronUp,
  X
} from 'lucide-react';
import { Product, CategoryType, SizeType } from '../types';
import { ProductStorage } from '../services/storage';
import { compressImageFile } from '../utils/imageCompressor';

interface MultiLayerProductCreatorProps {
  onSuccess: (count: number) => void;
  onCancel: () => void;
  onToast: (msg: string) => void;
  editingProduct?: Product | null;
}

export interface ProductLayerItem {
  layerId: string;
  title: string;
  category: CategoryType;
  price: string;
  originalPrice: string;
  sizes: SizeType[];
  sizeStock: Partial<Record<SizeType, string>>;
  description: string;
  fabricDetails: string;
  imageUrl: string;
  images: string[]; // Up to 5 images per product
  inStock: boolean;
  featured: boolean;
  isNewArrival: boolean;
  isExpanded?: boolean;
}

const MAX_LAYERS = 10;
const MAX_IMAGES_PER_PRODUCT = 5;

const availableCategories: CategoryType[] = [
  'Traditional Sarees',
  'Co-ord Sets',
  'Churidar Sets',
  'Fusion Wear',
  'New Arrivals'
];

const allSizesList: SizeType[] = ['Free Size', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

const createEmptyLayer = (index: number): ProductLayerItem => ({
  layerId: `layer-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
  title: '',
  category: 'Traditional Sarees',
  price: '',
  originalPrice: '',
  sizes: ['M', 'L', 'XL', 'XXL'],
  sizeStock: {
    M: '5',
    L: '5',
    XL: '5',
    XXL: '5'
  },
  description: '',
  fabricDetails: '',
  imageUrl: '',
  images: [],
  inStock: true,
  featured: false,
  isNewArrival: true,
  isExpanded: true
});

export const MultiLayerProductCreator: React.FC<MultiLayerProductCreatorProps> = ({
  onSuccess,
  onCancel,
  onToast,
  editingProduct
}) => {
  const isEditMode = !!editingProduct;

  const [layers, setLayers] = useState<ProductLayerItem[]>(() => {
    if (editingProduct) {
      const sizes = editingProduct.sizes && editingProduct.sizes.length > 0 ? editingProduct.sizes : ['M', 'L', 'XL', 'XXL'];
      const sizeStockMap: Partial<Record<SizeType, string>> = {};
      sizes.forEach(s => {
        if (editingProduct.sizeStock && editingProduct.sizeStock[s] !== undefined) {
          sizeStockMap[s] = editingProduct.sizeStock[s]!.toString();
        } else if (editingProduct.stockCount !== undefined) {
          sizeStockMap[s] = editingProduct.stockCount.toString();
        } else {
          sizeStockMap[s] = editingProduct.inStock ? '5' : '0';
        }
      });

      // Assemble existing images
      const initialImages: string[] = [];
      if (editingProduct.images && editingProduct.images.length > 0) {
        editingProduct.images.forEach(img => {
          if (img && !initialImages.includes(img)) initialImages.push(img);
        });
      } else if (editingProduct.imageUrl) {
        initialImages.push(editingProduct.imageUrl);
      }

      return [{
        layerId: `edit-${editingProduct.id}`,
        title: editingProduct.title,
        category: editingProduct.category,
        price: editingProduct.price.toString(),
        originalPrice: editingProduct.originalPrice ? editingProduct.originalPrice.toString() : '',
        sizes,
        sizeStock: sizeStockMap,
        description: editingProduct.description || '',
        fabricDetails: editingProduct.fabricDetails || '',
        imageUrl: initialImages[0] || editingProduct.imageUrl || '',
        images: initialImages.slice(0, MAX_IMAGES_PER_PRODUCT),
        inStock: editingProduct.inStock,
        featured: editingProduct.featured || false,
        isNewArrival: editingProduct.isNewArrival || false,
        isExpanded: true
      }];
    }
    return [createEmptyLayer(1)];
  });

  const [urlInputs, setUrlInputs] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleUrlInputChange = (layerIndex: number, val: string) => {
    setUrlInputs(prev => ({ ...prev, [layerIndex]: val }));
  };

  const handleApplyUrlInput = (layerIndex: number) => {
    const url = urlInputs[layerIndex];
    if (url && url.trim()) {
      handleAddImageUrlToLayer(layerIndex, url.trim());
      setUrlInputs(prev => ({ ...prev, [layerIndex]: '' }));
    }
  };

  // Add a new product layer (up to MAX_LAYERS)
  const handleAddNewLayer = () => {
    if (layers.length >= MAX_LAYERS) {
      onToast(`Maximum ${MAX_LAYERS} product layers allowed at a time.`);
      return;
    }
    const newLayer = createEmptyLayer(layers.length + 1);
    setLayers(prev => [...prev, newLayer]);
    onToast(`Added Layer #${layers.length + 1} (${layers.length + 1}/${MAX_LAYERS})`);
  };

  // Duplicate an existing layer (for rapid color / variant entry)
  const handleDuplicateLayer = (index: number) => {
    if (layers.length >= MAX_LAYERS) {
      onToast(`Maximum ${MAX_LAYERS} product layers allowed at a time.`);
      return;
    }
    const source = layers[index];
    const cloned: ProductLayerItem = {
      ...source,
      layerId: `layer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: source.title ? `${source.title} (Copy)` : '',
      isExpanded: true
    };
    const updated = [...layers];
    updated.splice(index + 1, 0, cloned);
    setLayers(updated);
    onToast(`Duplicated Layer #${index + 1} to Layer #${index + 2}!`);
  };

  // Remove a layer
  const handleRemoveLayer = (index: number) => {
    if (layers.length <= 1) {
      onToast('At least 1 product layer must remain.');
      return;
    }
    const updated = layers.filter((_, idx) => idx !== index);
    setLayers(updated);
    onToast(`Removed Layer #${index + 1}.`);
  };

  // Update a specific field in a specific layer
  const handleUpdateLayerField = (index: number, field: keyof ProductLayerItem, value: any) => {
    setLayers(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  // Handle local image file upload for a specific layer (supports multiple files up to MAX_IMAGES_PER_PRODUCT = 5)
  const handleLayerImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImages = layers[index].images ? [...layers[index].images] : (layers[index].imageUrl ? [layers[index].imageUrl] : []);
    const remainingSlots = MAX_IMAGES_PER_PRODUCT - currentImages.length;

    if (remainingSlots <= 0) {
      onToast(`Layer #${index + 1} already has maximum ${MAX_IMAGES_PER_PRODUCT} images.`);
      return;
    }

    const filesToProcess = (Array.from(files) as File[]).slice(0, remainingSlots);
    onToast(`Optimizing and uploading ${filesToProcess.length} photo(s)...`);

    try {
      const compressedUrls: string[] = [];
      for (const file of filesToProcess) {
        const compressed = await compressImageFile(file);
        compressedUrls.push(compressed);
      }

      setLayers(prev => {
        const copy = [...prev];
        const imgs = copy[index].images ? [...copy[index].images] : (copy[index].imageUrl ? [copy[index].imageUrl] : []);
        compressedUrls.forEach(url => {
          if (imgs.length < MAX_IMAGES_PER_PRODUCT && !imgs.includes(url)) {
            imgs.push(url);
          }
        });

        copy[index] = {
          ...copy[index],
          images: imgs,
          imageUrl: imgs[0] || ''
        };
        return copy;
      });

      // Automatically fill the URL input box with the newly generated image URL
      if (compressedUrls.length > 0) {
        setUrlInputs(prev => ({
          ...prev,
          [index]: compressedUrls[compressedUrls.length - 1]
        }));
      }

      onToast(`Added ${compressedUrls.length} cloud-ready photo(s) to Layer #${index + 1}! URL auto-filled.`);
    } catch (err) {
      console.error('Image compression error:', err);
      onToast('Error processing image files. Please try again.');
    }

    // Reset input value so same files can be re-selected if needed
    e.target.value = '';
  };

  // Add image by URL to layer
  const handleAddImageUrlToLayer = (index: number, url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    const currentImages = layers[index].images ? [...layers[index].images] : (layers[index].imageUrl ? [layers[index].imageUrl] : []);
    if (currentImages.length >= MAX_IMAGES_PER_PRODUCT) {
      onToast(`Layer #${index + 1} already has maximum ${MAX_IMAGES_PER_PRODUCT} images.`);
      return;
    }

    if (currentImages.includes(cleanUrl)) {
      onToast('This image URL is already added to this layer.');
      return;
    }

    const updatedImages = [...currentImages, cleanUrl];
    setLayers(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        images: updatedImages,
        imageUrl: updatedImages[0] || ''
      };
      return copy;
    });
    onToast(`Added image (${updatedImages.length}/${MAX_IMAGES_PER_PRODUCT}) to Layer #${index + 1}!`);
  };

  // Remove a specific image from layer
  const handleRemoveLayerImage = (layerIndex: number, imgIndex: number) => {
    setLayers(prev => {
      const copy = [...prev];
      const currentImages = copy[layerIndex].images ? [...copy[layerIndex].images] : (copy[layerIndex].imageUrl ? [copy[layerIndex].imageUrl] : []);
      const newImages = currentImages.filter((_, i) => i !== imgIndex);
      copy[layerIndex] = {
        ...copy[layerIndex],
        images: newImages,
        imageUrl: newImages[0] || ''
      };
      return copy;
    });
    onToast(`Removed photo from Layer #${layerIndex + 1}.`);
  };

  // Set an image as Cover / Primary image (moves to index 0)
  const handleSetPrimaryImage = (layerIndex: number, imgIndex: number) => {
    setLayers(prev => {
      const copy = [...prev];
      const currentImages = copy[layerIndex].images ? [...copy[layerIndex].images] : (copy[layerIndex].imageUrl ? [copy[layerIndex].imageUrl] : []);
      if (imgIndex <= 0 || imgIndex >= currentImages.length) return copy;
      
      const targetImg = currentImages[imgIndex];
      const reordered = [targetImg, ...currentImages.filter((_, i) => i !== imgIndex)];
      
      copy[layerIndex] = {
        ...copy[layerIndex],
        images: reordered,
        imageUrl: reordered[0] || ''
      };
      return copy;
    });
    onToast(`Set photo #${imgIndex + 1} as Primary Cover Photo!`);
  };

  // Toggle size selection for a layer
  const handleToggleSize = (index: number, size: SizeType) => {
    const layer = layers[index];
    let newSizes: SizeType[];
    const updatedStock = { ...layer.sizeStock };

    if (layer.sizes.includes(size)) {
      if (layer.sizes.length <= 1) {
        onToast('At least one size must remain selected.');
        return;
      }
      newSizes = layer.sizes.filter(s => s !== size);
      delete updatedStock[size];
    } else {
      newSizes = [...layer.sizes, size];
      if (updatedStock[size] === undefined) {
        updatedStock[size] = '5';
      }
    }

    setLayers(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        sizes: newSizes,
        sizeStock: updatedStock
      };
      return copy;
    });
  };

  // Select standard sizes M, L, XL, XXL for a layer
  const handleSelectStandardSizesForLayer = (index: number) => {
    const standard: SizeType[] = ['M', 'L', 'XL', 'XXL'];
    setLayers(prev => {
      const copy = [...prev];
      const stock = { ...copy[index].sizeStock };
      standard.forEach(s => {
        if (!stock[s]) stock[s] = '5';
      });
      copy[index] = {
        ...copy[index],
        sizes: standard,
        sizeStock: stock
      };
      return copy;
    });
    onToast(`Selected M, L, XL, XXL for Layer #${index + 1}`);
  };

  // Update stock for size in layer
  const handleSizeStockChange = (layerIndex: number, size: SizeType, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setLayers(prev => {
      const copy = [...prev];
      const updatedStock = {
        ...copy[layerIndex].sizeStock,
        [size]: val === '' ? '' : num.toString()
      };

      // Check if total stock is 0
      const total = copy[layerIndex].sizes.reduce((acc, s) => {
        const count = parseInt(updatedStock[s] || '0') || 0;
        return acc + count;
      }, 0);

      copy[layerIndex] = {
        ...copy[layerIndex],
        sizeStock: updatedStock,
        inStock: total > 0
      };
      return copy;
    });
  };

  // Quick set uniform stock for layer
  const handleSetLayerUniformStock = (layerIndex: number, qty: number) => {
    setLayers(prev => {
      const copy = [...prev];
      const updatedStock: Partial<Record<SizeType, string>> = {};
      copy[layerIndex].sizes.forEach(s => {
        updatedStock[s] = qty.toString();
      });
      copy[layerIndex] = {
        ...copy[layerIndex],
        sizeStock: updatedStock,
        inStock: qty > 0
      };
      return copy;
    });
    onToast(`Set all sizes to ${qty} for Layer #${layerIndex + 1}`);
  };

  // Check if first product layer has valid basic info (Title and Price)
  const isFirstLayerValid = layers.length > 0 && 
    layers[0].title.trim().length > 0 && 
    parseFloat(layers[0].price) > 0;

  // Count how many layers are valid
  const validLayers = layers.filter(l => l.title.trim().length > 0 && parseFloat(l.price) > 0);
  const totalLayersCount = layers.length;

  // Validate and submit all layers
  const handleSubmitAllProducts = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFirstLayerValid) {
      onToast('Please enter at least Product Title and Offer Price in Layer #1.');
      return;
    }

    // In edit mode:
    if (isEditMode && editingProduct) {
      const l = layers[0];
      const priceNum = parseFloat(l.price);
      const origPriceNum = l.originalPrice ? parseFloat(l.originalPrice) : undefined;

      const finalSizeStock: Partial<Record<SizeType, number>> = {};
      let totalUnits = 0;
      l.sizes.forEach(s => {
        const count = parseInt(l.sizeStock[s] || '0') || 0;
        finalSizeStock[s] = count;
        totalUnits += count;
      });

      const layerImages = l.images && l.images.length > 0 ? l.images : (l.imageUrl ? [l.imageUrl] : []);
      const primaryImage = layerImages[0] || l.imageUrl || editingProduct.imageUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80';

      const updatedProduct: Product = {
        id: editingProduct.id,
        title: l.title.trim(),
        category: l.category,
        price: priceNum,
        originalPrice: origPriceNum,
        sizes: l.sizes,
        stockCount: totalUnits,
        sizeStock: finalSizeStock,
        description: l.description.trim() || `${l.title.trim()} from Yaarika Collections.`,
        fabricDetails: l.fabricDetails.trim(),
        imageUrl: primaryImage,
        images: layerImages.length > 0 ? layerImages : [primaryImage],
        inStock: l.inStock && totalUnits > 0,
        featured: l.featured,
        isNewArrival: l.isNewArrival,
        createdAt: new Date().toISOString()
      };

      setIsSubmitting(true);
      try {
        ProductStorage.updateProduct(updatedProduct);
        onToast(`Updated product "${updatedProduct.title}" successfully!`);
        onSuccess(1);
      } catch (err: any) {
        onToast(`Error updating product: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // In Multi-Layer Add Mode:
    // Gather all valid layers (or warn if any intermediate layer has title but invalid price)
    const productsToCreate: Array<Omit<Product, 'id' | 'createdAt'>> = [];

    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const layerNum = i + 1;

      // Skip completely empty non-first layers if user just left them blank
      if (i > 0 && !l.title.trim() && !l.price.trim()) {
        continue;
      }

      if (!l.title.trim()) {
        onToast(`Layer #${layerNum}: Please enter a Product Title.`);
        return;
      }

      const priceNum = parseFloat(l.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        onToast(`Layer #${layerNum}: Please enter a valid Offer Price (₹).`);
        return;
      }

      const layerImages = l.images && l.images.length > 0 ? l.images : (l.imageUrl ? [l.imageUrl] : []);
      const primaryImage = layerImages[0] || l.imageUrl.trim() || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80';

      const origPriceNum = l.originalPrice ? parseFloat(l.originalPrice) : undefined;
      const finalSizeStock: Partial<Record<SizeType, number>> = {};
      let totalUnits = 0;

      const activeSizes = l.sizes.length > 0 ? l.sizes : ['M', 'L', 'XL', 'XXL'];
      activeSizes.forEach(s => {
        const count = parseInt(l.sizeStock[s] || '0') || 0;
        finalSizeStock[s] = count;
        totalUnits += count;
      });

      productsToCreate.push({
        title: l.title.trim(),
        category: l.category,
        price: priceNum,
        originalPrice: origPriceNum,
        sizes: activeSizes,
        stockCount: totalUnits,
        sizeStock: finalSizeStock,
        description: l.description.trim() || `${l.title.trim()} from Yaarika Collections.`,
        fabricDetails: l.fabricDetails.trim(),
        imageUrl: primaryImage,
        images: layerImages.length > 0 ? layerImages : [primaryImage],
        inStock: l.inStock && totalUnits > 0,
        featured: l.featured,
        isNewArrival: l.isNewArrival
      });
    }

    if (productsToCreate.length === 0) {
      onToast('Please fill in at least 1 product layer with Title and Price.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (productsToCreate.length === 1) {
        ProductStorage.addProduct(productsToCreate[0]);
        onToast(`Added product "${productsToCreate[0].title}" to Yaarika catalog & Firestore!`);
      } else {
        const res = ProductStorage.bulkAddProducts(productsToCreate);
        onToast(`Successfully added all ${res.added} products from layers to Catalog & Firestore!`);
      }
      onSuccess(productsToCreate.length);
    } catch (err: any) {
      onToast(`Error adding products: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Info Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#D4AF37]/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4A0E17] text-[#D4AF37] flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-cinzel text-lg font-bold text-[#4A0E17]">
              {isEditMode ? 'Edit Product Details' : 'Multi-Layer Product Quick Add'}
            </h3>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
              {layers.length} / {MAX_LAYERS} Layers
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {isEditMode 
              ? 'Update the selected product specifications.'
              : 'Add up to 10 products simultaneously using layers. Fill Layer 1 to activate the "Add New Product" button.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {!isEditMode && (
            <button
              type="button"
              onClick={handleAddNewLayer}
              disabled={layers.length >= MAX_LAYERS}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              title="Add another product row / layer"
            >
              <Plus className="w-4 h-4 text-[#4A0E17]" />
              <span>+ New Layer ({layers.length}/{MAX_LAYERS})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* MULTI-LAYER CONTAINER */}
      <form onSubmit={handleSubmitAllProducts} className="space-y-4">
        
        {layers.map((layer, index) => {
          const layerNumber = index + 1;
          const isComplete = layer.title.trim() && parseFloat(layer.price) > 0;
          const isExpanded = layer.isExpanded ?? true;

          return (
            <div 
              key={layer.layerId}
              id={`product-layer-${layerNumber}`}
              className={`bg-white rounded-2xl border-2 transition-all shadow-sm overflow-hidden ${
                isComplete 
                  ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' 
                  : index === 0 
                  ? 'border-[#D4AF37]/60' 
                  : 'border-gray-200'
              }`}
            >
              {/* Layer Top Bar */}
              <div className="bg-[#FAF6F0] px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#4A0E17] text-[#D4AF37] text-xs font-bold flex items-center justify-center shadow-xs">
                    #{layerNumber}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-extrabold text-[#4A0E17] uppercase tracking-wider">
                        Layer {layerNumber} : {layer.title || 'Untitled Product'}
                      </h4>
                      {isComplete ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      )}
                    </div>
                    {layer.price && (
                      <p className="text-[11px] text-gray-500">
                        Price: <strong className="text-emerald-700 font-bold">₹{layer.price}</strong> 
                        {layer.originalPrice && <span className="line-through text-gray-400 ml-1">₹{layer.originalPrice}</span>}
                        {' | '}
                        Category: <strong className="text-gray-700">{layer.category}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Layer Control Buttons */}
                <div className="flex items-center gap-1.5">
                  {!isEditMode && layers.length < MAX_LAYERS && (
                    <button
                      type="button"
                      onClick={() => handleDuplicateLayer(index)}
                      className="p-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-800 border border-gray-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Duplicate this layer as next product"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clone</span>
                    </button>
                  )}

                  {!isEditMode && layers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLayer(index)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
                      title="Delete this layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleUpdateLayerField(index, 'isExpanded', !isExpanded)}
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    title={isExpanded ? 'Collapse Layer' : 'Expand Layer'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Layer Form Fields (Columns Grid) */}
              {isExpanded && (
                <div className="p-4 sm:p-5 space-y-4">
                  
                  {/* Row 1: Image, Title, Category */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    
                    {/* Column 1: Image Gallery & Upload (4 cols) */}
                    <div className="md:col-span-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                          1. Product Photos (Max 5 Images) *
                        </label>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          (layer.images?.length || (layer.imageUrl ? 1 : 0)) > 0
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {layer.images?.length || (layer.imageUrl ? 1 : 0)} / {MAX_IMAGES_PER_PRODUCT} Photos
                        </span>
                      </div>

                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                        {/* Thumbnails Strip (Up to 5 images) */}
                        {(() => {
                          const currentImgs = layer.images && layer.images.length > 0 
                            ? layer.images 
                            : (layer.imageUrl ? [layer.imageUrl] : []);

                          return (
                            <div>
                              {currentImgs.length > 0 ? (
                                <div className="grid grid-cols-5 gap-2">
                                  {currentImgs.map((img, imgIdx) => (
                                    <div 
                                      key={`${imgIdx}-${img.slice(0, 30)}`} 
                                      className={`relative group aspect-[3/4] bg-white rounded-lg overflow-hidden border-2 shadow-xs transition-all ${
                                        imgIdx === 0 
                                          ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/50' 
                                          : 'border-gray-200 hover:border-gray-400'
                                      }`}
                                    >
                                      <img
                                        src={img}
                                        alt={`Product view ${imgIdx + 1}`}
                                        className="w-full h-full object-cover"
                                      />

                                      {/* Cover Badge on Image 1 */}
                                      {imgIdx === 0 && (
                                        <div className="absolute top-1 left-1 bg-[#4A0E17] text-[#D4AF37] text-[8px] font-black px-1 py-0.2 rounded shadow-xs uppercase tracking-tighter">
                                          Cover
                                        </div>
                                      )}

                                      {/* Action Controls on Hover */}
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-between p-1">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLayerImage(index, imgIdx)}
                                          className="self-end p-0.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-xs"
                                          title="Remove this photo"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>

                                        {imgIdx > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handleSetPrimaryImage(index, imgIdx)}
                                            className="w-full py-0.5 bg-[#D4AF37] text-[#4A0E17] text-[8px] font-black rounded uppercase tracking-tighter hover:bg-amber-300"
                                            title="Make this the primary cover photo"
                                          >
                                            Set Cover
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}

                                  {/* Empty Slots Indicator */}
                                  {Array.from({ length: MAX_IMAGES_PER_PRODUCT - currentImgs.length }).map((_, slotIdx) => (
                                    <label
                                      key={`empty-slot-${slotIdx}`}
                                      className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 hover:border-[#D4AF37] flex flex-col items-center justify-center text-gray-400 hover:text-[#4A0E17] cursor-pointer bg-white transition-colors"
                                      title="Upload photo for this slot"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span className="text-[8px] font-bold mt-0.5">#{currentImgs.length + slotIdx + 1}</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleLayerImageUpload(index, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-4 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-white">
                                  <ImageIcon className="w-8 h-8 mb-1.5 text-gray-300" />
                                  <span className="text-xs font-bold text-gray-600">No Photos Added</span>
                                  <span className="text-[10px] text-gray-400">Add up to 5 images per product</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Upload & URL Input Controls */}
                        <div className="space-y-2 pt-1">
                          <label className="cursor-pointer w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-center shadow-xs">
                            <Upload className="w-3.5 h-3.5 text-[#4A0E17]" />
                            <span>Upload Photos (Select up to 5 files)</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleLayerImageUpload(index, e)}
                              className="hidden"
                            />
                          </label>

                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Or paste image URL..."
                              value={urlInputs[index] || ''}
                              onChange={(e) => handleUrlInputChange(index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleApplyUrlInput(index);
                                }
                              }}
                              className="flex-1 px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-[#4A0E17] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyUrlInput(index)}
                              className="px-2.5 py-1 bg-[#4A0E17] hover:bg-[#6b1422] text-[#D4AF37] text-xs font-bold rounded-lg transition-colors shrink-0"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Product Name, Category, Prices (7 cols) */}
                    <div className="md:col-span-7 space-y-3.5">
                      
                      {/* Product Title */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                          2. Product Title / Name * <span className="text-rose-600 text-[10px]">(Required)</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Kalyani Cotton Saree with Rich Zari Pallu (Navy)"
                          value={layer.title}
                          onChange={(e) => handleUpdateLayerField(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                        />
                      </div>

                      {/* Category & Pricing in 3 columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Category */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                            3. Category *
                          </label>
                          <select
                            value={layer.category}
                            onChange={(e) => handleUpdateLayerField(index, 'category', e.target.value as CategoryType)}
                            className="w-full px-2.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                          >
                            {availableCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        {/* Offer Price */}
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                            4. Offer Price (₹) * <span className="text-rose-600 text-[10px]">(Required)</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-xs font-bold text-emerald-700">₹</span>
                            <input
                              type="number"
                              required
                              placeholder="e.g. 1349"
                              value={layer.price}
                              onChange={(e) => handleUpdateLayerField(index, 'price', e.target.value)}
                              className="w-full pl-6 pr-2.5 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-extrabold text-[#4A0E17] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Original MRP */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                            5. Original MRP (₹) <span className="text-[10px] text-gray-400">(Optional)</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                            <input
                              type="number"
                              placeholder="e.g. 1499"
                              value={layer.originalPrice}
                              onChange={(e) => handleUpdateLayerField(index, 'originalPrice', e.target.value)}
                              className="w-full pl-6 pr-2.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#4A0E17] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Fabric & Short Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                            6. Fabric / Material Details
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Premium Cotton Silk with Zari Embroidery"
                            value={layer.fabricDetails}
                            onChange={(e) => handleUpdateLayerField(index, 'fabricDetails', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-1 focus:ring-[#4A0E17] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                            7. Short Description
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Elegant handcrafted festive piece with rich borders"
                            value={layer.description}
                            onChange={(e) => handleUpdateLayerField(index, 'description', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-1 focus:ring-[#4A0E17] focus:outline-none"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Row 2: Sizes & Stock Inventory */}
                  <div className="bg-amber-50/50 border border-amber-200/80 p-3.5 rounded-xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-bold text-[#4A0E17] uppercase tracking-wider flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>8. Available Sizes &amp; Stock Count *</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleSelectStandardSizesForLayer(index)}
                          className="text-[10px] text-[#4A0E17] font-bold hover:underline"
                        >
                          + Quick (M, L, XL, XXL)
                        </button>
                      </div>

                      {/* Stock batch presets */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 mr-1">Uniform Stock:</span>
                        <button
                          type="button"
                          onClick={() => handleSetLayerUniformStock(index, 5)}
                          className="px-2 py-0.5 rounded bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-amber-100"
                        >
                          5
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetLayerUniformStock(index, 10)}
                          className="px-2 py-0.5 rounded bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-amber-100"
                        >
                          10
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetLayerUniformStock(index, 0)}
                          className="px-2 py-0.5 rounded bg-rose-50 border border-rose-300 text-[10px] font-bold text-rose-800 hover:bg-rose-100"
                        >
                          0 (Out)
                        </button>
                      </div>
                    </div>

                    {/* Size Select Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {allSizesList.map(size => {
                        const isSelected = layer.sizes.includes(size);
                        return (
                          <button
                            type="button"
                            key={size}
                            onClick={() => handleToggleSize(index, size)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                              isSelected
                                ? 'bg-[#4A0E17] text-[#D4AF37] border-[#D4AF37] shadow-xs'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            <span>{size}</span>
                            {isSelected && <Check className="w-3 h-3 text-[#D4AF37]" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Stock inputs per selected size */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                      {layer.sizes.map(size => {
                        const stockVal = layer.sizeStock[size] !== undefined ? layer.sizeStock[size]! : '5';
                        const numStock = parseInt(stockVal) || 0;
                        return (
                          <div key={size} className="bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-between gap-1 shadow-xs">
                            <span className="font-bold text-[11px] text-gray-800">Size {size}:</span>
                            <input
                              type="number"
                              min="0"
                              value={stockVal}
                              onChange={(e) => handleSizeStockChange(index, size, e.target.value)}
                              className="w-12 text-center py-0.5 bg-gray-50 border border-gray-300 rounded text-xs font-bold text-gray-900 focus:ring-1 focus:ring-[#4A0E17] focus:outline-none"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Stock & Tag Options */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-amber-200/50 text-xs">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-gray-700 text-[11px]">
                          <input
                            type="checkbox"
                            checked={layer.inStock}
                            onChange={(e) => handleUpdateLayerField(index, 'inStock', e.target.checked)}
                            className="w-3.5 h-3.5 text-[#4A0E17] rounded border-gray-300"
                          />
                          <span>In Stock (WhatsApp Ordering Active)</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-gray-700 text-[11px]">
                          <input
                            type="checkbox"
                            checked={layer.isNewArrival}
                            onChange={(e) => handleUpdateLayerField(index, 'isNewArrival', e.target.checked)}
                            className="w-3.5 h-3.5 text-[#4A0E17] rounded border-gray-300"
                          />
                          <span>New Arrival Collection</span>
                        </label>
                      </div>

                      <div className="text-[11px] text-gray-600">
                        Total Stock: <strong className="text-gray-900 font-extrabold">{
                          layer.sizes.reduce((acc, s) => acc + (parseInt(layer.sizeStock[s] || '0') || 0), 0)
                        } Units</strong>
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </div>
          );
        })}

        {/* BOTTOM ACTION BUTTONS */}
        <div className="space-y-3 pt-2">
          
          {/* "+ New Layer" Button underneath the product layers (Available up to 10 products) */}
          {!isEditMode && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50/70 p-4 rounded-2xl border-2 border-dashed border-[#D4AF37]/60">
              <div>
                <h4 className="text-xs font-extrabold text-[#4A0E17] uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#D4AF37]" />
                  <span>Add Another Product Layer</span>
                </h4>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Click <strong>"New Layer"</strong> to add another row below header. You can add up to {MAX_LAYERS} products together.
                </p>
              </div>

              <button
                type="button"
                id="btn-new-layer"
                onClick={handleAddNewLayer}
                disabled={layers.length >= MAX_LAYERS}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#4A0E17] text-[#D4AF37] hover:bg-[#32080F] border border-[#D4AF37] text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>+ New Layer ({layers.length}/{MAX_LAYERS})</span>
              </button>
            </div>
          )}

          {/* MAIN "ADD NEW PRODUCT" / "SAVE ALL PRODUCTS" BUTTON */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                isFirstLayerValid ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {isFirstLayerValid ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {isEditMode 
                      ? 'Ready to update product' 
                      : `${validLayers.length} of ${totalLayersCount} Product Layer(s) Complete`}
                  </span>
                  {isFirstLayerValid && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Button Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  {isFirstLayerValid 
                    ? 'Click below to instantly save all entered products to Yaarika Catalog & Firebase Firestore.' 
                    : 'Fill at least Layer #1 Product Title and Offer Price to activate the button.'}
                </p>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="btn-add-new-product"
                disabled={!isFirstLayerValid || isSubmitting}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-cinzel text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                  isFirstLayerValid && !isSubmitting
                    ? 'gold-gradient-btn hover:shadow-xl cursor-pointer ring-2 ring-[#D4AF37]/50'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                }`}
              >
                <Flame className={`w-4 h-4 ${isFirstLayerValid ? 'text-[#4A0E17]' : 'text-gray-400'}`} />
                <span>
                  {isSubmitting 
                    ? 'Saving to Firestore...' 
                    : isEditMode 
                    ? 'Update Product in Firestore' 
                    : validLayers.length > 1 
                    ? `Add ${validLayers.length} Products to Catalog` 
                    : 'Add New Product'}
                </span>
              </button>
            </div>

          </div>

        </div>

      </form>

    </div>
  );
};
