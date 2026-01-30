const functions = require('firebase-functions');
const admin = require('firebase-admin');
const moment = require('moment');
const cors = require('cors')({origin: true});

admin.initializeApp();

// دالة إنشاء شركة عند التسجيل
exports.createCompanyOnSignup = functions.auth.user().onCreate(async (user) => {
  try {
    const db = admin.firestore();
    
    // إنشاء شركة جديدة
    const companyRef = db.collection('companies').doc();
    const companyData = {
      name: `${user.displayName || user.email}'s Company`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: user.uid,
      currency: 'EGP',
      arabic: true,
      settings: {
        invoicePrefix: 'INV',
        taxRate: 14,
        commissionRate: 5
      }
    };
    
    await companyRef.set(companyData);
    
    // إنشاء العداد الذري للفواتير
    const counterRef = companyRef.collection('counters').doc('invoice');
    await counterRef.set({
      lastNumber: 0,
      prefix: 'INV',
      year: moment().year()
    });
    
    // إنشاء الخزينة الافتراضية
    const treasuryRef = companyRef.collection('treasury').doc('main');
    await treasuryRef.set({
      name: 'الخزينة الرئيسية',
      balance: 0,
      openingBalance: 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    });
    
    // تحديث claim المستخدم
    const customClaims = {
      companyId: companyRef.id,
      role: 'admin'
    };
    
    await admin.auth().setCustomUserClaims(user.uid, customClaims);
    
    // حفظ بيانات المستخدم في Firestore
    const userRef = companyRef.collection('users').doc(user.uid);
    await userRef.set({
      email: user.email,
      displayName: user.displayName || user.email,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      commissionRate: 0
    });
    
    console.log(`Company created for user: ${user.uid}`);
    return null;
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
});

// دالة توليد رقم فاتورة ذري
exports.generateInvoiceNumber = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  const companyId = context.auth.token.companyId;
  if (!companyId) {
    throw new functions.https.HttpsError('permission-denied', 'Company ID required');
  }
  
  const db = admin.firestore();
  const counterRef = db.collection('companies').doc(companyId)
    .collection('counters').doc('invoice');
  
  try {
    const invoiceNumber = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Counter not found');
      }
      
      const counterData = counterDoc.data();
      const currentYear = moment().year();
      
      // إذا تغيرت السنة، نعيد العداد
      if (counterData.year !== currentYear) {
        const newCounter = {
          lastNumber: 1,
          prefix: counterData.prefix,
          year: currentYear
        };
        transaction.set(counterRef, newCounter);
        return `${counterData.prefix}${currentYear}0001`;
      }
      
      // زيادة العداد
      const newNumber = counterData.lastNumber + 1;
      transaction.update(counterRef, {
        lastNumber: newNumber
      });
      
      // تنسيق الرقم مع أصفار
      const formattedNumber = newNumber.toString().padStart(4, '0');
      return `${counterData.prefix}${currentYear}${formattedNumber}`;
    });
    
    return { invoiceNumber };
  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate invoice number');
  }
});

// دالة الموافقة على الطلب
exports.approveOrder = functions.firestore
  .document('companies/{companyId}/orders/{orderId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    
    // التحقق إذا تغير الحالة إلى "approved"
    if (newData.status === 'approved' && previousData.status !== 'approved') {
      const { companyId, orderId } = context.params;
      const db = admin.firestore();
      const batch = db.batch();
      
      try {
        // تحديث المخزون لكل منتج
        const orderItems = newData.items || [];
        for (const item of orderItems) {
          const productRef = db.collection('companies').doc(companyId)
            .collection('products').doc(item.productId);
          
          batch.update(productRef, {
            stock: admin.firestore.FieldValue.increment(-item.quantity)
          });
        }
        
        // إنشاء الفاتورة
        const invoiceRef = db.collection('companies').doc(companyId)
          .collection('invoices').doc();
        
        const invoiceData = {
          orderId: orderId,
          invoiceNumber: await generateInvoiceNumberInternal(db, companyId),
          customerId: newData.customerId,
          customerName: newData.customerName,
          items: newData.items,
          subtotal: newData.subtotal,
          tax: newData.tax,
          total: newData.total,
          paymentMethod: newData.paymentMethod,
          paymentStatus: newData.paymentStatus,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: newData.salesRepId || newData.createdBy,
          status: 'completed'
        };
        
        batch.set(invoiceRef, invoiceData);
        
        // تحديث الطلب برقم الفاتورة
        const orderRef = db.collection('companies').doc(companyId)
          .collection('orders').doc(orderId);
        batch.update(orderRef, {
          invoiceId: invoiceRef.id,
          invoiceNumber: invoiceData.invoiceNumber
        });
        
        // إذا كان الدفع نقدي، تحديث الخزينة
        if (newData.paymentMethod === 'cash' && newData.paymentStatus === 'paid') {
          await updateTreasuryInternal(db, companyId, 'income', newData.total, 
            `فاتورة ${invoiceData.invoiceNumber}`, orderId);
        }
        
        // حساب العمولة
        if (newData.salesRepId) {
          await calculateCommissionInternal(db, companyId, newData.salesRepId, 
            newData.total, orderId, invoiceRef.id);
        }
        
        await batch.commit();
        console.log(`Order ${orderId} approved and processed`);
      } catch (error) {
        console.error('Error approving order:', error);
        throw error;
      }
    }
    
    return null;
  });

