import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';

import analyticsRoutes from '../src/routes/analytics';
import appointmentRoutes from '../src/routes/appointments';
import customerRoutes from '../src/routes/customer';
import orderRoutes from '../src/routes/order';
import authMiddleware from '../src/middleware/authMiddleware';

// Load environment variables

dotenv.config();

// Validate required env vars for production
const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();

// Production‑ready CORS whitelist
const allowedOrigins = ['http://localhost:3000', 'https://vendor-saas.vercel.app'];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non‑browser requests (e.g., Postman) with no origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());

// Public health endpoint at root and /api/health
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'The Atelier Workspace API',
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'The Atelier Workspace API',
  });
});

// Apply authentication middleware to protected routes
app.use(authMiddleware);

// Register API routes (protected)
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appointments', appointmentRoutes);

// Catch‑all 404 for unknown API paths
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No backend route found for ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled backend error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected server error occurred.',
  });
});

export default app;
