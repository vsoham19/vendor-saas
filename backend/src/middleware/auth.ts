import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

/**
 * Absolute Tenant Gatekeeper Middleware
 * Extracts the bearer identity string, validates user legitimacy, and stamps 
 * multi-tenant isolation contexts natively into the execution pipeline.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Access credentials token is missing or malformed.' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Decompile and verify the client signature against Supabase identity records
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Signature token evaluation failed or profile has expired.' 
      });
    }

    // Map internal profile context matching this unique client identifier
    const { data: staffMember, error: dbError } = await supabaseAdmin
      .from('staff')
      .select('vendor_id, role')
      .eq('id', user.id)
      .single();

    if (dbError || !staffMember) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Identity records match no recognized multi-tenant fashion studio profile.' 
      });
    }

    // Stamp tenant runtime scopes directly into standard routing parameters
    req.user = user;
    req.vendorId = staffMember.vendor_id;
    req.role = staffMember.role as 'owner' | 'assistant';

    next();
  } catch (err: any) {
    next(err);
  }
};

/**
 * Role Guardian Filter
 * Restricts access to structural administrative tools. Automatically drops a 403
 * error if assistant staff members attempt to execute actions reserved for owners.
 */
export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  if (req.role !== 'owner') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access Denied: This visual metric compilation is restricted exclusively to Studio Owners.'
    });
  }
  next();
};