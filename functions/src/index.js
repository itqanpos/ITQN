const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp();

const db = admin.firestore();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 1. Cloud Function عند أول تسجيل مستخدم
exports.createCompanyOnUserSignup = functions.auth.user().onCreate(async (user) => {
  try {
    const { uid, email, displayName } = user;

    // التحقق إذا كان هذا أول مستخدم في النظام
    const usersSnapshot = await db.collection('users').get();
    const isFirstUser = usersSnapshot.empty;

    if (isFirstUser) {
      // إنشاء شركة جديدة
      const companyRef = db.collection('companies').doc();
      const companyId = companyRef.id;

      const companyData = {
        id: companyId,
        name: displayName || 'شركة جديدة',
        email: email,
        phone: '',
        address: '',
        city: '',
        country: 'مصر',
        logo: '',
        taxNumber: '',
        currency: 'EGP',
        vatRate: 14,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await companyRef.set(companyData);

      // حفظ بيانات المستخدم
      const userData = {
        uid,
        email,
        name: displayName || 'مدير النظام',
        phone: '',
        role: 'admin',
        companyId,
        isActive: true,
        permissions: ['all'],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('users').doc(uid).set(userData);

      // إنشاء الإعدادات الافتراضية
      const settingsRef = db.collection('settings').doc(`${companyId}_invoice_counter`);
      await settingsRef.set({
        companyId,
        lastNumber: 0,
        year: new Date().getFullYear(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // إنشاء خزنة افتراضية
      const treasuryRef = db.collection('treasury').doc(`${companyId}_main`);
      await treasuryRef.set({
        companyId,
        name: 'الخزنة الرئيسية',
        balance: 0,
        openingBalance: 0,
        isMain: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // إنشاء سجل الخزنة اليومية
      const today = new Date().toISOString().split('T')[0];
      const dailyTreasuryRef = db.collection('treasury_daily').doc(`${companyId}_${today}`);
      await dailyTreasuryRef.set({
        companyId,
        date: today,
        openingBalance: 0,
        income: 0,
        expense: 0,
        closingBalance: 0,
        isClosed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ تم إنشاء شركة جديدة: ${companyData.name}`);
      return { success: true, companyId };
    } else {
      // إذا كان المستخدم غير أول مستخدم، نرفض التسجيل
      await admin.auth().deleteUser(uid);
      throw new Error('يجب أن تتم إضافة المستخدمين الجدد من قبل مدير النظام');
    }
  } catch (error) {
    console.error('❌ خطأ في إنشاء الشركة:', error);
    throw error;
  }
});

// 2. Cloud Function Atomic لعداد الفواتير
exports.generateInvoiceNumber = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول أولاً'
    );
  }

  const { companyId } = data;
  if (!companyId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'معرف الشركة مطلوب'
    );
  }

  const settingsRef = db.collection('settings').doc(`${companyId}_invoice_counter`);

  try {
    const invoiceNumber = await db.runTransaction(async (transaction) => {
      const settingsDoc = await transaction.get(settingsRef);
      
      let lastNumber = 0;
      const currentYear = new Date().getFullYear();
      
      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        if (data.year === currentYear) {
          lastNumber = data.lastNumber || 0;
        } else {
          lastNumber = 0;
        }
      }
      
      const newNumber = lastNumber + 1;
      
      transaction.set(settingsRef, {
        companyId,
        lastNumber: newNumber,
        year: currentYear,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      return `INV-${currentYear}-${newNumber.toString().padStart(6, '0')}`;
    });

    return { invoiceNumber };
  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw new functions.https.HttpsError(
      'internal',
      'فشل في توليد رقم الفاتورة'
    );
  }
});

// 3. تحديث الخزنة اليومية عند كل بيع
exports.updateDailyTreasuryOnSale = functions.firestore
  .document('sales/{saleId}')
  .onCreate(async (snapshot, context) => {
    try {
      const sale = snapshot.data();
      const { companyId, total, paymentMethod, createdAt } = sale;

      if (!companyId || !total) {
        console.log('بيانات البيع غير كاملة');
        return;
      }

      const saleDate = createdAt.toDate();
      const dateStr = saleDate.toISOString().split('T')[0];

      const dailyTreasuryRef = db.collection('treasury_daily')
        .doc(`${companyId}_${dateStr}`);

      await db.runTransaction(async (transaction) => {
        const dailyDoc = await transaction.get(dailyTreasuryRef);

        if (!dailyDoc.exists) {
          // إنشاء سجل جديد للخزنة اليومية
          const newDailyData = {
            companyId,
            date: dateStr,
            openingBalance: 0,
            income: total,
            expense: 0,
            closingBalance: total,
            isClosed: false,
            salesCount: 1,
            salesTotal: total,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          transaction.set(dailyTreasuryRef, newDailyData);
        } else {
          const dailyData = dailyDoc.data();
          const newIncome = (dailyData.income || 0) + total;
          const newClosing = (dailyData.closingBalance || 0) + total;
          const salesCount = (dailyData.salesCount || 0) + 1;
          const salesTotal = (dailyData.salesTotal || 0) + total;

          transaction.update(dailyTreasuryRef, {
            income: newIncome,
            closingBalance: newClosing,
            salesCount,
            salesTotal,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // تحديث رصيد الخزنة الرئيسي
        if (paymentMethod === 'cash') {
          const mainTreasuryRef = db.collection('treasury')
            .doc(`${companyId}_main`);
          const mainDoc = await transaction.get(mainTreasuryRef);

          if (mainDoc.exists) {
            const currentBalance = mainDoc.data().balance || 0;
            transaction.update(mainTreasuryRef, {
              balance: currentBalance + total,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      });

      console.log(`✅ تم تحديث الخزنة اليومية للفاتورة ${sale.invoiceNumber}`);
    } catch (error) {
      console.error('❌ خطأ في تحديث الخزنة:', error);
      throw error;
    }
  });

// 4. معالجة طلبات المندوبين المعلقة
exports.approvePendingOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول أولاً'
    );
  }

  const { orderId, companyId } = data;

  // التحقق من أن المستخدم مدير
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData || userData.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'فقط المدير يمكنه اعتماد الطلبات'
    );
  }

  try {
    const orderRef = db.collection('pending_orders').doc(orderId);
    
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      
      if (!orderDoc.exists) {
        throw new Error('الطلب غير موجود');
      }
      
      const order = orderDoc.data();
      
      if (order.status !== 'pending') {
        throw new Error('الطلب ليس في حالة معلقة');
      }
      
      // 1. تحديث حالة الطلب إلى معتمد
      transaction.update(orderRef, {
        status: 'approved',
        approvedBy: context.auth.uid,
        approvedByName: userData.name,
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 2. إنشاء فاتورة مبيعات
      const saleRef = db.collection('sales').doc();
      
      // توليد رقم فاتورة
      const invoiceSettingsRef = db.collection('settings').doc(`${companyId}_invoice_counter`);
      const invoiceSettingsDoc = await transaction.get(invoiceSettingsRef);
      let invoiceNumber = 0;
      const currentYear = new Date().getFullYear();
      
      if (invoiceSettingsDoc.exists) {
        const data = invoiceSettingsDoc.data();
        if (data.year === currentYear) {
          invoiceNumber = data.lastNumber + 1;
        } else {
          invoiceNumber = 1;
        }
      } else {
        invoiceNumber = 1;
      }
      
      const finalInvoiceNumber = `INV-${currentYear}-${invoiceNumber.toString().padStart(6, '0')}`;
      
      // تحديث عداد الفواتير
      transaction.set(invoiceSettingsRef, {
        companyId,
        lastNumber: invoiceNumber,
        year: currentYear,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      // بيانات الفاتورة
      const saleData = {
        invoiceNumber: finalInvoiceNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        userId: order.userId,
        userName: order.userName,
        companyId: order.companyId,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        tax: order.tax,
        total: order.total,
        paymentMethod: order.paymentMethod,
        status: 'completed',
        pendingOrderId: orderId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      transaction.set(saleRef, saleData);
      
      // 3. تحديث المخزون لكل منتج
      for (const item of order.items) {
        const productRef = db.collection('products').doc(item.productId);
        transaction.update(productRef, {
          stock: admin.firestore.FieldValue.increment(-item.quantity),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // تسجيل حركة المخزون
        const logRef = db.collection('inventoryLogs').doc();
        transaction.set(logRef, {
          productId: item.productId,
          productName: item.productName,
          type: 'sale',
          quantity: -item.quantity,
          reference: finalInvoiceNumber,
          userId: order.userId,
          userName: order.userName,
          companyId: order.companyId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // 4. تحديث الخزنة اليومية
      const today = new Date().toISOString().split('T')[0];
      const dailyTreasuryRef = db.collection('treasury_daily')
        .doc(`${companyId}_${today}`);
        
      const dailyDoc = await transaction.get(dailyTreasuryRef);
      
      if (dailyDoc.exists) {
        const dailyData = dailyDoc.data();
        const newIncome = (dailyData.income || 0) + order.total;
        const newClosing = (dailyData.closingBalance || 0) + order.total;
        
        transaction.update(dailyTreasuryRef, {
          income: newIncome,
          closingBalance: newClosing,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // 5. حساب عمولة المندوب (5% من إجمالي البيع)
      const commissionRate = 0.05; // 5%
      const commissionAmount = order.total * commissionRate;
      
      const commissionRef = db.collection('commissions').doc();
      transaction.set(commissionRef, {
        userId: order.userId,
        userName: order.userName,
        saleId: saleRef.id,
        invoiceNumber: finalInvoiceNumber,
        saleAmount: order.total,
        commissionRate: commissionRate * 100, // كنسبة مئوية
        commissionAmount,
        companyId: order.companyId,
        isPaid: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    return { success: true, message: 'تم اعتماد الطلب بنجاح' };
  } catch (error) {
    console.error('Error approving order:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'فشل في اعتماد الطلب'
    );
  }
});

exports.rejectPendingOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول أولاً'
    );
  }

  const { orderId, reason } = data;

  // التحقق من أن المستخدم مدير
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData || userData.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'فقط المدير يمكنه رفض الطلبات'
    );
  }

  try {
    const orderRef = db.collection('pending_orders').doc(orderId);
    
    await orderRef.update({
      status: 'rejected',
      rejectedBy: context.auth.uid,
      rejectedByName: userData.name,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectionReason: reason || 'تم الرفض من قبل المدير'
    });
    
    return { success: true, message: 'تم رفض الطلب بنجاح' };
  } catch (error) {
    console.error('Error rejecting order:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'فشل في رفض الطلب'
    );
  }
});

// Express API endpoint (اختياري)
app.get('/api/stats/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId;
    
    // يمكن إضافة منطق الإحصائيات هنا
    
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

exports.api = functions.https.onRequest(app);
