export type CategoryType = 
  | 'All' 
  | 'Traditional Sarees' 
  | 'Co-ord Sets' 
  | 'Churidar Sets' 
  | 'Fusion Wear' 
  | 'New Arrivals';

export type SizeType = 'Free Size' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL';

export interface Product {
  id: string;
  title: string;
  category: CategoryType;
  price: number;
  originalPrice?: number;
  sizes: SizeType[];
  stockCount?: number; // Total units in inventory
  sizeStock?: Partial<Record<SizeType, number>>; // Specific stock count per size (e.g., M: 10, L: 5, XL: 0, XXL: 2)
  description: string;
  imageUrl: string;
  images?: string[]; // Up to 5 images per product
  fabricDetails?: string;
  inStock: boolean;
  featured?: boolean;
  isNewArrival?: boolean;
  createdAt: string;
}

export interface AdminCredentials {
  username: string;
  passwordHash: string; // Stored securely in localStorage
  isSetupComplete: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface InquiryLog {
  id: string;
  productId: string;
  productTitle: string;
  selectedSize: string;
  phoneContact: string;
  timestamp: string;
}

export type ViewMode = 'catalog' | 'admin' | 'wishlist' | 'product-detail';

export type SortOption = 'featured' | 'price_low_high' | 'price_high_low' | 'newest';

export type PriceRangeOption = 'all' | 'under_1000' | '1000_2000' | '2000_3500' | 'above_3500';

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  category: CategoryType;
  image: string;
  badge: string;
  themeColor?: string;
  linkText?: string;
}
