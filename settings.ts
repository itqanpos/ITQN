import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get company settings
router.get('/company',
  authenticate,
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;

      const settingsDoc = await db.collection('settings').doc(companyId).get();

      if (!settingsDoc.exists) {
        // Return default settings
        return res.json({
          success: true,
          data: {
            general: {
              timezone: 'Asia/Riyadh',
              dateFormat: 'YYYY-MM-DD',
              timeFormat: '24h',
              language: 'ar'
            },
            numbers: {
              decimalPlaces: 2,
              decimalSeparator: '.',
              thousandsSeparator: ','
            },
            sales: {
              invoicePrefix: 'INV',
              invoiceStartNumber: 1,
              defaultTaxRate: 15,
              allowCreditSales: true
            },
            inventory: {
              inventoryMethod: 'fifo',
              negativeStock: false
            },
            notifications: {
              lowStock: true,
              newOrder: true,
              paymentReceived: true,
              dailyReport: false
            },
            receipt: {
              header: '',
              footer: 'Thank you for your business!',
              showLogo: true,
              showBarcode: true
            }
          }
        });
      }

      res.json({
        success: true,
        data: settingsDoc.data()
      });
    } catch (error: any) {
      console.error('Get settings error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get settings'
      });
    }
  }
);

// Update company settings
router.put('/company',
  authenticate,
  authorize('products', 'update'),
  async (req, res) => {
    try {
      const updates = req.body;
      const companyId = (req as any).user.companyId;

      const settingsRef = db.collection('settings').doc(companyId);

      await settingsRef.set({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: updates
      });
    } catch (error: any) {
      console.error('Update settings error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update settings'
      });
    }
  }
);

// Get user preferences
router.get('/user',
  authenticate,
  async (req, res) => {
    try {
      const userId = (req as any).user.uid;

      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      res.json({
        success: true,
        data: userData?.preferences || {
          language: 'ar',
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            sms: false
          }
        }
      });
    } catch (error: any) {
      console.error('Get user preferences error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get user preferences'
      });
    }
  }
);

// Update user preferences
router.put('/user',
  authenticate,
  async (req, res) => {
    try {
      const updates = req.body;
      const userId = (req as any).user.uid;

      await db.collection('users').doc(userId).update({
        preferences: updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: updates
      });
    } catch (error: any) {
      console.error('Update user preferences error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update preferences'
      });
    }
  }
);

export { router as settingRoutes };
