import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()

export const processPendingOrder = functions.firestore
  .document('pending_orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()

    // إذا تغيرت الحالة من pending إلى approved
    if (before.status === 'pending' && after.status === 'approved') {
      try {
        const orderId = context.params.orderId
        const order = after

        // 1. توليد رقم فاتورة
        const invoiceNumber = await generateInvoiceNumber(order.companyId)

        // 2. إنشاء الفاتورة في مجموعة sales
        const saleData = {
          ...order,
          invoiceNumber,
          status: 'completed',
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          approvedBy: order.approvedBy,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }

        await db.collection('sales').doc(orderId).set(saleData)

        // 3. خصم المخزون
        const batch = db.batch()
        for (const item of order.items) {
          const productRef = db.collection('products').doc(item.productId)
          batch.update(productRef, {
            stock: admin.firestore.FieldValue.increment(-item.quantity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })

          // تسجيل حركة المخزون
          const logRef = db.collection('inventoryLogs').doc()
          batch.set(logRef, {
            productId: item.productId,
            productName: item.productName,
            type: 'sale',
            quantity: -item.quantity,
            reference: invoiceNumber,
            userId: order.userId,
            userName: order.userName,
            companyId: order.companyId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          })
        }
        await batch.commit()

        // 4. حساب عمولة المندوب إذا كان هناك عمولة
        const commissionRate = 5 // 5% عمولة - يمكن جلبها من إعدادات الشركة
        const commissionAmount = order.total * commissionRate / 100

        const commissionRef = db.collection('commissions').doc()
        await commissionRef.set({
          userId: order.userId,
          userName: order.userName,
          saleId: orderId,
          invoiceNumber,
          saleAmount: order.total,
          commissionRate,
          commissionAmount,
          companyId: order.companyId,
          isPaid: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        })

        // 5. حذف الطلب من pending_orders
        await db.collection('pending_orders').doc(orderId).delete()

        console.log(`تمت معالجة الطلب ${orderId} وتحويله إلى فاتورة ${invoiceNumber}`)
      } catch (error) {
        console.error('خطأ في معالجة الطلب المعلق:', error)
        throw error
      }
    }

    // إذا تم رفض الطلب
    if (before.status === 'pending' && after.status === 'rejected') {
      // يمكن إضافة إجراءات أخرى مثل إرسال إشعار للمندوب
      console.log(`تم رفض الطلب ${context.params.orderId}`)
    }
  })

// دالة توليد رقم الفاتورة (نسخة محلية من invoiceService)
async function generateInvoiceNumber(companyId: string): Promise<string> {
  const settingsRef = db.collection('settings').doc(`${companyId}_general`)

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

    transaction.update(settingsRef, {
      invoiceLastNumber: newNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    return `${prefix}-${year}-${newNumber.toString().padStart(6, '0')}`
  })

  return invoiceNumber
}
