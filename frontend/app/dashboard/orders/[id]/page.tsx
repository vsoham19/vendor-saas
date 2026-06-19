'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/utils/supabase';
import { sendOrderStatusUpdate } from '@/utils/whatsapp';

interface LineItem {
  id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface PaymentItem {
  id: string;
  amount: number;
  payment_mode: string;
  reference_note: string | null;
  paid_at: string;
}

interface DetailedOrder {
  id: string;
  order_number: string;
  customer_id: string;
  description: string | null;
  total_amount: number;
  delivery_date: string | null;
  notes: string | null;
  status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
  created_at: string;
  customers: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    address: string | null;
  } | null;
  items: LineItem[];
  payments: PaymentItem[];
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = params.id as string;

  const { useDetails, useRecordPayment } = useOrders();
  const { data: orderDetails, isLoading, isError, error } = useDetails(orderId);

  // Form states for collecting a payment
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNote, setReferenceNote] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Mutations
  const recordPaymentMutation = useRecordPayment();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: DetailedOrder['status']) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Trigger status update WhatsApp in the background
      const updatedOrder = data?.[0];
      if (updatedOrder && orderDetails?.customers) {
        const customer = orderDetails.customers;
        
        supabase.from('order_items').select('item_name').eq('order_id', orderId).then(({ data: items }) => {
          const itemSummary = items && items.length > 0 ? items.map(i => i.item_name).join(', ') : null;
          
          sendOrderStatusUpdate(
            customer.name,
            updatedOrder.order_number || '',
            itemSummary,
            updatedOrder.status,
            customer.phone
          ).catch(err => console.error('Failed to send order status WhatsApp notification:', err));
        });
      }
    }
  });

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-on-surface-variant">Synchronizing boutique order files...</div>;
  }

  if (isError || !orderDetails) {
    return (
      <div className="p-4 bg-error-container text-on-error-container border border-error/20 text-xs font-medium max-w-lg mx-auto flex gap-2">
        <span className="material-symbols-outlined text-base shrink-0">error</span>
        <p>Error retrieving order details: {error?.message || 'Invoice record not found.'}</p>
      </div>
    );
  }

  // Cast detail data structure to typing
  const order = orderDetails as unknown as DetailedOrder;

  // Financial math calculations
  const totalPaid = order.payments.reduce((sum, pay) => sum + pay.amount, 0);
  const remainingDue = Math.max(0, order.total_amount - totalPaid);

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    if (paymentAmount <= 0) {
      setPaymentError('Payment credit amount must be greater than zero.');
      return;
    }
    if (paymentAmount > remainingDue) {
      setPaymentError('Overpayment validation failed. Dues outstanding cannot evaluate to negative.');
      return;
    }

    recordPaymentMutation.mutate(
      {
        order_id: orderId,
        customer_id: order.customer_id,
        amount: paymentAmount,
        payment_mode: paymentMode,
        reference_note: referenceNote || null
      },
      {
        onSuccess: () => {
          setIsPaymentFormOpen(false);
          setPaymentAmount(0);
          setReferenceNote('');
        },
        onError: (err: any) => {
          setPaymentError(err.message || 'Failed to register checkout payment transaction.');
        }
      }
    );
  };

  const statusColors = {
    pending: 'text-amber-600 bg-amber-50 border-amber-200',
    in_progress: 'text-zinc-600 bg-zinc-50 border-zinc-200',
    ready: 'text-secondary bg-orange-50 border-orange-200',
    delivered: 'text-status-paid bg-emerald-50 border-emerald-200',
    cancelled: 'text-status-due bg-red-50 border-red-200'
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title Breadcrumbs Segment */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <button 
            onClick={() => router.push('/dashboard/orders')}
            className="flex items-center text-xs font-semibold text-secondary tracking-wider uppercase mb-2"
          >
            <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
            All Invoices
          </button>
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">{order.order_number}</h2>
            <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase border tracking-wider ${statusColors[order.status]}`}>
              {order.status === 'ready' ? 'Ready for Trial' : order.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Change Status Dropdown Controller */}
        <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
          <label className="uppercase tracking-wide">Update Stage:</label>
          <select
            value={order.status}
            disabled={updateStatusMutation.isPending}
            onChange={(e) => updateStatusMutation.mutate(e.target.value as DetailedOrder['status'])}
            className="min-h-[38px] px-3 bg-surface-container-low border border-outline-variant focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="ready">Ready for Trial</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Grid Split View: Client Info vs Financial Ledger card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Component A: Customer Details Card */}
        <div className="md:col-span-1 bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
          <h3 className="font-serif text-base font-bold text-primary border-b border-zinc-100 pb-2">Client Details</h3>
          {order.customers ? (
            <div className="space-y-3 text-xs font-semibold text-on-surface-variant">
              <div>
                <span className="block text-[9px] font-bold text-ink-muted uppercase">Full Name</span>
                <span 
                  onClick={() => router.push(`/dashboard/customers/${order.customers?.id}`)}
                  className="text-primary font-bold text-sm hover:underline cursor-pointer"
                >
                  {order.customers.full_name}
                </span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-ink-muted uppercase">Contact Phone</span>
                <span className="text-on-surface font-medium">{order.customers.phone}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-ink-muted uppercase">Email Address</span>
                <span className="text-on-surface font-medium">{order.customers.email || 'No email registered'}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-ink-muted uppercase">Boutique Delivery Address</span>
                <span className="text-on-surface font-medium leading-relaxed block">{order.customers.address || 'No address logged'}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">Unlinked boutique customer record.</p>
          )}
        </div>

        {/* Component B: Financial Ledger Summary */}
        <div className="md:col-span-2 bg-surface-container-lowest p-5 border border-zinc-200 flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-base font-bold text-primary border-b border-zinc-100 pb-2 mb-4">Financial Ledger Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-surface-container-low p-4 border border-zinc-100">
                <span className="block text-[9px] font-bold text-ink-muted uppercase mb-1">Gross Bill Total</span>
                <span className="text-lg font-bold font-mono text-primary">₹{order.total_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-emerald-50/30 p-4 border border-emerald-100">
                <span className="block text-[9px] font-bold text-status-paid uppercase mb-1">Total Paid Credit</span>
                <span className="text-lg font-bold font-mono text-status-paid">₹{totalPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className={`p-4 border ${remainingDue > 0 ? 'bg-red-50/30 border-red-100' : 'bg-surface-container-low border-zinc-100'}`}>
                <span className={`block text-[9px] font-bold uppercase mb-1 ${remainingDue > 0 ? 'text-status-due' : 'text-ink-muted'}`}>Balance Due</span>
                <span className={`text-lg font-bold font-mono ${remainingDue > 0 ? 'text-status-due' : 'text-status-paid'}`}>
                  ₹{remainingDue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {remainingDue > 0 && !isPaymentFormOpen && (
            <button
              onClick={() => {
                setPaymentAmount(remainingDue);
                setIsPaymentFormOpen(true);
              }}
              className="mt-6 w-full min-h-[44px] bg-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-opacity-95 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">payments</span>
              Record Payment Receipt
            </button>
          )}
        </div>
      </div>

      {/* Component C: Record Payment Form Modal */}
      {isPaymentFormOpen && (
        <div className="bg-surface-container-lowest border border-zinc-200 p-5 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-2 mb-4">
            <h3 className="font-serif text-base font-bold text-primary">Log Incremental Payment</h3>
            <button onClick={() => setIsPaymentFormOpen(false)} className="material-symbols-outlined text-on-surface-variant hover:text-primary">close</button>
          </div>

          {paymentError && (
            <div className="p-3 bg-error-container text-on-error-container border border-error/20 text-xs font-semibold mb-4 flex gap-2">
              <span className="material-symbols-outlined text-sm shrink-0">error</span>
              <p>{paymentError}</p>
            </div>
          )}

          <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-semibold text-on-surface-variant items-end">
            <div className="space-y-1">
              <label className="uppercase tracking-wide block">Collected Amount (₹) *</label>
              <input
                type="number"
                min="1"
                required
                value={paymentAmount || ''}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant font-bold text-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="uppercase tracking-wide block">Payment Channel Mode *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="UPI">UPI (GPay / PhonePe)</option>
                <option value="Cash">Hard Cash Collection</option>
                <option value="Card">Credit/Debit swipes</option>
                <option value="Bank Transfer">Bank Transfer IMPS</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="uppercase tracking-wide block">Memo Ref Details</label>
              <input
                type="text"
                placeholder="Transaction code references"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={recordPaymentMutation.isPending}
              className="min-h-[44px] bg-primary text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center disabled:opacity-50 hover:bg-opacity-95"
            >
              {recordPaymentMutation.isPending ? 'Logging Cashflow...' : 'Record Payment'}
            </button>
          </form>
        </div>
      )}

      {/* Component D: Line Items & Payments Logs Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Segment 1: Outfit Line Items */}
        <div className="space-y-3">
          <h3 className="font-serif text-lg font-bold text-primary">Garment Line Items</h3>
          <div className="bg-surface-container-lowest border border-zinc-200 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[380px]">
              <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                <tr>
                  <th className="px-4 py-3">Garment Item</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-medium text-on-surface">
                {order.items.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-ink-muted">No itemization records found.</td></tr>
                ) : (
                  order.items.map((item) => (
                    <tr key={item.id} className="zebra-row">
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-primary">{item.item_name}</p>
                        {item.description && <p className="text-[10px] text-ink-muted italic">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-center">{item.quantity}</td>
                      <td className="px-4 py-3.5 text-right">₹{item.unit_price.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3.5 text-right font-bold">₹{item.total_price.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Segment 2: Receipt Running Logs */}
        <div className="space-y-3">
          <h3 className="font-serif text-lg font-bold text-primary">Transaction Payments History</h3>
          <div className="bg-surface-container-lowest border border-zinc-200 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[380px]">
              <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Reference / Memo</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-medium text-on-surface">
                {order.payments.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-ink-muted">No advance payments recorded.</td></tr>
                ) : (
                  order.payments.map((pay) => (
                    <tr key={pay.id} className="zebra-row">
                      <td className="px-4 py-3.5 text-on-surface-variant">{new Date(pay.paid_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3.5"><span className="bg-surface-container px-2 py-0.5 border border-outline-variant font-mono">{pay.payment_mode}</span></td>
                      <td className="px-4 py-3.5 text-on-surface-variant max-w-[120px] truncate" title={pay.reference_note || ''}>{pay.reference_note || '--'}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-status-paid">₹{pay.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}