// دالة تحديث الخزينة
exports.updateTreasury = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  const { companyId, type, amount, description, referenceId } = data;
  const db = admin.firestore();
  
  try {
    return await updateTreasuryInternal(db, companyId, type, amount, description, referenceId);
  } catch (error) {
    console.error('Error updating treasury:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update treasury');
  }
});

// دالة حساب العمولة
exports.calculateCommission = functions.firestore
  .document('companies/{companyId}/invoices/{invoiceId}')
  .onCreate(async (snap, context) => {
    const invoiceData = snap.data();
    const { companyId } = context.params;
    
    if (invoiceData.createdBy && invoiceData.total > 0) {
      const db = admin.firestore();
      
      try {
        // الحصول على نسبة عمولة المندوب
        const userRef = db.collection('companies').doc(companyId)
          .collection('users').doc(invoiceData.createdBy);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          const commissionRate = userData.commissionRate || 5; // 5% افتراضي
          const commissionAmount = (invoiceData.total * commissionRate) / 100;
          
          // حفظ العمولة
          const commissionRef = db.collection('companies').doc(companyId)
            .collection('commissions').doc();
          
          await commissionRef.set({
            userId: invoiceData.createdBy,
            userName: userData.displayName,
            invoiceId: snap.id,
            invoiceNumber: invoiceData.invoiceNumber,
            invoiceTotal: invoiceData.total,
            commissionRate: commissionRate,
            commissionAmount: commissionAmount,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            month: moment().format('YYYY-MM')
          });
          
          console.log(`Commission calculated for user ${invoiceData.createdBy}: ${commissionAmount} EGP`);
        }
      } catch (error) {
        console.error('Error calculating commission:', error);
      }
    }
    
    return null;
  });

// وظائف مساعدة داخلية
async function generateInvoiceNumberInternal(db, companyId) {
  const counterRef = db.collection('companies').doc(companyId)
    .collection('counters').doc('invoice');
  
  const counterDoc = await counterRef.get();
  const counterData = counterDoc.data();
  const currentYear = moment().year();
  
  if (counterData.year !== currentYear) {
    await counterRef.set({
      lastNumber: 1,
      prefix: counterData.prefix,
      year: currentYear
    });
    return `${counterData.prefix}${currentYear}0001`;
  }
  
  const newNumber = counterData.lastNumber + 1;
  await counterRef.update({ lastNumber: newNumber });
  
  const formattedNumber = newNumber.toString().padStart(4, '0');
  return `${counterData.prefix}${currentYear}${formattedNumber}`;
}

async function updateTreasuryInternal(db, companyId, type, amount, description, referenceId) {
  const treasuryRef = db.collection('companies').doc(companyId)
    .collection('treasury').doc('main');
  
  const transactionRef = db.collection('companies').doc(companyId)
    .collection('transactions').doc();
  
  const amountNum = parseFloat(amount);
  const transactionData = {
    type: type,
    amount: amountNum,
    description: description,
    referenceId: referenceId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system'
  };
  
  await db.runTransaction(async (transaction) => {
    const treasuryDoc = await transaction.get(treasuryRef);
    if (!treasuryDoc.exists) {
      throw new Error('Treasury not found');
    }
    
    const treasuryData = treasuryDoc.data();
    let newBalance = treasuryData.balance;
    
    if (type === 'income') {
      newBalance += amountNum;
    } else if (type === 'expense') {
      newBalance -= amountNum;
    } else if (type === 'opening') {
      newBalance = amountNum;
    }
    
    transaction.update(treasuryRef, {
      balance: newBalance,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    transactionData.balanceAfter = newBalance;
    transaction.set(transactionRef, transactionData);
  });
  
  return { success: true, transactionId: transactionRef.id };
}

async function calculateCommissionInternal(db, companyId, userId, amount, orderId, invoiceId) {
  const userRef = db.collection('companies').doc(companyId)
    .collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (userDoc.exists) {
    const userData = userDoc.data();
    const commissionRate = userData.commissionRate || 5;
    const commissionAmount = (amount * commissionRate) / 100;
    
    const commissionRef = db.collection('companies').doc(companyId)
      .collection('commissions').doc();
    
    await commissionRef.set({
      userId: userId,
      userName: userData.displayName,
      orderId: orderId,
      invoiceId: invoiceId,
      amount: amount,
      commissionRate: commissionRate,
      commissionAmount: commissionAmount,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      month: moment().format('YYYY-MM')
    });
    
    return commissionAmount;
  }
  
  return 0;
}
