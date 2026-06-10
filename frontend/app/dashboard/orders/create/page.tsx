'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

interface CustomerOption {
  id: string;
  full_name: string;
  phone: string;
}

interface LineItemState {
  item_name: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export default function CreateOrderPage() {
  const router = useRouter();

  // 1. Form Field States
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // 2. Dynamic Line Items Collection Matrix State
  const [lineItems, setLineItems] = useState<LineItemState[]>([
    { item_name: '', description: '', quantity: 1, unit_price: 0 }
  ]);

  // 3. Upfront Advance Payment Collection Box States
  const [collectAdvance, setCollectAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNote, setReferenceNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // TanStack Query: Fetch customers for search selection dropdown
  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ['customers-selector-list'],
    queryFn: async () => {
      // Direct pull mimicking multi-tenant scope return
      return [
        { id: 'c1', full_name: 'Priya Sharma', phone: '9810012345' },
        { id: 'c2', full_name: 'Arjun Kapoor', phone: '9871122334' },
        { id: 'c4', full_name: 'Kabir Singh', phone: '9111223344' }
      ];
    }
  });

  // Dynamic Calculation Framework (Calculates live totals on mobile shop floor)
  const calculateTotalAmount = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const totalAmount = calculateTotalAmount();
  const outstandingAmount = totalAmount - (collectAdvance ? advanceAmount : 0);

  // Form Array Modifiers
  const handleAddRow = () => {
    setLineItems([...lineItems, { item_name: '', description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof LineItemState, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  // Order Submission Pipeline
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      if (!selectedCustomerId) throw new Error('You must assign a customer to initialize this invoice.');
      if (totalAmount <= 0) throw new Error('Order total must be greater than zero.');
      if (collectAdvance && advanceAmount > totalAmount) throw new Error('Advance payments cannot exceed gross bill values.');

      // Execution Payload structure maps safely directly onto Supabase models
      const orderPayload = {
        customer_id: selectedCustomerId,
        description,
        total_amount: totalAmount,
        delivery_date: deliveryDate || null,
        notes,
        status: 'pending'
      };

      // In production execution block, items array map runs concurrently with payment insert log entry
      console.log('Sending Master Payload: ', { orderPayload, lineItems, advance: collectAdvance ? { advanceAmount, paymentMode } : null });
      return { success: true };
    },
    onSuccess: () => {
      router.push('/dashboard/orders');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to initialize order details.');
    }
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Title Segment */}
      <div className="border-b border-outline-variant pb-4">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-xs font-semibold text-secondary tracking-wider uppercase mb-2"
        >
          <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
          Cancel Invoice
        </button>
        <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Create New Order</h2>
        <p className="text-sm text-on-surface-variant">Generate itemized billing and process client advance parameters.</p>
      </div>

      {formError && (
        <div className="p-4 bg-error-container text-on-error-container text-xs font-medium border border-error/20 flex gap-2">
          <span className="material-symbols-outlined shrink-0 text-base">error</span>
          <p>{formError}</p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); createOrderMutation.mutate(); }} className="space-y-6 text-sm">
        
        {/* BLOCK 1: CUSTOMER METADATA TARGET */}
        <div className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
          <h3 className="font-serif text-base font-bold text-primary border-b border-zinc-100 pb-2">Client Verification</h3>
          
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Select Customer *</label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Choose active client configuration file --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Committed Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="var-label block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Order Short Summary Description</label>
              <input
                type="text"
                placeholder="e.g., Wedding Lehenga & Custom Blouse Set"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* BLOCK 2: DYNAMIC CUSTOM WORKSHOP LINE ITEMS CALCULATOR GRID */}
        <div className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
            <h3 className="font-serif text-base font-bold text-primary">Garment Line Items</h3>
            <button
              type="button"
              onClick={handleAddRow}
              className="text-xs font-bold text-secondary flex items-center gap-1 hover:opacity-80 py-1"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span> Add Outfit Row
            </button>
          </div>

