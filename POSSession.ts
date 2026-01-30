export interface POSSession {
  id: string;
  companyId: string;
  branchId: string;
  
  // Cashier
  cashierId: string;
  cashierName: string;
  
  // Register
  registerId: string;
  registerName: string;
  
  // Timing
  openedAt: Date;
  closedAt?: Date;
  
  // Cash
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  
  // Sales Summary
  totalSales: number;
  totalTransactions: number;
  totalRefunds: number;
  totalDiscounts: number;
  
  // Payment Methods
  paymentsByMethod: {
    method: string;
    amount: number;
    count: number;
  }[];
  
  // Status
  status: SessionStatus;
  
  // Notes
  openingNotes?: string;
  closingNotes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type SessionStatus = 'open' | 'closed' | 'paused';

export interface POSRegister {
  id: string;
  companyId: string;
  branchId: string;
  
  name: string;
  code: string;
  
  // Device
  deviceId?: string;
  deviceName?: string;
  
  // Printer
  receiptPrinter?: string;
  labelPrinter?: string;
  
  // Settings
  settings: RegisterSettings;
  
  // Status
  isActive: boolean;
  currentSessionId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterSettings {
  printReceiptAutomatically: boolean;
  openCashDrawerOnSale: boolean;
  requireCustomerForSale: boolean;
  allowCreditSales: boolean;
  allowReturns: boolean;
  receiptTemplate: string;
  barcodeScannerEnabled: boolean;
  scaleEnabled: boolean;
}

export interface QuickProduct {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  sellingPrice: number;
  image?: string;
  categoryId: string;
  sortOrder: number;
}

export interface CreateSessionDTO {
  registerId: string;
  openingCash: number;
  openingNotes?: string;
}

export interface CloseSessionDTO {
  closingCash: number;
  closingNotes?: string;
}

export interface SessionReport {
  sessionId: string;
  cashierName: string;
  registerName: string;
  openedAt: Date;
  closedAt?: Date;
  duration: number;
  
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  
  salesSummary: {
    totalSales: number;
    totalTransactions: number;
    averageTransaction: number;
    totalItems: number;
    totalDiscounts: number;
    totalTax: number;
  };
  
  refunds: {
    count: number;
    amount: number;
  };
  
  paymentsByMethod: {
    method: string;
    amount: number;
    count: number;
  }[];
  
  topProducts: {
    productId: string;
    productName: string;
    quantity: number;
    total: number;
  }[];
}
