import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

/**
 * POST /api/customers
 * Registers a new customer profile under the active studio's isolated tenant scope.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email } = req.body;
    const vendorId = req.vendorId;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Bad Request', message: 'Name and phone number are required.' });
    }

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .insert([{ vendor_id: vendorId, name, phone, email }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/customers
 * Fetches the studio's full customer list with optional query lookups by name or phone.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.vendorId;
    const { search } = req.query;

    let query = supabaseAdmin
      .from('customers')
      .select('id, name, phone, email, created_at')
      .eq('vendor_id', vendorId)
      .order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error } = await query;
    if (error) throw error;

    res.status(200).json(customers);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/customers/:id
 * Compiles a deep profile aggregation across customer metadata, ledgers, measurements, and schedules.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const vendorId = req.vendorId;

    // Validate customer row exists inside this specific vendor's silo
    const { data: customer, error: customerErr } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('vendor_id', vendorId)
      .single();

    if (customerErr || !customer) {
      return res.status(404).json({ error: 'Not Found', message: 'Customer record does not exist.' });
    }

    // Parallel fetch relevant transaction histories and measurements
    const [ordersResult, measurementsResult, appointmentsResult] = await Promise.all([
      supabaseAdmin.from('orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabaseAdmin.from('customer_measurements').select('*, template_id(name, columns)').eq('customer_id', id),
      supabaseAdmin.from('appointments').select('*').eq('customer_id', id).order('appointment_date', { ascending: true })
    ]);

    res.status(200).json({
      profile: customer,
      orders: ordersResult.data || [],
      measurements: measurementsResult.data || [],
      appointments: appointmentsResult.data || []
    });
  } catch (err) {
    next(err);
  }
});

export default router;