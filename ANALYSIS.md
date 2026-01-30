# تقرير تحليل وتصميم نظام ERP

## 1. نظرة عامة على المشروع

نظام ERP متكامل يتكون من ثلاثة مكونات رئيسية:
1. **Backend**: Firebase Cloud Functions مع Express.js
2. **Web App**: React + TypeScript + Vite
3. **Mobile App**: Flutter مع BLoC Pattern

## 2. هيكل المشروع الكامل

```
/mnt/okcomputer/output/erp-system/
├── backend/
│   └── firebase/
│       ├── functions/
│       │   ├── package.json
│       │   ├── tsconfig.json
│       │   ├── .eslintrc.js
│       │   └── src/
│       │       ├── index.ts
│       │       ├── models/
│       │       │   ├── User.ts
│       │       │   ├── Product.ts
│       │       │   ├── Sale.ts
│       │       │   ├── Customer.ts
│       │       │   ├── Inventory.ts
│       │       │   ├── Company.ts
│       │       │   ├── POSSession.ts
│       │       │   └── SalesVisit.ts
│       │       ├── routes/
│       │       │   ├── auth.ts
│       │       │   ├── users.ts
│       │       │   ├── products.ts
│       │       │   ├── sales.ts
│       │       │   ├── customers.ts
│       │       │   ├── categories.ts
│       │       │   ├── inventory.ts
│       │       │   ├── pos.ts
│       │       │   ├── dashboard.ts
│       │       │   ├── suppliers.ts
│       │       │   ├── purchaseOrders.ts
│       │       │   ├── expenses.ts
│       │       │   ├── reports.ts
│       │       │   ├── salesVisits.ts
│       │       │   ├── branches.ts
│       │       │   ├── notifications.ts
│       │       │   ├── settings.ts
│       │       │   └── companies.ts
│       │       ├── middleware/
│       │       │   ├── auth.ts
│       │       │   ├── validation.ts
│       │       │   └── errorHandler.ts
│       │       └── utils/
│       │           ├── helpers.ts
│       │           └── logger.ts
│       ├── firebase.json
│       ├── firestore.rules
│       └── storage.rules
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── types/
│       │   └── index.ts
│       ├── services/
│       │   ├── api.ts
│       │   ├── auth.ts
│       │   ├── user.ts
│       │   ├── product.ts
│       │   ├── sale.ts
│       │   ├── customer.ts
│       │   ├── inventory.ts
│       │   ├── dashboard.ts
│       │   ├── report.ts
│       │   └── pos.ts
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useProducts.ts
│       │   ├── useSales.ts
│       │   └── useCustomers.ts
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Products.tsx
│       │   ├── Sales.tsx
│       │   ├── Customers.tsx
│       │   └── Layout.tsx
│       └── components/
├── mobile/
│   ├── pubspec.yaml
│   ├── analysis_options.yaml
│   └── lib/
│       ├── main.dart
│       ├── blocs/
│       │   ├── blocs.dart
│       │   ├── auth/
│       │   │   ├── auth_bloc.dart
│       │   │   ├── auth_event.dart
│       │   │   └── auth_state.dart
│       │   ├── dashboard/
│       │   │   ├── dashboard_bloc.dart
│       │   │   ├── dashboard_event.dart
│       │   │   └── dashboard_state.dart
│       │   ├── customer/
│       │   │   ├── customer_bloc.dart
│       │   │   ├── customer_event.dart
│       │   │   └── customer_state.dart
│       │   ├── sale/
│       │   │   ├── sale_bloc.dart
│       │   │   ├── sale_event.dart
│       │   │   └── sale_state.dart
│       │   └── visit/
│       │       ├── visit_bloc.dart
│       │       ├── visit_event.dart
│       │       └── visit_state.dart
│       ├── models/
│       │   ├── user_model.dart
│       │   ├── customer_model.dart
│       │   ├── product_model.dart
│       │   ├── sale_model.dart
│       │   ├── visit_model.dart
│       │   └── dashboard_model.dart
│       ├── repositories/
│       │   ├── auth_repository.dart
│       │   ├── customer_repository.dart
│       │   ├── sale_repository.dart
│       │   └── visit_repository.dart
│       ├── screens/
│       │   ├── screens.dart
│       │   ├── login_screen.dart
│       │   ├── main_screen.dart
│       │   ├── dashboard_screen.dart
│       │   ├── customers_screen.dart
│       │   ├── customer_details_screen.dart
│       │   ├── new_customer_screen.dart
│       │   ├── sales_screen.dart
│       │   ├── sale_details_screen.dart
│       │   ├── new_sale_screen.dart
│       │   ├── visits_screen.dart
│       │   ├── visit_details_screen.dart
│       │   ├── new_visit_screen.dart
│       │   ├── map_screen.dart
│       │   └── profile_screen.dart
│       ├── services/
│       │   ├── api_service.dart
│       │   ├── local_storage_service.dart
│       │   ├── location_service.dart
│       │   ├── notification_service.dart
│       │   └── firebase_service.dart
│       └── widgets/
│           ├── widgets.dart
│           ├── stat_card.dart
│           ├── chart_widget.dart
│           └── recent_activity_list.dart
└── README.md
```

