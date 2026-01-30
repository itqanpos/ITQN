export interface Company {
  id: string;
  name: string;
  legalName?: string;
  
  // Registration
  commercialRegistration?: string;
  taxNumber?: string;
  vatNumber?: string;
  
  // Contact
  email: string;
  phone: string;
  phone2?: string;
  fax?: string;
  website?: string;
  
  // Address
  address: CompanyAddress;
  
  // Logo
  logo?: string;
  
  // Currency
  defaultCurrency: string;
  supportedCurrencies: string[];
  
  // Fiscal
  fiscalYearStart: number;
  fiscalYearEnd: number;
  
  // Settings
  settings: CompanySettings;
  
  // Subscription
  subscription: SubscriptionInfo;
  
  // Status
  status: CompanyStatus;
  isActive: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CompanyAddress {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface CompanySettings {
  // General
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  
  // Numbers
  decimalPlaces: number;
  decimalSeparator: string;
  thousandsSeparator: string;
  
  // Products
  productCodePrefix?: string;
  barcodeFormat?: string;
  
  // Sales
  invoicePrefix: string;
  invoiceStartNumber: number;
  defaultTaxRate: number;
  allowCreditSales: boolean;
  
  // Inventory
  inventoryMethod: 'fifo' | 'lifo' | 'average';
  negativeStock: boolean;
  
  // Notifications
  notifications: {
    lowStock: boolean;
    newOrder: boolean;
    paymentReceived: boolean;
    dailyReport: boolean;
  };
  
  // Receipt
  receipt: {
    header?: string;
    footer?: string;
    showLogo: boolean;
    showBarcode: boolean;
  };
}

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  maxUsers: number;
  maxBranches: number;
  maxProducts: number;
  features: string[];
}

export type SubscriptionPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'cancelled' | 'suspended';

export type CompanyStatus = 'active' | 'trial' | 'suspended' | 'cancelled';

export interface Branch {
  id: string;
  companyId: string;
  
  name: string;
  code: string;
  
  // Contact
  email?: string;
  phone?: string;
  
  // Address
  address?: CompanyAddress;
  location?: {
    lat: number;
    lng: number;
  };
  
  // Settings
  isMainBranch: boolean;
  isActive: boolean;
  
  // Receipt
  receiptPrefix?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCompanyDTO {
  name: string;
  legalName?: string;
  commercialRegistration?: string;
  taxNumber?: string;
  vatNumber?: string;
  email: string;
  phone: string;
  address: CompanyAddress;
  defaultCurrency?: string;
}

export interface UpdateCompanyDTO {
  name?: string;
  legalName?: string;
  commercialRegistration?: string;
  taxNumber?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  fax?: string;
  website?: string;
  address?: CompanyAddress;
  logo?: string;
  defaultCurrency?: string;
  settings?: Partial<CompanySettings>;
}

export interface CreateBranchDTO {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: CompanyAddress;
  location?: {
    lat: number;
    lng: number;
  };
  isMainBranch?: boolean;
  receiptPrefix?: string;
}

export interface UpdateBranchDTO {
  name?: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: CompanyAddress;
  location?: {
    lat: number;
    lng: number;
  };
  isActive?: boolean;
  receiptPrefix?: string;
}
