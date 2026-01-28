import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()

export const createCompanyOnUserSignup = functions.auth
  .user()
  .onCreate(async (user) => {
    try {
      const { uid, email, displayName } = user

      // إنشاء معرف فريد للشركة
      const companyId = db.collection('companies').doc().id

      // إنشاء الشركة
      const companyData = {
        id: companyId,
        name: displayName || 'شركة جديدة',
        email: email,
        phone: '',
        address: '',
        logo: '',
        taxNumber: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }

      await db.collection('companies').doc(companyId).set(companyData)

      // إنشاء المستخدم وربطه بالشركة
      const userData = {
        uid,
        email,
        name: displayName || 'مدير النظام',
        phone: '',
        role: 'admin', // أول مستخدم يكون مدير
        companyId,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }

      await db.collection('users').doc(uid).set(userData)

      // إنشاء إعدادات افتراضية للشركة
      const settingsData = {
        companyId,
        currency: 'EGP',
        taxRate: 14, // الضريبة 14%
        invoicePrefix: 'INV',
        invoiceLastNumber: 0,
        lowStockAlert: 10,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }

      await db.collection('settings').doc(`${companyId}_general`).set(settingsData)

      // إنشاء خزنة افتراضية
      const treasuryData = {
        companyId,
        balance: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }

      await db.collection('treasury').doc(`${companyId}_main`).set(treasuryData)

      // إنشاء سجل الخزنة اليومية
      const today = new Date().toISOString().split('T')[0]
      const dailyTreasuryData = {
        companyId,
        date: today,
        openingBalance: 0,
        income: 0,
        expense: 0,
        closingBalance: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }

      await db.collection('treasury_daily').doc(`${companyId}_${today}`).set(dailyTreasuryData)

      console.log(`تم إنشاء شركة جديدة للمستخدم ${uid} باسم ${companyData.name}`)
    } catch (error) {
      console.error('خطأ في إنشاء الشركة تلقائيًا:', error)
      throw error
    }
  })