## 3. Backend - Firebase Cloud Functions

### 3.1 الموديلات (Models)

#### User Model
```typescript
interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
  permissions: Permission[];
  phone?: string;
  address?: string;
  avatar?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type UserRole = 'admin' | 'manager' | 'sales_rep' | 'cashier' | 
                'accountant' | 'inventory_manager' | 'viewer';
```

#### Product Model
```typescript
interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  minQuantity: number;
  barcode?: string;
  images?: string[];
  isActive: boolean;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Sale Model
```typescript
interface Sale {
  id: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: SaleStatus;
  notes?: string;
  createdBy: string;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}
```

### 3.2 نقاط النهاية (API Endpoints)

#### Auth Routes
- `POST /auth/login` - تسجيل الدخول
- `POST /auth/register` - إنشاء حساب
- `POST /auth/logout` - تسجيل الخروج
- `POST /auth/refresh` - تحديث التوكن
- `POST /auth/forgot-password` - استعادة كلمة المرور
- `POST /auth/reset-password` - إعادة تعيين كلمة المرور

#### Users Routes
- `GET /users` - قائمة المستخدمين
- `GET /users/:id` - تفاصيل مستخدم
- `POST /users` - إنشاء مستخدم
- `PUT /users/:id` - تحديث مستخدم
- `DELETE /users/:id` - حذف مستخدم

#### Products Routes
- `GET /products` - قائمة المنتجات
- `GET /products/:id` - تفاصيل منتج
- `POST /products` - إنشاء منتج
- `PUT /products/:id` - تحديث منتج
- `DELETE /products/:id` - حذف منتج
- `GET /products/low-stock` - المنتجات منخفضة المخزون

#### Sales Routes
- `GET /sales` - قائمة المبيعات
- `GET /sales/:id` - تفاصيل بيع
- `POST /sales` - إنشاء بيع
- `PUT /sales/:id` - تحديث بيع
- `POST /sales/:id/cancel` - إلغاء بيع
- `GET /sales/:id/invoice` - طباعة فاتورة

#### Customers Routes
- `GET /customers` - قائمة العملاء
- `GET /customers/:id` - تفاصيل عميل
- `POST /customers` - إنشاء عميل
- `PUT /customers/:id` - تحديث عميل
- `DELETE /customers/:id` - حذف عميل
- `GET /customers/:id/sales` - مبيعات العميل

### 3.3 Middleware

#### Auth Middleware
```typescript
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### Authorization Middleware
```typescript
const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
};
```

