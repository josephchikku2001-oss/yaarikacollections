// Firebase functionality removed.
import { Product, InquiryLog } from '../types';
import { User } from 'firebase/auth'; // Keep Type definition if needed or create local interface

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  firestoreDatabaseId?: string;
  measurementId?: string;
}

export function getSavedFirebaseConfig(): FirebaseConfig | null {
  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig): void {}

export function removeFirebaseConfig(): void {}

export function isFirebaseConfigured(): boolean {
  return false;
}

// Global initialized instances
export const app = null;
export const db = null;
export const auth = null;

export function getFirebaseApp(): any { return null; }
export function getFirebaseAuth(): any { return null; }
export function getFirebaseFirestore(): any { return null; }

// Validate connection
export async function testConnection(): Promise<boolean> {
  return false;
}

// Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  throw new Error("Firebase functionality removed.");
}

// FIRESTORE PRODUCT SERVICE
export const FirestoreProductService = {
  async fetchProducts(): Promise<Product[]> {
    return [];
  },
  async saveProduct(product: Product): Promise<void> {},
  async deleteProduct(productId: string): Promise<void> {},
  async clearAllProductsFromFirestore(): Promise<number> { return 0; },
  async syncAllToFirestore(products: Product[]): Promise<number> { return 0; },
  subscribeToProducts(onUpdate: (products: Product[]) => void, onError?: (err: Error) => void): (() => void) {
    return () => {};
  },
  async logInquiry(inquiry: InquiryLog): Promise<void> {}
};

// FIREBASE AUTH SERVICE
export const FirebaseAuthService = {
  async signIn(email: string, pass: string): Promise<{ success: boolean; user?: any; error?: string }> {
    return { success: false, error: "Authentication removed." };
  },
  async signUpAdmin(email: string, pass: string): Promise<{ success: boolean; user?: any; error?: string }> {
    return { success: false, error: "Authentication removed." };
  },
  async signOut(): Promise<void> {},
  onAuthChange(callback: (user: any | null) => void): (() => void) {
    return () => {};
  },
  getCurrentUser(): any | null {
    return null;
  }
};
