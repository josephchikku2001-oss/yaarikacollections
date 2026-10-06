import { Product, SizeType } from '../types';

/**
 * Calculates the total units in stock for a given product.
 */
export function getProductTotalStock(product: Product): number {
  if (!product.inStock) return 0;

  if (product.sizeStock && Object.keys(product.sizeStock).length > 0) {
    const total = Object.values(product.sizeStock).reduce((acc, count) => acc + (Number(count) || 0), 0);
    return Math.max(0, total);
  }

  if (product.stockCount !== undefined && product.stockCount !== null) {
    return Math.max(0, Number(product.stockCount));
  }

  return product.inStock ? 5 : 0;
}

/**
 * Returns the stock count for a specific size of a product.
 */
export function getSizeStockCount(product: Product, size: SizeType): number {
  if (!product.inStock) return 0;

  if (product.sizeStock && product.sizeStock[size] !== undefined && product.sizeStock[size] !== null) {
    return Math.max(0, Number(product.sizeStock[size]));
  }

  if (product.stockCount !== undefined && product.stockCount !== null) {
    return Math.max(0, Number(product.stockCount));
  }

  return product.inStock ? 5 : 0;
}

/**
 * Checks if a product is in stock overall, or for a specific selected size.
 */
export function isProductInStock(product: Product, selectedSize?: SizeType): boolean {
  if (product.inStock === false) return false;

  // If size is selected and has specific stock tracked
  if (selectedSize && product.sizeStock && product.sizeStock[selectedSize] !== undefined && product.sizeStock[selectedSize] !== null) {
    const sizeQty = Number(product.sizeStock[selectedSize]);
    if (!isNaN(sizeQty)) {
      return sizeQty > 0;
    }
  }

  // If sizeStock is defined for all sizes, check if at least one size is > 0
  if (product.sizeStock && Object.keys(product.sizeStock).length > 0) {
    const total = Object.values(product.sizeStock).reduce((acc, count) => acc + (Number(count) || 0), 0);
    if (total > 0) return true;
    // If all sizeStock numbers were 0 but admin marked inStock: true, honor inStock flag
    return Boolean(product.inStock);
  }

  // If product.stockCount is explicitly set
  if (product.stockCount !== undefined && product.stockCount !== null) {
    const count = Number(product.stockCount);
    if (!isNaN(count) && count > 0) return true;
  }

  return Boolean(product.inStock);
}

/**
 * Checks if a specific size of a product is available in stock.
 */
export function isSizeInStock(product: Product, size: SizeType): boolean {
  if (product.inStock === false) return false;
  if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(size)) return false;

  if (product.sizeStock && product.sizeStock[size] !== undefined && product.sizeStock[size] !== null) {
    const qty = Number(product.sizeStock[size]);
    if (!isNaN(qty)) {
      return qty > 0;
    }
  }

  if (product.stockCount !== undefined && product.stockCount !== null) {
    const count = Number(product.stockCount);
    if (!isNaN(count)) {
      return count > 0;
    }
  }

  return Boolean(product.inStock);
}
