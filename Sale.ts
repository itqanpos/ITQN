export interface Sale {
  id: string;
  invoiceNumber: string;
  companyId: string;
  branchId: string;
  
  // Customer
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  
  // Sales Rep
  salesRepId: string;
  salesRepName: string;
  
  // Items
  items: SaleItem[];
  
  // Pricing
  subtotal: number;
  discountAmount: number;
  discountPercentage: number;
  taxAmount: number;
  taxRate: number;
  shippingCost: number;
  total: number;
  currency: string;
  
  // Payment
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  remainingAmount: number;
  payments: Payment[];
  
  // Status
  status: SaleStatus;
  
  // Delivery
  deliveryStatus?: DeliveryStatus;
  deliveryDate?: Date;
  deliveryAddress?: Address;
  
  // Notes
  notes?: string;
  internalNotes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // POS
  isPosSale: boolean;
  posSessionId?: string;
  receiptNumber?: string;
  
  // Source
  source: 'pos' | 'web' | 'mobile' | 'manual';
  
  // Refund
  isRefunded: boolean;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  
  // Metadata
  metadata?: { [key: string]: any };
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId?: string;
  variantName?: string;
  
  quantity: number;
  unitPrice: number;
  costPrice: number;
  
  discountAmount: number;
  discountPercentage: number;
  
  taxRate: number;
  taxAmount: number;
  
  total: number;
  
  // Return
  returnedQuantity?: number;
  isReturned: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export type SaleStatus = 
  | 'draft' 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overpaid' | 'refunded';

export type PaymentMethod = 
  | 'cash' 
  | 'credit_card' 
  | 'debit_card' 
  | 'bank_transfer' 
  | 'check' 
  | 'installment' 
  | 'credit' 
  | 'other';

export type DeliveryStatus = 'pending' | 'processing' | 'shipped' | 'in_transit' | 'delivered' | 'returned';

export interface CreateSaleDTO {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: CreateSaleItemDTO[];
  discountAmount?: number;
  discountPercentage?: number;
  taxRate?: number;
  shippingCost?: number;
  paymentMethod: PaymentMethod;
  paidAmount?: number;
  notes?: string;
  internalNotes?: string;
  deliveryAddress?: Address;
  isPosSale?: boolean;
  posSessionId?: string;
  source?: 'pos' | 'web' | 'mobile' | 'manual';
}

export interface CreateSaleItemDTO {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
  discountAmount?: number;
  discountPercentage?: number;
}

export interface UpdateSaleDTO {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items?: UpdateSaleItemDTO[];
  discountAmount?: number;
  discountPercentage?: number;
  taxRate?: number;
  shippingCost?: number;
  paymentMethod?: PaymentMethod;
  paidAmount?: number;
  notes?: string;
  internalNotes?: string;
  status?: SaleStatus;
  deliveryStatus?: DeliveryStatus;
}

export interface UpdateSaleItemDTO {
  id?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
}

export interface SaleFilter {
  companyId?: string;
  branchId?: string;
  customerId?: string;
  salesRepId?: string;
  status?: SaleStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  isPosSale?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SaleSummary {
  totalSales: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  averageOrderValue: number;
  totalItems: number;
}

export interface DailySalesReport {
  date: string;
  totalSales: number;
  totalAmount: number;
  totalItems: number;
  averageOrderValue: number;
}

export interface RefundRequest {
  saleId: string;
  items?: {
    itemId: string;
    quantity: number;
  }[];
  amount?: number;
  reason: string;
  notes?: string;
}
