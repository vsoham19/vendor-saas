'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useAuthStore } from '@/store/authStore';
import { buildPaymentReminderMessage, buildWhatsAppLink } from '@/utils/whatsapp';

// Data models matching backend schema definitions
interface CustomerProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  total_outstanding: number;
}

interface LedgerItem {
  id: string;
  amount: number;
  payment_mode: string;
  reference_note: string | null;
  paid_at: string;
  order_number?: string;
}

interface OrderItemSummary {
  id: string;
  order_number: string;
  description: string | null;
  total_amount: number;
  amount_outstanding: number;
  status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
  delivery_date: string | null;
}

interface MeasurementRecord {
  id: string;
  label: string;
  values: Record<string, string>;
  notes: string | null;
  recorded_at: string;
}

interface AppointmentItem {
  id: string;
  title: string;
  scheduled_date: string;
  stage: string | null;
  status: string;
}

type TabType = 'overview' | 'orders' | 'measurements' | 'appointments';

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerId = params.id as string;
  const { user } = useAuthStore();
  const vendorId = user?.vendorId;

  // Tab State Matrix
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // UI Expansion Matrix for measurement dropdown records
  const [expandedMeasurementId, setExpandedMeasurementId] = useState<string | null>(null);

  // Query 1: Fetch core profile metadata
  const { data: profile, isLoading: isProfileLoading } = useQuery<CustomerProfile>({
    queryKey: ['customer-profile', customerId, vendorId],
    queryFn: async () => {
      if (!vendorId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, full_name, phone, email, address, notes, total_outstanding')
        .eq('id', customerId)
        .eq('vendor_id', vendorId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Customer profile not found');

      return {
        id: data.id,
        full_name: data.full_name || data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        notes: data.notes,
        total_outstanding: Number(data.total_outstanding || 0)
      };
    },
    enabled: !!customerId && !!vendorId
  });

  // Query 2: Fetch full running financial payment histories
  const { data: ledger = [] } = useQuery<LedgerItem[]>({
    queryKey: ['customer-ledger', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_mode,
          reference_note,
          paid_at,
          orders (
            order_number
          )
        `)
        .eq('customer_id', customerId)
        .order('paid_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        amount: Number(item.amount || 0),
        payment_mode: item.payment_mode,
        reference_note: item.reference_note,
        paid_at: item.paid_at,
        order_number: Array.isArray(item.orders) ? item.orders[0]?.order_number : item.orders?.order_number
      }));
    },
    enabled: !!customerId
  });

  // Query 3: Fetch all historical and active orders
  const { data: orders = [] } = useQuery<OrderItemSummary[]>({
    queryKey: ['customer-orders', customerId, vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, description, total_amount, amount_outstanding, status, delivery_date')
        .eq('customer_id', customerId)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((ord: any) => ({
        id: ord.id,
        order_number: ord.order_number,
        description: ord.description,
        total_amount: Number(ord.total_amount || 0),
        amount_outstanding: Number(ord.amount_outstanding || 0),
        status: ord.status,
        delivery_date: ord.delivery_date
      }));
    },
    enabled: !!customerId && !!vendorId
  });

  // Query 4: Fetch logged custom measurements session states
  const { data: measurements = [] } = useQuery<MeasurementRecord[]>({
    queryKey: ['customer-measurements', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_measurements')
        .select('id, label, values, notes, recorded_at')
        .eq('customer_id', customerId)
        .order('recorded_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((rec: any) => ({
        id: rec.id,
        label: rec.label || 'Unnamed Session',
        values: rec.values || {},
        notes: rec.notes,
        recorded_at: rec.recorded_at
      }));
    },
    enabled: !!customerId
  });

  // Query 5: Fetch all chronological fitting appointments
  const { data: appointments = [] } = useQuery<AppointmentItem[]>({
    queryKey: ['customer-appointments', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, title, scheduled_date, stage, status')
        .eq('customer_id', customerId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((appt: any) => ({
        id: appt.id,
        title: appt.title,
        scheduled_date: appt.scheduled_date,
        stage: appt.stage,
        status: appt.status
      }));
    },
    enabled: !!customerId
  });

  if (isProfileLoading || !profile) {
    return <div className="p-10 text-center text-sm text-on-surface-variant">Synchronizing profile ledger summaries...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Section: Back Link & Summary Meta Frame */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start border-b border-outline-variant pb-6">
        <div className="space-y-1">
          <button 
            onClick={() => router.push('/dashboard/customers')}
            className="flex items-center text-xs font-semibold text-secondary tracking-wider uppercase mb-2 group"
          >
            <span className="material-symbols-outlined text-sm mr-1 transition-transform group-hover:-translate-x-0.5">arrow_back</span>
            Back to Customer Directory
          </button>
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">{profile.full_name}</h2>
          <p className="text-sm font-medium text-on-surface-variant tracking-wide">{profile.phone}</p>
        </div>

        {/* Dynamic Balance Tracker Card — Reads direct database totals */}
        <div className="bg-surface-container-lowest border border-zinc-200 p-4 min-w-[200px] card-shadow">
          <p className="text-[10px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">TOTAL OUTSTANDING</p>
          <p className={`font-serif text-2xl font-bold ${profile.total_outstanding > 0 ? 'text-status-due' : 'text-status-paid'}`}>
            ₹{profile.total_outstanding.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-ink-muted mt-2">Maintained by automated DB triggers</p>
          {profile.total_outstanding > 0 && (
            <a
              href={buildWhatsAppLink(
                profile.phone,
                buildPaymentReminderMessage({
                  customerName: profile.full_name,
                  amount: profile.total_outstanding
                })
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full min-h-[36px] bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-emerald-800 transition-colors"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              Send WhatsApp Reminder
            </a>
          )}
        </div>
      </div>

      {/* Horizontal Mobile Tab Scroller Track */}
      <div className="border-b border-outline-variant overflow-x-auto no-scrollbar flex flex-nowrap bg-surface-container-low sm:bg-transparent p-1 sm:p-0">
        {(['overview', 'orders', 'measurements', 'appointments'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-[44px] px-5 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'border-primary text-primary bg-surface-container-lowest sm:bg-transparent font-bold' 
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Dynamic Render Context Segments */}
      <div className="w-full">
        
        {/* TAB ONE: OVERVIEW & RUNNING CASH LEDGER LOGS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4 bg-surface-container-lowest p-5 border border-zinc-200">
              <h4 className="font-serif text-lg font-bold text-primary border-b border-outline-variant pb-2">Profile Details</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-ink-muted uppercase">Email Address</span>
                  <span className="text-on-surface font-medium">{profile.email || 'No email on file'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-ink-muted uppercase">Shipping / Studio Delivery Address</span>
                  <span className="text-on-surface leading-relaxed block">{profile.address || 'No address logged'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-ink-muted uppercase">Internal Designer Notes</span>
                  <p className="text-xs text-on-surface-variant bg-background p-3 border-l-2 border-secondary italic">{profile.notes || 'No custom annotations recorded'}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h4 className="font-serif text-lg font-bold text-primary">Running Account Ledger</h4>
              <div className="bg-surface-container-lowest border border-zinc-200 overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-4 py-3 font-bold text-on-surface-variant tracking-wider uppercase">DATE</th>
                      <th className="px-4 py-3 font-bold text-on-surface-variant tracking-wider uppercase">ORDER SOURCE</th>
                      <th className="px-4 py-3 font-bold text-on-surface-variant tracking-wider uppercase">MODE</th>
                      <th className="px-4 py-3 font-bold text-on-surface-variant tracking-wider uppercase">MEMO REFERENCE</th>
                      <th className="px-4 py-3 font-bold text-on-surface-variant tracking-wider uppercase text-right">CREDIT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {ledger.length === 0 ? (
                      <tr><td colSpan={5} className="p-6 text-center text-ink-muted">No processing receipts documented.</td></tr>
                    ) : (
                      ledger.map((item) => (
                        <tr key={item.id} className="zebra-row font-medium text-on-surface">
                          <td className="px-4 py-3.5 text-on-surface-variant">{new Date(item.paid_at).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3.5 font-bold text-primary">{item.order_number || 'Standalone Payment'}</td>
                          <td className="px-4 py-3.5"><span className="bg-surface-container px-2 py-0.5 border border-outline-variant rounded-xs font-mono">{item.payment_mode}</span></td>
                          <td className="px-4 py-3.5 text-on-surface-variant max-w-[180px] truncate">{item.reference_note || '--'}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-status-paid">₹{item.amount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB TWO: CUSTOMER PRODUCTION ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-surface-container-lowest border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-6 py-3.5 font-bold text-on-surface-variant tracking-wider uppercase">ORDER NUMBER</th>
                    <th className="px-6 py-3.5 font-bold text-on-surface-variant tracking-wider uppercase">DESCRIPTION SUMMARY</th>
                    <th className="px-6 py-3.5 font-bold text-on-surface-variant tracking-wider uppercase">STATUS</th>
                    <th className="px-6 py-3.5 font-bold text-on-surface-variant tracking-wider uppercase">DELIVERY PROMISE</th>
                    <th className="px-6 py-3.5 font-bold text-on-surface-variant tracking-wider uppercase text-right">TOTAL</th>
                    <th className="px-6 py-3.5 font-bold text-on-surface-variant tracking-wider uppercase text-right">BAAKI (DUE)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-medium">
                  {orders.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-ink-muted">No historical custom invoices matched.</td></tr>
                  ) : (
                    orders.map((ord) => (
                      <tr 
                        key={ord.id}
                        onClick={() => router.push(`/dashboard/orders/${ord.id}`)}
                        className="hover:bg-surface-container-low transition-colors cursor-pointer zebra-row text-on-surface"
                      >
                        <td className="px-6 py-4 font-bold text-primary">{ord.order_number}</td>
                        <td className="px-6 py-4 max-w-[220px] truncate text-on-surface-variant">{ord.description || '--'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                            ord.status === 'in_progress' ? 'bg-surface-container-highest text-on-surface-variant' : 'bg-secondary-container text-on-secondary-container'
                          }`}>
                            {ord.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant">{ord.delivery_date ? new Date(ord.delivery_date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'}) : 'Continuous'}</td>
                        <td className="px-6 py-4 text-right">₹{ord.total_amount.toLocaleString('en-IN')}</td>
                        <td className={`px-6 py-4 text-right font-bold ${ord.amount_outstanding > 0 ? 'text-status-due' : 'text-status-paid'}`}>
                          ₹{ord.amount_outstanding.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB THREE: VARIABLE RUNTIME CUSTOM MEASUREMENT LOGS */}
        {activeTab === 'measurements' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-serif text-lg font-bold text-primary">Measurement History</h4>
              <button 
                onClick={() => router.push(`/dashboard/customers/${customerId}/measurements/new`)}
                className="min-h-[44px] px-4 py-2 bg-secondary text-white text-xs font-bold tracking-wider uppercase hover:bg-opacity-95"
              >
                Add Measurement
              </button>
            </div>

            <div className="space-y-2">
              {measurements.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-200 text-sm text-ink-muted">
                  No customized structural column blocks documented yet.
                </div>
              ) : (
                measurements.map((record) => {
                  const isExpanded = expandedMeasurementId === record.id;
                  return (
                    <div key={record.id} className="bg-surface-container-lowest border border-zinc-200 overflow-hidden">
                      {/* Accordion Target Strip */}
                      <div 
                        onClick={() => setExpandedMeasurementId(isExpanded ? null : record.id)}
                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-50/50 transition-colors select-none"
                      >
                        <div>
                          <p className="text-sm font-bold text-primary">{record.label}</p>
                          <p className="text-[10px] text-ink-muted">Recorded: {new Date(record.recorded_at).toLocaleDateString('en-IN')}</p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-200">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>

                      {/* Interactive Field Values Expansion Container */}
                      {isExpanded && (
                        <div className="px-4 pb-5 pt-2 border-t border-outline-variant bg-background/40 space-y-4 animate-fadeIn">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.entries(record.values).map(([fieldName, valStr]) => (
                              <div key={fieldName} className="bg-surface-container-lowest p-2 border border-zinc-100 flex justify-between items-center">
                                <span className="text-xs font-semibold text-on-surface-variant">{fieldName}</span>
                                <span className="text-sm font-mono font-bold text-primary">{valStr || '--'}</span>
                              </div>
                            ))}
                          </div>
                          {record.notes && (
                            <div className="text-xs text-on-surface-variant border-t border-zinc-200/60 pt-3">
                              <span className="font-bold uppercase text-[9px] block tracking-wide text-ink-muted mb-1">Session Memo</span>
                              <p className="italic">{record.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB FOUR: CUSTOM OUTFIT TRIAL SCHEDULES */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <h4 className="font-serif text-lg font-bold text-primary">Fitting Appointments</h4>
            <div className="bg-surface-container-lowest border border-zinc-200 divide-y divide-outline-variant">
              {appointments.length === 0 ? (
                <p className="p-6 text-sm text-center text-ink-muted">No custom trial consultations mapped.</p>
              ) : (
                appointments.map((appt) => (
                  <div key={appt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 zebra-row text-sm font-medium">
                    <div className="space-y-1">
                      <p className="font-bold text-primary text-base">{appt.title}</p>
                      <div className="flex gap-2 items-center text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-sm font-light">calendar_today</span>
                        <span>{new Date(appt.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 self-start sm:self-center">
                      {appt.stage && (
                        <span className="bg-secondary-fixed text-on-secondary-container px-2.5 py-0.5 rounded-none text-[10px] font-bold tracking-wider uppercase">
                          {appt.stage.replace('_', ' ')}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border ${
                        appt.status === 'scheduled' ? 'border-status-partial text-status-partial bg-amber-50/40' : 'border-status-paid text-status-paid bg-emerald-50/40'
                      }`}>
                        {appt.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}