import { User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      vendorId?: string;
      role?: 'owner' | 'assistant';
    }
  }
}