          {/* Optimized Stack Track for Clean Mobile Verticality */}
          <div className="space-y-4 divide-y divide-zinc-100 sm:divide-y-0">
            {lineItems.map((item, index) => (
              <div key={index} className="pt-3 sm:pt-0 flex flex-col sm:flex-row gap-3 items-end bg-background sm:bg-transparent p-3 sm:p-0">
                <div className="w-full sm:w-1/3 space-y-1">
                  <label className="sm:hidden block text-[10px] font-bold uppercase text-ink-muted">Garment Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Blouse, Sherwani Jacket"
                    value={item.item_name}
                    onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                    className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
                  />
                </div>
                
                <div className="w-full sm:w-1/3 space-y-1">
                  <label className="sm:hidden block text-[10px] font-bold uppercase text-ink-muted">Fabric / Stitch Notes</label>
                  <input
                    type="text"
                    placeholder="Custom handwork patterns"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="w-full sm:w-20 space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-ink-muted sm:text-center">Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm sm:text-center focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="w-full sm:w-28 space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-ink-muted sm:text-right">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0"
                    value={item.unit_price || ''}
                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm text-left sm:text-right focus:ring-1 focus:ring-primary"
                  />
                </div>

                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(index)}
                    className="material-symbols-outlined text-status-due hover:text-opacity-80 p-2 border border-zinc-200 bg-white sm:border-none"
                  >
                    delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BLOCK 3: CULTURAL "KHATA" ADVANCE PROCESSING CONTAINER MODULE */}
        <div className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <div>
              <h3 className="font-serif text-base font-bold text-primary">Process Advance Collection</h3>
              <p className="text-[11px] text-ink-muted">Document immediate cash tokens collected to kickstart embroidery procurement[cite: 1, 10].</p>
            </div>
            <input
              type="checkbox"
              checked={collectAdvance}
              onChange={(e) => {
                setCollectAdvance(e.target.checked);
                if (e.target.checked) setAdvanceAmount(Math.round(totalAmount * 0.5)); // Suggest standard 50% Indian boutique advance default token 
              }}
              className="h-5 w-5 rounded-none border-outline-variant text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          {collectAdvance && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 animate-fadeIn">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Advance Credit Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={advanceAmount || ''}
                  onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                  className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm text-primary font-bold focus:ring-1 focus:ring-primary"
                />
                <div className="flex justify-between text-[10px] text-ink-muted pt-0.5">
                  <button type="button" onClick={() => setAdvanceAmount(Math.round(totalAmount * 0.4))} className="hover:text-secondary">40% (₹{Math.round(totalAmount * 0.4)})</button>
                  <button type="button" onClick={() => setAdvanceAmount(Math.round(totalAmount * 0.5))} className="hover:text-secondary">50% (₹{Math.round(totalAmount * 0.5)})</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Payment Channel Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="UPI">UPI (GPay / PhonePe)</option>
                  <option value="Cash">Hard Cash Collection</option>
                  <option value="Card">Credit/Debit swipe</option>
                  <option value="Bank Transfer">Direct IMPS / NEFT</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Memo Ref Number</label>
                <input
                  type="text"
                  placeholder="UPI transaction code string"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* WORKSPACE FOOTER TOTALS CONTEXT CARD */}
        <div className="bg-surface-container border border-outline-variant p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-6 text-center sm:text-left">
            <div>
              <span className="block text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">GROSS BILL TOTAL</span>
              <span className="text-xl font-bold font-serif text-primary">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">PAID ADVANCE CREDIT</span>
              <span className="text-xl font-bold font-serif text-status-paid">₹{(collectAdvance ? advanceAmount : 0).toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">REMAINING BALANCE DUE</span>
              <span className="text-xl font-bold font-serif text-status-due">₹{outstandingAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={createOrderMutation.isPending}
            className="w-full sm:w-auto min-h-[44px] px-8 py-3 bg-primary text-white text-xs font-bold tracking-wider uppercase hover:bg-opacity-95 disabled:opacity-50 transition-all active:scale-[0.99] self-stretch sm:self-auto flex items-center justify-center"
          >
            {createOrderMutation.isPending ? 'Processing Dues...' : 'Initialize Live Order'}
          </button>
        </div>

      </form>
    </div>
  );
}