### 3.4 Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             request.auth.token.role == 'admin';
    }
    
    function isManager() {
      return isAuthenticated() && 
             request.auth.token.role in ['admin', 'manager'];
    }
    
    function isSalesRep() {
      return isAuthenticated() && 
             request.auth.token.role == 'sales_rep';
    }
    
    function isOwner(userId) {
      return isAuthenticated() && 
             request.auth.uid == userId;
    }
    
    function belongsToCompany(companyId) {
      return isAuthenticated() && 
             request.auth.token.companyId == companyId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && 
                     belongsToCompany(resource.data.companyId);
      allow create: if isAdmin() || isManager();
      allow update: if isAdmin() || 
                       isManager() || 
                       isOwner(userId);
      allow delete: if isAdmin();
    }
    
    // Products collection
    match /products/{productId} {
      allow read: if isAuthenticated() && 
                     belongsToCompany(resource.data.companyId);
      allow create, update, delete: if isAdmin() || 
                                       isManager() || 
                                       request.auth.token.role == 'inventory_manager';
    }
    
    // Sales collection
    match /sales/{saleId} {
      allow read: if isAuthenticated() && 
                     belongsToCompany(resource.data.companyId);
      allow create: if isAuthenticated() && 
                       belongsToCompany(request.resource.data.companyId);
      allow update, delete: if isAdmin() || isManager();
    }
    
    // Customers collection
    match /customers/{customerId} {
      allow read: if isAuthenticated() && 
                     belongsToCompany(resource.data.companyId);
      allow create, update: if isAuthenticated() && 
                               belongsToCompany(request.resource.data.companyId);
      allow delete: if isAdmin() || isManager();
    }
  }
}
```

## 4. Web App - React + TypeScript

### 4.1 الهيكل التقني

| التقنية | الاستخدام |
|---------|----------|
| React 18 | إطار عمل الواجهة الأمامية |
| TypeScript | لغة البرمجة |
| Vite | أداة البناء |
| Tailwind CSS | إطار عمل CSS |
| shadcn/ui | مكونات واجهة المستخدم |
| React Query | إدارة حالة البيانات |
| Zustand | إدارة الحالة العالمية |
| Recharts | الرسوم البيانية |
| Axios | HTTP Client |
| React Router | التوجيه |

### 4.2 الخدمات (Services)

#### API Service
```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
                     'http://localhost:5001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

### 4.3 الصفحات الرئيسية

1. **Login** - صفحة تسجيل الدخول
2. **Dashboard** - لوحة التحكم الرئيسية
3. **Products** - إدارة المنتجات
4. **Sales** - إدارة المبيعات
5. **Customers** - إدارة العملاء
6. **POS** - نقطة البيع
7. **Reports** - التقارير
8. **Settings** - الإعدادات

### 4.4 المكونات الرئيسية

- `StatCard` - بطاقة إحصائيات
- `DataTable` - جدول البيانات
- `ChartWidget` - رسم بياني
- `Modal` - نافذة منبثقة
- `Sidebar` - القائمة الجانبية
- `Header` - رأس الصفحة

## 5. Mobile App - Flutter

### 5.1 الهيكل التقني

| التقنية | الاستخدام |
|---------|----------|
| Flutter 3.0 | إطار عمل الموبايل |
| Dart 3.0 | لغة البرمجة |
| BLoC Pattern | إدارة الحالة |
| Dio | HTTP Client |
| Hive | التخزين المحلي |
| Google Maps | الخرائط |
| Geolocator | تحديد الموقع |
| Firebase Messaging | الإشعارات |
| Flutter Local Notifications | الإشعارات المحلية |
| Intl | التعريب |
| Equatable | المقارنة |
| JsonSerializable | JSON Serialization |

### 5.2 BLoC Pattern

#### Auth BLoC
```dart
// Events
abstract class AuthEvent {}
class LoginRequested extends AuthEvent {
  final String email;
  final String password;
  LoginRequested(this.email, this.password);
}

// States
abstract class AuthState {}
class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthAuthenticated extends AuthState {
  final User user;
  AuthAuthenticated(this.user);
}
class AuthError extends AuthState {
  final String message;
  AuthError(this.message);
}

// BLoC
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository authRepository;
  
  AuthBloc({required this.authRepository}) : super(AuthInitial()) {
    on<LoginRequested>(_onLoginRequested);
  }
  
  Future<void> _onLoginRequested(
    LoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      final user = await authRepository.login(
        event.email, 
        event.password,
      );
      emit(AuthAuthenticated(user));
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }
}
```

