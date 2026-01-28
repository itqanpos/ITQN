import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()

export const updateTreasuryOnSale = functions.firestore
  .document('sales/{saleId}')
  .onCreate(async (snapshot, context) => {
    try {
      const sale = snapshot.data()
      const { companyId, total, paymentMethod, createdAt } = sale

      // تحويل التاريخ إلى تنسيق YYYY-MM-DD
      const date = new Date(createdAt.toDate()).toISOString().split('T')[0]
      const dailyTreasuryRef = db.collection('treasury_daily').doc(`${companyId}_${date}`)

      await db.runTransaction(async (transaction) => {
        const dailyDoc = await transaction.get(dailyTreasuryRef)

        if (!dailyDoc.exists) {
          // إنشاء سجل جديد للخزنة اليومية
          const newDailyData = {
            companyId,
            date,
            openingBalance: 0,
            income: total,
            expense: 0,
            closingBalance: total,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }
          transaction.set(dailyTreasuryRef, newDailyData)
        } else {
          // تحديث السجل الحالي
          const dailyData = dailyDoc.data()
          const newIncome = (dailyData?.income || 0) + total
          const newClosing = (dailyData?.closingBalance || 0) + total

          transaction.update(dailyTreasuryRef, {
            income: newIncome,
            closingBalance: newClosing,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        }

        // تحديث رصيد الخزنة الرئيسي إذا كان الدفع نقدي
        if (paymentMethod === 'cash') {
          const mainTreasuryRef = db.collection('treasury').doc(`${companyId}_main`)
          const mainDoc = await transaction.get(mainTreasuryRef)

          if (mainDoc.exists) {
            const mainData = mainDoc.data()
            const newBalance = (mainData?.balance || 0) + total

            transaction.update(mainTreasuryRef, {
              balance: newBalance,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
          }
        }
      })

      console.log(`تم تحديث الخزنة للفاتورة ${sale.invoiceNumber}`)
    } catch (error) {
      console.error('خطأ في تحديث الخزنة:', error)
      throw error
    }
  })
