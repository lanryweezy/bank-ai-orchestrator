import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwtUtils'; // Assuming jwtUtils is in src/utils

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload; // User payload from JWT
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const userPayload = verifyToken(token);

  if (!userPayload) {
    return res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
  }

  req.user = userPayload;
  next();
};

// Middleware to check for specific roles
export const authorizeRole = (allowedRoles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Forbidden: Role not available' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Forbidden: Role ${req.user.role} is not authorized` });
    }
    next();
  };
};

// Specific role middleware examples
export const isPlatformAdmin = authorizeRole('platform_admin');
export const isBankAdmin = authorizeRole(['platform_admin', 'bank_admin']); // Platform admin can also do bank admin tasks
export const isBankUser = authorizeRole(['platform_admin', 'bank_admin', 'bank_user']);

// Note: The actual roles 'platform_admin', 'bank_admin', 'bank_user' should match those in your users table schema
// and what's put into the JWT payload during login.
// The current users table schema has: CHECK (role IN ('bank_user', 'bank_admin', 'platform_admin'))
// The authService.loginUser currently puts user.role into the JWT. This should align.
