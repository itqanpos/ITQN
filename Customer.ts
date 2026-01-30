export interface Customer {
  id: string;
  code?: string;
  companyId: string;
  branchId?: string;
  
  // Personal Info
  firstName: string;
  lastName: string;
  displayName: string;
  email?: string;
  phone: string;
  phone2?: string;
  
  // Type
  type: CustomerType;
  
  // Company Info (for B2B)
  companyName?: string;
  taxNumber?: string;
  commercialRegistration?: string;
  
  // Address
  address?: Address;
  shippingAddresses?: Address[];
  
  // Location
  location?: {
    lat: number;
    lng: number;
  };
  
  // Classification
  category?: string;
  tags?: string[];
  
  // Credit
  creditLimit: number;
  currentBalance: number;
  paymentTerms?: number;
  
  // Statistics
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  averageOrderValue: number;
  
  // Status
  status: CustomerStatus;
  isActive: boolean;
  isVip: boolean;
  
  // Notes
  notes?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface Address {
  id?: string;
  name?: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isDefault?: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export type CustomerType = 'individual' | 'company';

export type CustomerStatus = 'active' | 'inactive' | 'blocked';

export interface CustomerCategory {
  id: string;
  name: string;
  description?: string;
  discountPercentage: number;
  creditLimit: number;
  paymentTerms: number;
  companyId: string;
  isActive: boolean;
}

export interface CreateCustomerDTO {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  phone2?: string;
  type?: CustomerType;
  companyName?: string;
  taxNumber?: string;
  commercialRegistration?: string;
  address?: Address;
  category?: string;
  tags?: string[];
  creditLimit?: number;
  paymentTerms?: number;
  notes?: string;
}

export interface UpdateCustomerDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  type?: CustomerType;
  companyName?: string;
  taxNumber?: string;
  commercialRegistration?: string;
  address?: Address;
  shippingAddresses?: Address[];
  category?: string;
  tags?: string[];
  creditLimit?: number;
  paymentTerms?: number;
  status?: CustomerStatus;
  isActive?: boolean;
  isVip?: boolean;
  notes?: string;
}

export interface CustomerFilter {
  companyId?: string;
  branchId?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  category?: string;
  isVip?: boolean;
  hasBalance?: boolean;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  openingBalance: number;
  closingBalance: number;
  totalSales: number;
  totalPayments: number;
  totalReturns: number;
  transactions: CustomerTransaction[];
}

export interface CustomerTransaction {
  id: string;
  date: Date;
  type: 'sale' | 'payment' | 'return' | 'adjustment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  totalReceivables: number;
  averageCustomerValue: number;
  topCustomers: Customer[];
}
