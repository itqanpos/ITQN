# نظام ERP المتكامل

نظام ERP متكامل يتكون من ثلاثة أجزاء رئيسية:

## 1. Backend (Firebase Cloud Functions)

Backend قوي مبني على Firebase Cloud Functions مع:
- REST API كامل
- مصادقة JWT
- Firestore Database
- Firebase Storage
- Firebase Messaging للإشعارات

### المميزات:
- إدارة المستخدمين والصلاحيات (RBAC)
- إدارة المنتجات والمخزون
- إدارة المبيعات والفواتير
- إدارة العملاء
- إدارة المشتريات
- إدارة المصروفات
- تقارير شاملة
- نظام POS كامل
- تتبع مندوبي المبيعات

## 2. Web App (React + TypeScript + Vite)

تطبيق ويب حديث لإدارة النظام يشمل:
- لوحة تحكم تفاعلية
- إدارة المنتجات
- إدارة المبيعات
- إدارة العملاء
- نقطة البيع (POS)
- التقارير والإحصائيات

## 3. Mobile App (Flutter)

تطبيق موبايل لمندوبي المبيعات يشمل:
- تسجيل الدخول
- لوحة تحكم شخصية
- إدارة العملاء
- إنشاء المبيعات
- جدولة الزيارات
- تتبع الموقع الجغرافي
- خريطة الزيارات
- العمل بدون إنترنت (Offline)

---

## هيكل المشروع

```
erp-system/
├── backend/
│   └── firebase/
│       ├── functions/
│       │   └── src/
│       │       ├── models/
│       │       ├── routes/
│       │       ├── middleware/
│       │       └── utils/
│       ├── firestore.rules
│       └── storage.rules
├── web/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       └── types/
└── mobile/
    └── lib/
        ├── blocs/
        ├── models/
        ├── repositories/
        ├── screens/
        ├── services/
        └── widgets/
```

---

## متطلبات التشغيل

### Backend:
- Node.js 18+
- Firebase CLI
- حساب Firebase

### Web:
- Node.js 18+
- npm أو yarn

### Mobile:
- Flutter 3.0+
- Dart 3.0+
- Android Studio / Xcode

---

## التثبيت والتشغيل

### Backend:

```bash
cd backend/firebase/functions
npm install
firebase login
firebase deploy
```

### Web:

```bash
cd web
npm install
npm run dev
```

### Mobile:

```bash
cd mobile
flutter pub get
flutter run
```

---

## المتغيرات البيئية

### Backend (.env):

```
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=your-encryption-key
```

### Web (.env):

```
VITE_API_URL=http://localhost:5001/your-project/us-central1/api
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Mobile:

قم بتحديث ملف `android/app/google-services.json` و `ios/Runner/GoogleService-Info.plist`

---

## الأدوار والصلاحيات

| الدور | الصلاحيات |
|-------|----------|
| admin | جميع الصلاحيات |
| manager | إدارة المستخدمين، المنتجات، المبيعات، التقارير |
| sales_rep | المبيعات، العملاء، الزيارات |
| cashier | نقطة البيع، المبيعات |
| accountant | التقارير المالية، المصروفات |
| inventory_manager | إدارة المخزون، المنتجات |
| viewer | عرض التقارير فقط |

---

## المميزات الرئيسية

### Backend:
- ✅ REST API كامل
- ✅ مصادقة JWT
- ✅ Firestore Security Rules
- ✅ Role-Based Access Control
- ✅ Validation
- ✅ Error Handling
- ✅ Logging
- ✅ Notifications

### Web:
- ✅ React 18
- ✅ TypeScript
- ✅ Vite
- ✅ Tailwind CSS
- ✅ shadcn/ui
- ✅ React Query
- ✅ Zustand
- ✅ Recharts

### Mobile:
- ✅ Flutter 3.0
- ✅ BLoC Pattern
- ✅ Offline Support
- ✅ Google Maps
- ✅ Location Tracking
- ✅ Push Notifications
- ✅ Local Storage

---

## الترخيص

هذا المشروع مرخص بموجب MIT License.

---

## الدعم

للدعم والاستفسارات، يرجى التواصل عبر:
- البريد الإلكتروني: support@erp-system.com
- الهاتف: +966 50 000 0000