### 5.3 الشاشات الرئيسية

1. **LoginScreen** - شاشة تسجيل الدخول
2. **MainScreen** - الشاشة الرئيسية مع Bottom Navigation
3. **DashboardScreen** - لوحة التحكم
4. **CustomersScreen** - قائمة العملاء
5. **CustomerDetailsScreen** - تفاصيل العميل
6. **NewCustomerScreen** - إضافة عميل جديد
7. **SalesScreen** - قائمة المبيعات
8. **SaleDetailsScreen** - تفاصيل البيع
9. **NewSaleScreen** - إنشاء بيع جديد
10. **VisitsScreen** - قائمة الزيارات
11. **VisitDetailsScreen** - تفاصيل الزيارة
12. **NewVisitScreen** - جدولة زيارة جديدة
13. **MapScreen** - خريطة الزيارات
14. **ProfileScreen** - الملف الشخصي

### 5.4 المميزات الرئيسية

#### العمل بدون إنترنت (Offline Support)
```dart
class LocalStorageService {
  late Box<Sale> _salesBox;
  late Box<Visit> _visitsBox;
  
  Future<void> init() async {
    await Hive.initFlutter();
    _salesBox = await Hive.openBox<Sale>('sales');
    _visitsBox = await Hive.openBox<Visit>('visits');
  }
  
  Future<void> savePendingSale(Sale sale) async {
    await _salesBox.put(sale.id, sale);
  }
  
  List<Sale> getPendingSales() {
    return _salesBox.values.toList();
  }
  
  Future<void> removePendingSale(String id) async {
    await _salesBox.delete(id);
  }
}
```

#### تتبع الموقع الجغرافي
```dart
class LocationService {
  Stream<Position> getPositionStream() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    );
  }
  
  Future<Position> getCurrentPosition() async {
    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }
}
```

## 6. الأمان

### 6.1 المصادقة
- JWT Tokens
- Refresh Tokens
- Token Expiration
- Secure Storage

### 6.2 التفويض
- Role-Based Access Control (RBAC)
- Company-based Isolation
- Resource-level Permissions

### 6.3 البيانات
- Input Validation (Joi)
- SQL Injection Prevention
- XSS Protection
- Encryption at Rest

## 7. الأداء

### 7.1 Backend
- Pagination
- Caching
- Connection Pooling
- Indexing

### 7.2 Web
- Lazy Loading
- Code Splitting
- Image Optimization
- Service Workers

### 7.3 Mobile
- Lazy Loading Lists
- Image Caching
- Local Data Persistence
- Background Sync

## 8. التكاملات

### 8.1 Firebase
- Authentication
- Cloud Functions
- Firestore
- Storage
- Messaging
- Analytics

### 8.2 Google Maps
- Maps SDK
- Geocoding
- Directions API
- Places API

### 8.3 Payment Gateways
- Stripe
- PayPal
- Local Payment Methods

## 9. التوثيق

### 9.1 API Documentation
- Swagger/OpenAPI
- Postman Collection
- Code Examples

### 9.2 User Documentation
- User Guides
- Video Tutorials
- FAQ

### 9.3 Developer Documentation
- Architecture Diagrams
- Code Comments
- Setup Guides

## 10. الخطة المستقبلية

### 10.1 المميزات المخططة
- [ ] Multi-tenancy
- [ ] Advanced Analytics
- [ ] AI-powered Recommendations
- [ ] Voice Commands
- [ ] Biometric Authentication
- [ ] Blockchain Integration

### 10.2 التحسينات
- [ ] Performance Optimization
- [ ] UI/UX Improvements
- [ ] Accessibility
- [ ] Localization
- [ ] Testing Coverage

---

**ملاحظة**: هذا التقرير يوفر نظرة شاملة على النظام. للحصول على تفاصيل أكثر عن أي جزء، يرجى الرجوع إلى الكود المصدري.
