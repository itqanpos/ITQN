import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Default error values
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Firebase Auth errors
  if (err.code?.startsWith('auth/')) {
    const message = getFirebaseAuthErrorMessage(err.code);
    return res.status(401).json({
      success: false,
      message,
      code: err.code
    });
  }

  // Firebase Firestore errors
  if (err.code?.startsWith('firestore/')) {
    const message = getFirestoreErrorMessage(err.code);
    return res.status(400).json({
      success: false,
      message,
      code: err.code
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message || 'Validation failed',
      errors: (err as any).errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error response
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    })
  });
};

const getFirebaseAuthErrorMessage = (code: string): string => {
  const errorMessages: { [key: string]: string } = {
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Invalid password',
    'auth/email-already-in-use': 'Email already in use',
    'auth/invalid-email': 'Invalid email address',
    'auth/weak-password': 'Password is too weak',
    'auth/user-disabled': 'User account is disabled',
    'auth/unauthorized-domain': 'Unauthorized domain',
    'auth/invalid-credential': 'Invalid credentials',
    'auth/invalid-verification-code': 'Invalid verification code',
    'auth/invalid-verification-id': 'Invalid verification ID',
    'auth/requires-recent-login': 'Please log in again to continue'
  };

  return errorMessages[code] || 'Authentication error';
};

const getFirestoreErrorMessage = (code: string): string => {
  const errorMessages: { [key: string]: string } = {
    'firestore/permission-denied': 'Permission denied',
    'firestore/not-found': 'Document not found',
    'firestore/already-exists': 'Document already exists',
    'firestore/resource-exhausted': 'Resource exhausted',
    'firestore/failed-precondition': 'Operation failed',
    'firestore/unavailable': 'Service unavailable'
  };

  return errorMessages[code] || 'Database error';
};

// Async handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
};
