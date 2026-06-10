import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';

import analyticsRoutes from '../src/routes/analytics';
import appointmentRoutes from '../src/routes/appointments';
import customerRoutes from '../src/routes/customer';
import orderRoutes from '../src/routes/order';

dotenv.config();

const app = express();
const allowedOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_VERCEL_URL || true;

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'The Atelier Workspace API'
  });
});

app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appointments', appointmentRoutes);

app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No backend route found for ${req.method} ${req.path}`
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled backend error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected server error occurred.'
  });
});

export default app;
