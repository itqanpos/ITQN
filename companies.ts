import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get company info
router.get('/',
  authenticate,
  async (req, res) => {
    try {
      const companyId = (req as any).user.companyId;

      const companyDoc = await db.collection('companies').doc(companyId).get();

      if (!companyDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: companyDoc.id,
          ...companyDoc.data(),
          createdAt: companyDoc.data()?.createdAt?.toDate(),
          updatedAt: companyDoc.data()?.updatedAt?.toDate()
        }
      });
    } catch (error: any) {
      console.error('Get company error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get company'
      });
    }
  }
);

// Update company
router.put('/:id',
  authenticate,
  authorize('products', 'update'),
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userCompanyId = (req as any).user.companyId;

      if (id !== userCompanyId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot update other company'
        });
      }

      const companyDoc = await db.collection('companies').doc(id).get();

      if (!companyDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      const updateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.legalName !== undefined) updateData.legalName = updates.legalName;
      if (updates.commercialRegistration !== undefined) updateData.commercialRegistration = updates.commercialRegistration;
      if (updates.taxNumber !== undefined) updateData.taxNumber = updates.taxNumber;
      if (updates.vatNumber !== undefined) updateData.vatNumber = updates.vatNumber;
      if (updates.email) updateData.email = updates.email;
      if (updates.phone) updateData.phone = updates.phone;
      if (updates.phone2 !== undefined) updateData.phone2 = updates.phone2;
      if (updates.fax !== undefined) updateData.fax = updates.fax;
      if (updates.website !== undefined) updateData.website = updates.website;
      if (updates.address) updateData.address = updates.address;
      if (updates.logo !== undefined) updateData.logo = updates.logo;
      if (updates.defaultCurrency) updateData.defaultCurrency = updates.defaultCurrency;
      if (updates.settings) updateData.settings = updates.settings;

      await db.collection('companies').doc(id).update(updateData);

      res.json({
        success: true,
        message: 'Company updated successfully',
        data: {
          id,
          ...updateData
        }
      });
    } catch (error: any) {
      console.error('Update company error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update company'
      });
    }
  }
);

// Upload logo
router.post('/:id/logo',
  authenticate,
  authorize('products', 'update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { logoBase64 } = req.body;
      const userCompanyId = (req as any).user.companyId;

      if (id !== userCompanyId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot update other company'
        });
      }

      // In production, upload to Firebase Storage and get URL
      // For now, store base64
      await db.collection('companies').doc(id).update({
        logo: logoBase64,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Logo uploaded successfully'
      });
    } catch (error: any) {
      console.error('Upload logo error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload logo'
      });
    }
  }
);

export { router as companyRoutes };
