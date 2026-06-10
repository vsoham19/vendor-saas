import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

/**
 * POST /api/appointments
 * Pins a future fitting deadline or consultation session on the studio's calendar timeline.
 */
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customer_id, order_id, appointment_date, type, notes } = req.body;
    const vendorId = req.vendorId;

    if (!customer_id || !appointment_date) {
      return res.status(400).json({ error: 'Bad Request', message: 'Customer profile identification and target date metrics are required.' });
    }

    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .insert([{
        vendor_id: vendorId,
        customer_id,
        order_id: order_id || null,
        appointment_date,
        type: type || 'consultation',
        notes
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/appointments
 * Streams scheduling objects isolated inside this vendor partition for list and grid render engines.
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.vendorId;

    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('*, customers(name, phone), orders(order_number, status)')
      .eq('vendor_id', vendorId)
      .order('appointment_date', { ascending: true });

    if (error) throw error;
    res.status(200).json(appointments);
  } catch (err) {
    next(err);
  }
});

export default router;