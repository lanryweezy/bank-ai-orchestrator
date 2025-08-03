// Vercel serverless function entry point
import { Request, Response } from 'express';
import app from '../backend/src/server';

// Export handler for Vercel
export default async function handler(req: Request, res: Response) {
  return app(req, res);
}