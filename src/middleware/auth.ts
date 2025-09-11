import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { UserModel } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: any;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log(token);
    if (!token) {
      console.log('no token');
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }
    
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
    
    // Get user with role
  
    const user = await UserModel.findById(decoded.id)
      .select('+password');
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user',
      });
    }
    
    
    
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid access token',
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }
    next();
  };
};

export const requireFeature = (feature: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.features[feature]) {
      return res.status(403).json({
        success: false,
        message: 'Feature access denied',
      });
    }
    next();
  };
};
