import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  RefreshCw, 
  Layers, 
  Check, 
  AlertTriangle,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { HeroSlide, CategoryType } from '../types';
import { BannerStorage } from '../services/bannerStorage';
import { compressImageFile } from '../utils/imageCompressor';

interface BannerSliderManagerProps {
  onToast: (msg: string) => void;
}

const CATEGORY_OPTIONS: CategoryType[] = [
  'All',
  'Traditional Sarees',
  'Co-ord Sets',
  'Churidar Sets',
  'Fusion Wear',
  'New Arrivals'
];

const PRESET_THEME_COLORS = [
  { name: 'Royal Maroon', hex: '#4A0E17' },
  { name: 'Emerald Green', hex: '#1B4D3E' },
  { name: 'Navy Blue', hex: '#1A365D' },
  { name: 'Deep Wine', hex: '#6B1D2F' },
  { name: 'Warm Gold', hex: '#8C6D1F' }
];

export const BannerSliderManager: React.FC<BannerSliderManagerProps> = ({ onToast }) => {
  const [banners, setBanners] = useState<HeroSlide[]>(() => BannerStorage.getBanners());
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [category, setCategory] = useState<CategoryType>('Traditional Sarees');
  const [badge, setBadge] = useState<string>('Heritage Collection');
  const [themeColor, setThemeColor] = useState<string>('#4A0E17');
  const [image, setImage] = useState<string>('');
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const refreshBanners = () => {
    setBanners(BannerStorage.getBanners());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    try {
      setIsProcessingImage(true);
      setFormError('');
      // Compress for high-definition banner display
      const compressedDataUrl = await compressImageFile(file, 1600, 1000, 0.85);
      setImage(compressedDataUrl);
      setImageUrlInput('');
    } catch (err) {
      console.error('Error compressing banner image:', err);
      setFormError('Failed to process image. Please try another image.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleApplyUrl = () => {
    if (!imageUrlInput.trim()) return;
    setImage(imageUrlInput.trim());
    setFormError('');
  };

  const handleAddBanner = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setFormError('Please enter a banner title.');
      return;
    }

    if (!image.trim()) {
      setFormError('Please upload a banner image or enter an image URL.');
      return;
    }

    try {
      BannerStorage.addBanner({
        title: title.trim(),
        subtitle: subtitle.trim() || 'Exclusive handcrafted collection with all Kerala free shipping.',
        category,
        badge: badge.trim() || 'Special Collection',
        themeColor,
        image: image.trim(),
        linkText: 'Shop More'
      });

      refreshBanners();
      onToast('✨ New Hero Banner Slide added successfully!');

      // Reset form
      setTitle('');
      setSubtitle('');
      setImage('');
      setImageUrlInput('');
      setBadge('Heritage Collection');
      setFormError('');
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to add banner slide:', err);
      setFormError('Failed to save banner slide. Please try again.');
    }
  };

  const handleDeleteBanner = (id: string) => {
    BannerStorage.deleteBanner(id);
    refreshBanners();
    setDeleteCandidateId(null);
    onToast('🗑️ Banner slide removed.');
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    BannerStorage.moveBanner(index, index - 1);
    refreshBanners();
    onToast('Slide order updated.');
  };

  const handleMoveDown = (index: number) => {
    if (index >= banners.length - 1) return;
    BannerStorage.moveBanner(index, index + 1);
    refreshBanners();
    onToast('Slide order updated.');
  };

  const handleResetDefaults = () => {
    if (window.confirm('Restore original 4 default slides? Any custom slides will be replaced with defaults.')) {
      BannerStorage.resetToDefaults();
      refreshBanners();
      onToast('🔄 Reset to default slides complete.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Quick Action Bar */}
      <div className="bg-gradient-to-r from-[#4A0E17] to-[#2B050B] text-white p-5 rounded-2xl shadow-md border border-[#D4AF37]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-cinzel text-lg font-bold text-[#F3E5AB]">
              Top Hero Slider Manager (മുകൾഭാഗത്തെ സ്ലൈഡർ)
            </h3>
          </div>
          <p className="text-xs text-white/80 mt-1">
            Manage the editorial banner slider that auto-scrolls right-to-left at the top of the homepage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white/90 border border-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Reset slider back to original default banners"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-1.5 gold-gradient-btn text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isAdding ? 'Close Form' : 'Add New Slide'}</span>
          </button>
        </div>
      </div>

      {/* Add New Slide Form Accordion */}
      {isAdding && (
        <form onSubmit={handleAddBanner} className="bg-white p-5 sm:p-6 rounded-2xl shadow-lg border-2 border-[#D4AF37]/50 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h4 className="font-cinzel text-base font-bold text-[#4A0E17] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>Add New Slide Banner (പുതിയ സ്ലൈഡ് ചേർക്കുക)</span>
            </h4>
            <span className="text-xs text-gray-500">Appears immediately in top slider</span>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column: Image Upload */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Slide Banner Photo *
              </label>

              {image ? (
                <div className="space-y-2">
                  <div className="relative aspect-[16/10] rounded-xl overflow-hidden border-2 border-[#D4AF37] bg-gray-100 shadow-inner group">
                    <img 
                      src={image} 
                      alt="Banner Preview" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded-full shadow-md transition-all"
                      title="Remove Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Image ready for banner slide</span>
                  </p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#D4AF37]/60 hover:border-[#D4AF37] rounded-xl p-5 text-center bg-amber-50/30 transition-all">
                  <div className="w-12 h-12 rounded-full bg-[#4A0E17]/10 text-[#4A0E17] flex items-center justify-center mx-auto mb-2">
                    <ImageIcon className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">
                    Upload Banner Photo from Device
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
                    Landscape format recommended (16:9 or 16:10)
                  </p>

                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A0E17] hover:bg-[#32080F] text-[#D4AF37] text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessingImage ? 'Optimizing Image...' : 'Choose Image File'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      disabled={isProcessingImage}
                    />
                  </label>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1.5">Or paste public image URL</p>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyUrl}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Slide Details */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Slide Headline / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Festival Kasavu Weaves &amp; Royal Bridal Drapes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Subtitle / Narrative Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Handloom Kasavu sets paired with pure golden zari work and complimentary shipping across Kerala."
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Target Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37] bg-white font-medium"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pure Kasavu"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37] font-medium"
                  />
                </div>
              </div>

              {/* Theme Color Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Accent Theme
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_THEME_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setThemeColor(preset.hex)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
                        themeColor === preset.hex 
                          ? 'border-black ring-2 ring-[#D4AF37] text-white' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                      style={{ backgroundColor: themeColor === preset.hex ? preset.hex : undefined }}
                    >
                      <span 
                        className="w-2.5 h-2.5 rounded-full border border-black/20" 
                        style={{ backgroundColor: preset.hex }} 
                      />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 gold-gradient-btn text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Slide to Hero Slider (സ്ലൈഡറിലേക്ക് ചേർക്കുക)</span>
            </button>
          </div>
        </form>
      )}

      {/* Active Slides List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-cinzel text-sm font-bold text-[#4A0E17] uppercase tracking-wider">
              Current Slider Slides ({banners.length})
            </h4>
            <span className="text-[11px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
              Auto-scrolls every 5s
            </span>
          </div>
          <span className="text-[11px] text-gray-500">
            Use arrows to rearrange order
          </span>
        </div>

        {banners.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-300 text-center space-y-3">
            <Sliders className="w-10 h-10 text-gray-400 mx-auto" />
            <h5 className="font-cinzel text-sm font-bold text-gray-700">No Slides in Hero Slider</h5>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You have removed all slides. Click &ldquo;Add New Slide&rdquo; above or &ldquo;Reset Defaults&rdquo; to restore the original showcase banners.
            </p>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-4 py-2 bg-[#4A0E17] text-[#D4AF37] text-xs font-bold rounded-lg shadow"
            >
              Restore Default Slides
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((banner, index) => (
              <div 
                key={banner.id} 
                className="bg-white p-4 rounded-2xl border border-[#D4AF37]/30 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left: Thumbnail & Position Badge */}
                <div className="flex items-center gap-3.5 w-full md:w-auto">
                  <div className="relative w-28 sm:w-36 aspect-[16/10] rounded-xl overflow-hidden border border-[#D4AF37]/40 bg-gray-100 shrink-0 shadow-sm">
                    <img 
                      src={banner.image} 
                      alt={banner.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=300';
                      }}
                    />
                    <div className="absolute top-1 left-1 bg-[#4A0E17]/90 text-[#D4AF37] text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Middle: Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {banner.badge && (
                        <span className="text-[10px] font-bold bg-[#4A0E17]/10 text-[#4A0E17] px-2 py-0.5 rounded-full">
                          {banner.badge}
                        </span>
                      )}
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        {banner.category}
                      </span>
                      {banner.themeColor && (
                        <span 
                          className="w-3 h-3 rounded-full border border-black/20" 
                          style={{ backgroundColor: banner.themeColor }}
                          title={`Theme: ${banner.themeColor}`}
                        />
                      )}
                    </div>

                    <h5 className="font-cinzel text-sm sm:text-base font-bold text-[#2B221E] truncate">
                      {banner.title}
                    </h5>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                      {banner.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {/* Move Up Button */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Move Slide Earlier"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  {/* Move Down Button */}
                  <button
                    type="button"
                    disabled={index === banners.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Move Slide Later"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeleteCandidateId(banner.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition-all"
                    title="Delete Slide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteCandidateId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="font-cinzel text-base font-bold text-gray-900">Delete Slide Banner?</h4>
              <p className="text-xs text-gray-600 mt-1">
                This slide will be permanently removed from the top hero slider.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidateId(null)}
                className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBanner(deleteCandidateId)}
                className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
