import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

/**
 * POST /api/staff/invite
 * Creates a new assistant staff member for the vendor.
 * Only accessible by store owners.
 * 
 * Body: { name: string, email: string, password: string, vendor_id: string }
 */
router.post('/invite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, vendor_id } = req.body;

    // Validate required fields
    if (!name || !email || !password || !vendor_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name, email, password, and vendor_id are all required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Verify the caller is an owner of this vendor
    const callerAuthId = req.user?.id;
    if (!callerAuthId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No authenticated user.' });
    }

    const { data: callerStaff, error: callerError } = await supabaseAdmin
      .from('staff')
      .select('role, vendor_id')
      .eq('auth_user_id', callerAuthId)
      .eq('vendor_id', vendor_id)
      .single();

    if (callerError || !callerStaff || callerStaff.role !== 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only store owners can add staff members.',
      });
    }

    // 1. Create the auth user with Supabase Admin API
    const { data: newAuthUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so they can immediately sign in
    });

    if (authCreateError) {
      // Handle duplicate email
      if (authCreateError.message?.includes('already been registered') || authCreateError.message?.includes('already exists')) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'A user with this email address already exists.',
        });
      }
      throw authCreateError;
    }

    if (!newAuthUser.user) {
      throw new Error('Failed to create auth user — no user returned.');
    }

    // 2. Create the staff record
    const { data: staffRecord, error: staffError } = await supabaseAdmin
      .from('staff')
      .insert([{
        vendor_id,
        auth_user_id: newAuthUser.user.id,
        name: name,
        full_name: name,
        email,
        role: 'assistant',
        is_active: true,
      }])
      .select()
      .single();

    if (staffError) {
      // Rollback: delete the auth user if staff creation fails
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
      throw staffError;
    }

    res.status(201).json({
      message: 'Assistant created successfully.',
      staff: {
        id: staffRecord.id,
        full_name: staffRecord.full_name,
        email: staffRecord.email,
        role: staffRecord.role,
        is_active: staffRecord.is_active,
      },
    });
  } catch (err: any) {
    console.error('Staff invite error:', err);
    next(err);
  }
});

/**
 * GET /api/staff
 * List all staff members for the authenticated user's vendor.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.vendorId;
    
    const { data: staff, error } = await supabaseAdmin
      .from('staff')
      .select('id, full_name, email, role, is_active')
      .eq('vendor_id', vendorId)
      .order('role', { ascending: true });

    if (error) throw error;

    res.status(200).json(staff || []);
  } catch (err) {
    next(err);
  }
});

export default router;
