import express from 'express';
import cors from 'cors';
import authRoutes from '../src/routes/auth';
import customerRoutes from '../src/routes/customers';
import orderRoutes from '../src/routes/orders';
import analyticsRoutes from '../src/routes/analytics';

const app = express();

// Handle cross-origin demands safely across decoupled Vercel domains
app.use(cors({
  origin: process.env.FRONTEND_VERCEL_URL || '*',
  credentials: true
}));

app.use(express.json());

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);

// Export for Vercel Serverless handling execution
export default app;