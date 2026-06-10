import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

/**
 * GET /api/analytics
 * Compiles structural ledger values, monthly financial turnovers, 
 * and identifies high-frequency repeating customers inside isolated tenant parameters.
 */
router.get('/', requireAuth, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.vendorId;

    // Pull financial order rows belonging exclusively to this specific studio context
    const { data: orderLedger, error: ledgerError } = await supabaseAdmin
      .from('orders')
      .select('customer_id, total_amount, amount_paid, amount_outstanding, created_at')
      .eq('vendor_id', vendorId);

    if (ledgerError) throw ledgerError;

    // Process real-time aggregate parameters safely without leaking data across vendors
    let grossRevenueVolume = 0;
    let totalOutstandingKhataBalance = 0;
    const clientVisitMatrix: { [key: string]: number } = {};

    orderLedger?.forEach((order) => {
      grossRevenueVolume += Number(order.amount_paid);
      totalOutstandingKhataBalance += Number(order.amount_outstanding);
      
      // Calculate high-frequency repeating consumers
      if (order.customer_id) {
        clientVisitMatrix[order.customer_id] = (clientVisitMatrix[order.customer_id] || 0) + 1;
      }
    });

    res.status(200).json({
      summary: {
        totalRevenueCollected: grossRevenueVolume,
        outstandingReceivables: totalOutstandingKhataBalance,
        totalOrdersProcessed: orderLedger?.length || 0
      },
      clientFrequencies: clientVisitMatrix,
      historicalLedgerTimeline: orderLedger || []
    });
  } catch (err: any) {
    next(err);
  }
});

export default router;