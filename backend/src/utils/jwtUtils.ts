import * as jwt from 'jsonwebtoken';
import { jwtConfig } from '../config'; // Adjusted path

export interface JwtPayload {
  userId: string;
  role: string;
  // Add any other fields you want in the JWT payload
}

export const generateToken = (payload: JwtPayload): string => {
  const options: jwt.SignOptions = {
    expiresIn: jwtConfig.expiresIn
  };
  return jwt.sign(payload, jwtConfig.secret, options);
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;
    return decoded;
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
};
