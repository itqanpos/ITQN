import * as functions from 'firebase-functions'
import { generateInvoiceNumber } from './services/invoiceService'

export const getInvoiceNumber = functions.https.onCall(async (data, context) => {
  // التحقق من المصادقة
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول أولاً'
    )
  }

  const companyId = data.companyId
  if (!companyId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'معرف الشركة مطلوب'
    )
  }

  try {
    const invoiceNumber = await generateInvoiceNumber(companyId)
    return { invoiceNumber }
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'فشل في توليد رقم الفاتورة'
    )
  }
})
