import { Router } from 'express';
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';

const router = Router();
const db = admin.firestore();
const auth = admin.auth();

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('displayName').trim().isLength({ min: 2 }),
  body('companyId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, displayName, phoneNumber, companyId, role = 'sales_rep' } = req.body;

    // Check if company exists
    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      phoneNumber
    });

    // Create user document in Firestore
    const userData = {
      id: userRecord.uid,
      email,
      displayName,
      phoneNumber: phoneNumber || null,
      role,
      status: 'pending',
      companyId,
      permissions: [],
      emailVerified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role,
      companyId
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        uid: userRecord.uid, 
        email, 
        role, 
        companyId 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: userRecord.uid,
          email,
          displayName,
          role,
          companyId
        },
        token
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Get user by email
    const userRecord = await auth.getUserByEmail(email);
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User data not found'
      });
    }

    const userData = userDoc.data();

    // Check if user is active
    if (userData?.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    // Update last login
    await db.collection('users').doc(userRecord.uid).update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        uid: userRecord.uid, 
        email, 
        role: userData?.role, 
        companyId: userData?.companyId 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: userRecord.uid,
          email: userData?.email,
          displayName: userData?.displayName,
          phoneNumber: userData?.phoneNumber,
          role: userData?.role,
          companyId: userData?.companyId,
          branchId: userData?.branchId,
          photoURL: userData?.photoURL,
          permissions: userData?.permissions
        },
        token
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Add token to blacklist if using Redis or similar
    }

    res.json({
      success: true,
      message: 'Logout successful'
    };
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Logout failed'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const oldToken = authHeader.substring(7);
    
    // Verify old token
    const decoded = jwt.verify(oldToken, JWT_SECRET) as any;
    
    // Get fresh user data
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();

    // Generate new token
    const newToken = jwt.sign(
      { 
        uid: decoded.uid, 
        email: decoded.email, 
        role: userData?.role, 
        companyId: userData?.companyId 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: { token: newToken }
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Forgot password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const { email } = req.body;
    
    // Generate password reset link
    const resetLink = await auth.generatePasswordResetLink(email);
    
    // TODO: Send email with reset link
    console.log('Password reset link:', resetLink);

    res.json({
      success: true,
      message: 'Password reset link sent to your email'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reset link'
    });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Get user data
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'User not active'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: decoded.uid,
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role,
          companyId: userData.companyId,
          branchId: userData.branchId
        }
      }
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

export { router as authRoutes };
