export interface User {
  id: string;
  email: string;
  password?: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
  branchId?: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
  preferences?: UserPreferences;
}

export type UserRole = 
  | 'admin' 
  | 'manager' 
  | 'sales_rep' 
  | 'cashier' 
  | 'accountant' 
  | 'inventory_manager' 
  | 'viewer';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'export' | 'import')[];
}

export interface UserPreferences {
  language: 'ar' | 'en';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  dashboardLayout?: string;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  companyId: string;
  branchId?: string;
  permissions?: Permission[];
}

export interface UpdateUserDTO {
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  role?: UserRole;
  status?: UserStatus;
  branchId?: string;
  permissions?: Permission[];
  preferences?: Partial<UserPreferences>;
}

export interface UserLoginDTO {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
  branchId?: string;
  permissions: Permission[];
  createdAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
}

export const USER_ROLES: Record<UserRole, { label: string; description: string }> = {
  admin: {
    label: 'مدير النظام',
    description: 'صلاحيات كاملة على النظام'
  },
  manager: {
    label: 'مدير',
    description: 'إدارة جميع العمليات'
  },
  sales_rep: {
    label: 'مندوب مبيعات',
    description: 'إدارة العملاء والمبيعات'
  },
  cashier: {
    label: 'أمين صندوق',
    description: 'إدارة نقاط البيع والمدفوعات'
  },
  accountant: {
    label: 'محاسب',
    description: 'إدارة الحسابات والتقارير المالية'
  },
  inventory_manager: {
    label: 'مدير المخزون',
    description: 'إدارة المخزون والمنتجات'
  },
  viewer: {
    label: 'مشاهد',
    description: 'عرض فقط'
  }
};

export const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete', 'export', 'import'] }
  ],
  manager: [
    { resource: 'products', actions: ['create', 'read', 'update', 'delete', 'export', 'import'] },
    { resource: 'customers', actions: ['create', 'read', 'update', 'delete', 'export', 'import'] },
    { resource: 'sales', actions: ['create', 'read', 'update', 'delete', 'export'] },
    { resource: 'inventory', actions: ['create', 'read', 'update', 'export'] },
    { resource: 'reports', actions: ['read', 'export'] },
    { resource: 'users', actions: ['read'] }
  ],
  sales_rep: [
    { resource: 'products', actions: ['read'] },
    { resource: 'customers', actions: ['create', 'read', 'update'] },
    { resource: 'sales', actions: ['create', 'read', 'update'] },
    { resource: 'salesVisits', actions: ['create', 'read', 'update'] }
  ],
  cashier: [
    { resource: 'products', actions: ['read'] },
    { resource: 'customers', actions: ['read'] },
    { resource: 'sales', actions: ['create', 'read'] },
    { resource: 'pos', actions: ['create', 'read'] }
  ],
  accountant: [
    { resource: 'sales', actions: ['read', 'export'] },
    { resource: 'expenses', actions: ['create', 'read', 'update', 'delete', 'export'] },
    { resource: 'reports', actions: ['read', 'export'] },
    { resource: 'payments', actions: ['create', 'read', 'update', 'export'] }
  ],
  inventory_manager: [
    { resource: 'products', actions: ['create', 'read', 'update', 'delete', 'export', 'import'] },
    { resource: 'inventory', actions: ['create', 'read', 'update', 'export', 'import'] },
    { resource: 'purchaseOrders', actions: ['create', 'read', 'update', 'delete', 'export'] },
    { resource: 'suppliers', actions: ['create', 'read', 'update', 'delete', 'export'] }
  ],
  viewer: [
    { resource: 'products', actions: ['read'] },
    { resource: 'customers', actions: ['read'] },
    { resource: 'sales', actions: ['read'] },
    { resource: 'reports', actions: ['read'] }
  ]
};
