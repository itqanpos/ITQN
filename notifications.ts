import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { param, query } from 'express-validator';

const router = Router();
const db = admin.firestore();

// Get user notifications
router.get('/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('unreadOnly').optional().isBoolean()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false
      } = req.query;

      const userId = (req as any).user.uid;

      let queryRef: any = db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');

      if (unreadOnly === 'true') {
        queryRef = queryRef.where('isRead', '==', false);
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryRef = queryRef.limit(Number(limit)).offset(offset);

      const snapshot = await queryRef.get();

      const notifications = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        readAt: doc.data().readAt?.toDate()
      }));

      // Get unread count
      const unreadSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .count()
        .get();

      res.json({
        success: true,
        data: {
          notifications,
          unreadCount: unreadSnapshot.data().count,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: notifications.length
          }
        }
      });
    } catch (error: any) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get notifications'
      });
    }
  }
);

// Mark notification as read
router.patch('/:id/read',
  authenticate,
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.uid;

      const notificationDoc = await db.collection('notifications').doc(id).get();

      if (!notificationDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      const notificationData = notificationDoc.data();

      if (notificationData?.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access notification'
        });
      }

      await notificationDoc.ref.update({
        isRead: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error: any) {
      console.error('Mark notification read error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark notification as read'
      });
    }
  }
);

// Mark all notifications as read
router.post('/mark-all-read',
  authenticate,
  async (req, res) => {
    try {
      const userId = (req as any).user.uid;

      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      const batch = db.batch();

      snapshot.docs.forEach((doc: any) => {
        batch.update(doc.ref, {
          isRead: true,
          readAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();

      res.json({
        success: true,
        message: `Marked ${snapshot.size} notifications as read`
      });
    } catch (error: any) {
      console.error('Mark all read error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark notifications as read'
      });
    }
  }
);

// Delete notification
router.delete('/:id',
  authenticate,
  [
    param('id').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.uid;

      const notificationDoc = await db.collection('notifications').doc(id).get();

      if (!notificationDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      const notificationData = notificationDoc.data();

      if (notificationData?.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete notification'
        });
      }

      await db.collection('notifications').doc(id).delete();

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete notification'
      });
    }
  }
);

export { router as notificationRoutes };
