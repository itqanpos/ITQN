export interface SalesVisit {
  id: string;
  companyId: string;
  
  // Sales Rep
  salesRepId: string;
  salesRepName: string;
  
  // Customer
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  
  // Visit Details
  visitDate: Date;
  visitType: VisitType;
  
  // Location
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  
  // Status
  status: VisitStatus;
  
  // Purpose
  purpose?: string;
  
  // Notes
  notes?: string;
  outcome?: string;
  
  // Order
  orderCreated: boolean;
  orderId?: string;
  orderAmount?: number;
  
  // Check-in/Check-out
  checkInAt?: Date;
  checkInLocation?: {
    lat: number;
    lng: number;
  };
  checkOutAt?: Date;
  checkOutLocation?: {
    lat: number;
    lng: number;
  };
  
  // Duration
  duration?: number;
  
  // Photos
  photos?: string[];
  
  // Signature
  customerSignature?: string;
  
  // Reminder
  reminderDate?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type VisitType = 'scheduled' | 'unscheduled' | 'follow_up' | 'demo' | 'delivery' | 'collection';

export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';

export interface SalesRoute {
  id: string;
  companyId: string;
  salesRepId: string;
  salesRepName: string;
  
  name: string;
  description?: string;
  
  // Schedule
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  
  // Customers
  customers: RouteCustomer[];
  
  // Status
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteCustomer {
  customerId: string;
  customerName: string;
  address?: string;
  location?: {
    lat: number;
    lng: number;
  };
  sortOrder: number;
  estimatedDuration?: number;
}

export interface CreateSalesVisitDTO {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  visitDate: Date;
  visitType: VisitType;
  purpose?: string;
  notes?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  reminderDate?: Date;
}

export interface UpdateSalesVisitDTO {
  visitDate?: Date;
  visitType?: VisitType;
  status?: VisitStatus;
  purpose?: string;
  notes?: string;
  outcome?: string;
  orderCreated?: boolean;
  orderId?: string;
  orderAmount?: number;
  reminderDate?: Date;
}

export interface CheckInDTO {
  location: {
    lat: number;
    lng: number;
  };
  notes?: string;
}

export interface CheckOutDTO {
  location: {
    lat: number;
    lng: number;
  };
  outcome?: string;
  notes?: string;
  orderId?: string;
  orderAmount?: number;
}

export interface SalesVisitFilter {
  companyId?: string;
  salesRepId?: string;
  customerId?: string;
  status?: VisitStatus;
  visitType?: VisitType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface SalesRepPerformance {
  salesRepId: string;
  salesRepName: string;
  
  period: {
    start: Date;
    end: Date;
  };
  
  visits: {
    total: number;
    completed: number;
    cancelled: number;
    averageDuration: number;
  };
  
  orders: {
    count: number;
    totalAmount: number;
    conversionRate: number;
  };
  
  customers: {
    new: number;
    visited: number;
  };
  
  route: {
    totalDistance: number;
    locations: number;
  };
}
