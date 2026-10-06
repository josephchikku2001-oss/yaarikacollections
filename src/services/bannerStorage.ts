import { HeroSlide } from '../types';
import bannerSareesDesigner from '../assets/images/banner_kerala_sarees_designer_1787042820901.jpg';
import bannerCoordsFusion from '../assets/images/banner_contemporary_coords_1787042768365.jpg';
import bannerSareesChuridar from '../assets/images/banner_traditional_sarees_churidar_1787042789127.jpg';
import bannerKasavuFestive from '../assets/images/banner_kerala_kasavu_festive_1787042845226.jpg';

export const BANNERS_UPDATED_EVENT = 'yaarika_banners_updated';
const BANNER_STORAGE_KEY = 'yaarika_hero_banners_v1';

export const DEFAULT_BANNERS: HeroSlide[] = [
  {
    id: 'sarees-designer',
    title: 'Traditional Kerala Sarees & Designer Wear',
    subtitle: 'Handcrafted Tissue Kasavu weaves, Kanjeevaram silk & celebratory drape collections.',
    category: 'Traditional Sarees',
    image: bannerSareesDesigner,
    badge: 'Heritage Collection',
    themeColor: '#4A0E17',
    linkText: 'Shop More'
  },
  {
    id: 'coords-fusion',
    title: 'Contemporary Co-ord Sets & Fusion Wear',
    subtitle: 'Modern tunic & palazzo sets, breathable silhouette designs tailored for everyday and festive grace.',
    category: 'Co-ord Sets',
    image: bannerCoordsFusion,
    badge: 'Modern Silhouettes',
    themeColor: '#1B4D3E',
    linkText: 'Shop More'
  },
  {
    id: 'sarees-churidar',
    title: 'Traditional Sarees and Churidar Sets',
    subtitle: 'Exquisite handloom sarees paired with embellished blue silk and banarasi churidar ensembles.',
    category: 'Churidar Sets',
    image: bannerSareesChuridar,
    badge: 'Festive Ensembles',
    themeColor: '#1A365D',
    linkText: 'Shop More'
  },
  {
    id: 'kasavu-festive',
    title: 'Handcrafted Kerala Kasavu & Festive Wear',
    subtitle: 'Pure Kasavu golden weaves & heritage Kerala bridal attire with All Kerala Free Shipping.',
    category: 'Traditional Sarees',
    badge: 'Pure Kasavu',
    image: bannerKasavuFestive,
    themeColor: '#6B1D2F',
    linkText: 'Shop More'
  }
];

export const BannerStorage = {
  getBanners(): HeroSlide[] {
    try {
      if (typeof window === 'undefined') return DEFAULT_BANNERS;
      const stored = localStorage.getItem(BANNER_STORAGE_KEY);
      if (!stored) {
        // Initialize with default banners
        this.saveBanners(DEFAULT_BANNERS);
        return DEFAULT_BANNERS;
      }
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return DEFAULT_BANNERS;
    } catch (e) {
      console.warn('Failed to load hero banners from localStorage:', e);
      return DEFAULT_BANNERS;
    }
  },

  saveBanners(banners: HeroSlide[]): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(BANNER_STORAGE_KEY, JSON.stringify(banners));
        window.dispatchEvent(new CustomEvent(BANNERS_UPDATED_EVENT, { detail: banners }));
      }
    } catch (e) {
      console.warn('Failed to save hero banners to localStorage:', e);
    }
  },

  addBanner(banner: Omit<HeroSlide, 'id'> & { id?: string }): HeroSlide {
    const banners = this.getBanners();
    const newSlide: HeroSlide = {
      ...banner,
      id: banner.id || `banner-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      themeColor: banner.themeColor || '#4A0E17',
      linkText: banner.linkText || 'Shop More'
    };
    const updated = [newSlide, ...banners];
    this.saveBanners(updated);
    return newSlide;
  },

  deleteBanner(id: string): boolean {
    const banners = this.getBanners();
    const filtered = banners.filter(b => b.id !== id);
    if (filtered.length !== banners.length) {
      this.saveBanners(filtered);
      return true;
    }
    return false;
  },

  updateBanner(id: string, updates: Partial<HeroSlide>): boolean {
    const banners = this.getBanners();
    const index = banners.findIndex(b => b.id === id);
    if (index !== -1) {
      banners[index] = { ...banners[index], ...updates };
      this.saveBanners(banners);
      return true;
    }
    return false;
  },

  moveBanner(fromIndex: number, toIndex: number): void {
    const banners = this.getBanners();
    if (fromIndex < 0 || fromIndex >= banners.length || toIndex < 0 || toIndex >= banners.length) {
      return;
    }
    const [moved] = banners.splice(fromIndex, 1);
    banners.splice(toIndex, 0, moved);
    this.saveBanners(banners);
  },

  resetToDefaults(): HeroSlide[] {
    this.saveBanners(DEFAULT_BANNERS);
    return DEFAULT_BANNERS;
  }
};
