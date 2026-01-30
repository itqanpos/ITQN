export interface Inventory {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  companyId: string;
  branchId: string;
  
  // Quantities
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  
  // Thresholds
  minQuantity: number;
  maxQuantity?: number;
  reorderPoint: number;
  reorderQuantity?: number;
  
  // Locations
  locations?: InventoryLocation[];
  
  // Tracking
  lastMovementAt?: Date;
  lastCountAt?: Date;
  
  // Valuation
  averageCost: number;
  totalValue: number;
  
  // Status
  status: InventoryStatus;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryLocation {
  locationId: string;
  locationName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock';

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  companyId: string;
  branchId: string;
  
  // Transaction Details
  type: InventoryTransactionType;
  quantity: number;
  
  // Before/After
  previousQuantity: number;
  newQuantity: number;
  
  // Reference
  reference?: string;
  referenceType: 'sale' | 'purchase' | 'adjustment' | 'transfer' | 'return' | 'opening' | 'damage' | 'expiry';
  referenceId?: string;
  
  // Cost
  unitCost?: number;
  totalCost?: number;
  
  // Notes
  notes?: string;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  createdByName: string;
}

export type InventoryTransactionType = 'in' | 'out' | 'adjustment' | 'transfer_in' | 'transfer_out';

export interface StockTransfer {
  id: string;
  companyId: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  
  items: StockTransferItem[];
  
  status: TransferStatus;
  
  notes?: string;
  
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  
  requestedAt: Date;
  approvedAt?: Date;
  shippedAt?: Date;
  receivedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransferItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  shippedQuantity?: number;
  receivedQuantity?: number;
  notes?: string;
}

export type TransferStatus = 'draft' | 'pending' | 'approved' | 'shipped' | 'received' | 'cancelled';

export interface StockCount {
  id: string;
  companyId: string;
  branchId: string;
  
  name: string;
  description?: string;
  
  status: StockCountStatus;
  
  items: StockCountItem[];
  
  totalItems: number;
  countedItems: number;
  varianceItems: number;
  totalVariance: number;
  
  startedAt?: Date;
  completedAt?: Date;
  
  createdBy: string;
  createdByName: string;
  completedBy?: string;
  completedByName?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface StockCountItem {
  productId: string;
  productName: string;
  productSku: string;
  systemQuantity: number;
  countedQuantity?: number;
  variance?: number;
  varianceValue?: number;
  notes?: string;
  countedAt?: Date;
  countedBy?: string;
}

export type StockCountStatus = 'draft' | 'in_progress' | 'completed' | 'adjusted';

export interface CreateStockAdjustmentDTO {
  productId: string;
  branchId: string;
  quantity: number;
  reason: string;
  notes?: string;
  reference?: string;
}

export interface CreateStockTransferDTO {
  fromBranchId: string;
  toBranchId: string;
  items: {
    productId: string;
    quantity: number;
    notes?: string;
  }[];
  notes?: string;
}

export interface CreateStockCountDTO {
  branchId: string;
  name: string;
  description?: string;
  productIds?: string[];
  categoryId?: string;
}

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  companyId: string;
  branchId: string;
  
  type: 'low_stock' | 'out_of_stock' | 'overstock';
  currentQuantity: number;
  threshold: number;
  
  isRead: boolean;
  isResolved: boolean;
  
  createdAt: Date;
  resolvedAt?: Date;
}

export interface InventoryValuation {
  totalValue: number;
  totalQuantity: number;
  averageCost: number;
  byCategory: {
    categoryId: string;
    categoryName: string;
    value: number;
    quantity: number;
  }[];
  byBranch: {
    branchId: string;
    branchName: string;
    value: number;
    quantity: number;
  }[];
}
