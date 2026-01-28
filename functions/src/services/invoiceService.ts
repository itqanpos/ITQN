import * as admin from 'firebase-admin'

const db = admin.firestore()

export const generateInvoiceNumber = async (companyId: string): Promise<string> => {
  const settingsRef = db.collection('settings').doc(`${companyId}_general`)

  try {
    // استخدام المعاملة لضمان الذرية
    const invoiceNumber = await db.runTransaction(async (transaction) => {
      const settingsDoc = await transaction.get(settingsRef)

      if (!settingsDoc.exists) {
        throw new Error('إعدادات الشركة غير موجودة')
      }

      const settings = settingsDoc.data()
      const lastNumber = settings?.invoiceLastNumber || 0
      const newNumber = lastNumber + 1
      const prefix = settings?.invoicePrefix || 'INV'
      const year = new Date().getFullYear()

      // تحديث العداد
      transaction.update(settingsRef, {
        invoiceLastNumber: newNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })

      return `${prefix}-${year}-${newNumber.toString().padStart(6, '0')}`
    })

    return invoiceNumber
  } catch (error) {
    console.error('خطأ في توليد رقم الفاتورة:', error)
    throw error
  }
}
