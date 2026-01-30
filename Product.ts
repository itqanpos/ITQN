export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
  subcategoryId?: string;
  companyId: string;
  branchId?: string;
  
  // Pricing
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  specialPrice?: number;
  currency: string;
  
  // Inventory
  quantity: number;
  minQuantity: number;
  maxQuantity?: number;
  reorderPoint?: number;
  
  // Units
  unit: string;
  unitCost?: number;
  conversionRate?: number;
  
  // Dimensions
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  
  // Images
  images: string[];
  thumbnail?: string;
  
  // Tax
  taxRate: number;
  isTaxable: boolean;
  
  // Status
  status: ProductStatus;
  isActive: boolean;
  isFeatured: boolean;
  
  // Metadata
  brand?: string;
  manufacturer?: string;
  origin?: string;
  
  // Tracking
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  
  // Variants
  hasVariants: boolean;
  variants?: ProductVariant[];
  
  // Attributes
  attributes?: ProductAttribute[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  options: { [key: string]: string };
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  images?: string[];
  isActive: boolean;
}

export interface ProductAttribute {
  name: string;
  value: string;
  displayType?: 'text' | 'color' | 'image';
}

export type ProductStatus = 'active' | 'inactive' | 'discontinued' | 'out_of_stock';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDTO {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
  subcategoryId?: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  specialPrice?: number;
  currency?: string;
  quantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  reorderPoint?: number;
  unit: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  images?: string[];
  taxRate?: number;
  isTaxable?: boolean;
  brand?: string;
  manufacturer?: string;
  origin?: string;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  categoryId?: string;
  subcategoryId?: string;
  costPrice?: number;
  sellingPrice?: number;
  wholesalePrice?: number;
  specialPrice?: number;
  quantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  reorderPoint?: number;
  unit?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  images?: string[];
  taxRate?: number;
  isTaxable?: boolean;
  status?: ProductStatus;
  isActive?: boolean;
  isFeatured?: boolean;
  brand?: string;
  manufacturer?: string;
  origin?: string;
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
}

export interface ProductFilter {
  companyId?: string;
  branchId?: string;
  categoryId?: string;
  status?: ProductStatus;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  lowStock?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ProductResponse {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category: {
    id: string;
    name: string;
  };
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  quantity: number;
  minQuantity: number;
  unit: string;
  images: string[];
  thumbnail?: string;
  status: ProductStatus;
  isActive: boolean;
  brand?: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  companyId: string;
  branchId: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer' | 'return';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reference?: string;
  referenceType?: 'sale' | 'purchase' | 'adjustment' | 'transfer' | 'return';
  referenceId?: string;
  notes?: string;
  cost?: number;
  createdAt: Date;
  createdBy: string;
}

export interface StockAdjustment {
  productId: string;
  quantity: number;
  reason: string;
  notes?: string;
}
