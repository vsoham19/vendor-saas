'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/utils/supabase';

interface DashboardStats {
  todayAppointmentsCount: number;
  nextAppointmentTime: string | null;
  thisMonthRevenue: number;
  totalOutstandingDues: number;
  ordersInProgressCount: number;
}

interface OrderItemFeed {
  id: string;
  orderNumber: string;
  customerName: string;
  itemName: string;
  status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
  amountOutstanding: number;
  deliveryDate: string;
}

interface AppointmentItemFeed {
  id: string;
  customerName: string;
  timeSlot: string;
  stage: string;
  orderNumber?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const activeUser = user || { fullName: 'Soham Vaghasia' };

  const currentDateString = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Query 1: Fetch 4-Point Bento Metric Metrics Row Summary
  const { data: stats = { todayAppointmentsCount: 0, nextAppointmentTime: null, thisMonthRevenue: 0, totalOutstandingDues: 0, ordersInProgressCount: 0 } } = useQuery<DashboardStats>({
    queryKey: ['dashboard-metrics', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return { todayAppointmentsCount: 0, nextAppointmentTime: null, thisMonthRevenue: 0, totalOutstandingDues: 0, ordersInProgressCount: 0 };
      
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // A. Count today's appointments
      const { data: apptsToday } = await supabase
        .from('appointments')
        .select('id, scheduled_date, time_slot')
        .eq('vendor_id', user.vendorId)
        .gte('scheduled_date', startOfToday.toISOString())
        .lte('scheduled_date', endOfToday.toISOString())
        .order('scheduled_date', { ascending: true });

      const nextAppt = (apptsToday || []).find(appt => new Date(appt.scheduled_date) > new Date());
      const nextTime = nextAppt ? nextAppt.time_slot : (apptsToday?.[0]?.time_slot || null);

      // B. Sum of this month's revenue (from payments table)
      const { data: paymentsThisMonth } = await supabase
        .from('payments')
        .select('amount, customers!inner(vendor_id)')
        .eq('customers.vendor_id', user.vendorId)
        .gte('created_at', startOfMonth.toISOString());

      const monthlyRev = (paymentsThisMonth || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // C. Sum of all outstanding dues on orders
      const { data: outstandingOrders } = await supabase
        .from('orders')
        .select('amount_outstanding')
        .eq('vendor_id', user.vendorId);

      const outstanding = (outstandingOrders || []).reduce((sum, o) => sum + Number(o.amount_outstanding || 0), 0);

      // D. Count of orders in progress
      const { data: progressOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('vendor_id', user.vendorId)
        .eq('status', 'in_progress');

      return {
        todayAppointmentsCount: apptsToday?.length || 0,
        nextAppointmentTime: nextTime,
        thisMonthRevenue: monthlyRev,
        totalOutstandingDues: outstanding,
        ordersInProgressCount: progressOrders?.length || 0
      };
    },
    enabled: !!user?.vendorId
  });

  // Query 2: Fetch Today's Timeline Calendars List
  const { data: appointments = [] } = useQuery<AppointmentItemFeed[]>({
    queryKey: ['dashboard-appointments-today', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(full_name, name), orders(order_number)')
        .eq('vendor_id', user.vendorId)
        .gte('scheduled_date', startOfToday.toISOString())
        .lte('scheduled_date', endOfToday.toISOString())
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((a: any) => ({
        id: a.id,
        customerName: a.customers?.full_name || a.customers?.name || 'Unknown Client',
        timeSlot: a.time_slot || 'Flexible',
        stage: a.stage ? a.stage.replace('_', ' ') : 'Intake Consultation',
        orderNumber: a.orders?.order_number || undefined
      }));
    },
    enabled: !!user?.vendorId
  });

  // Query 3: Fetch Last 5 Created Orders Overview
  const { data: recentOrders = [] } = useQuery<OrderItemFeed[]>({
    queryKey: ['dashboard-orders-recent', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(full_name, name)')
        .eq('vendor_id', user.vendorId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data || []).map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customers?.full_name || o.customers?.name || 'Unknown Client',
        itemName: o.description || 'Custom Garment Assignment',
        status: o.status,
        amountOutstanding: Number(o.amount_outstanding || 0),
        deliveryDate: o.delivery_date 
          ? new Date(o.delivery_date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'}) 
          : 'Continuous'
      }));
    },
    enabled: !!user?.vendorId
  });

  return (
    <>
      {/* Segment 1: Header Welcome Layout Blocks */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Welcome back, {activeUser.fullName.split(' ')[0]}.</h2>
          <p className="text-sm text-on-surface-variant">Today is {currentDateString}</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <button 
            onClick={() => router.push('/dashboard/customers?add=true')}
            className="flex-1 sm:flex-initial min-h-[44px] px-6 py-3 border border-secondary text-secondary text-xs font-semibold tracking-wider hover:bg-secondary-fixed transition-colors uppercase"
          >
            Add Customer
          </button>
          <button 
            onClick={() => router.push('/dashboard/measurements/new')}
            className="flex-1 sm:flex-initial min-h-[44px] px-6 py-3 bg-primary text-white text-xs font-semibold tracking-wider hover:bg-opacity-95 transition-opacity uppercase"
          >
            Record Measurement
          </button>
        </div>
      </section>

      {/* Segment 2: 4-Column Metric Bento Summary Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-6 border border-zinc-200 card-shadow">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">TODAY&apos;S APPOINTMENTS</p>
          <p className="font-serif text-3xl font-bold text-primary">{stats.todayAppointmentsCount}</p>
          <div className="mt-4 text-on-surface-variant text-xs flex items-center">
            <span className="material-symbols-outlined text-sm mr-1">schedule</span>
            {stats.nextAppointmentTime ? `Next fitting at ${stats.nextAppointmentTime}` : 'No remaining schedules today'}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 border border-zinc-200 card-shadow">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">THIS MONTH&apos;S REVENUE</p>
          <p className="font-serif text-3xl font-bold text-primary">₹{stats.thisMonthRevenue.toLocaleString('en-IN')}</p>
          <div className="mt-4 flex items-center text-status-paid text-xs font-medium">
            <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
            Synchronized cash receipts
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 border border-zinc-200 border-l-4 border-l-status-due card-shadow">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">TOTAL OUTSTANDING</p>
          <p className="font-serif text-3xl font-bold text-status-due">₹{stats.totalOutstandingDues.toLocaleString('en-IN')}</p>
          <div className="mt-4 text-on-surface-variant text-xs font-medium">
            Unpaid ledger balances
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 border border-zinc-200 card-shadow">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">ORDERS IN PROGRESS</p>
          <p className="font-serif text-3xl font-bold text-primary">{stats.ordersInProgressCount}</p>
          <div className="mt-4 text-on-surface-variant text-xs flex items-center">
            <span className="material-symbols-outlined text-sm mr-1">cut</span>
            Active in workshop production
          </div>
        </div>
      </section>

      {/* Segment 3: Daily Timeline & Active Feed Split Screen Matrix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Today's Appointments List Frame Block */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-serif text-xl font-bold text-primary">Today&apos;s Appointments</h3>
          <div className="bg-surface-container-lowest border border-zinc-200 divide-y divide-outline-variant">
            {appointments.length === 0 ? (
              <p className="p-6 text-sm text-center text-ink-muted">No appointments today</p>
            ) : (
              appointments.map((appt, idx) => (
                <div 
                  key={appt.id} 
                  onClick={() => router.push('/dashboard/appointments')}
                  className={`p-4 transition-colors cursor-pointer ${
                    idx === 0 ? 'bg-secondary-fixed/30 border-l-4 border-l-secondary' : 'hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-semibold ${idx === 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      {appt.timeSlot}
                    </span>
                    {idx === 0 && (
                      <span className="bg-secondary text-white px-2 py-0.5 text-[9px] font-bold tracking-wider">NEXT</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-primary">{appt.customerName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {appt.stage} {appt.orderNumber ? `(${appt.orderNumber})` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
          <button 
            onClick={() => router.push('/dashboard/appointments')}
            className="w-full text-center text-xs font-semibold text-on-surface-variant tracking-wider hover:text-primary transition-colors underline underline-offset-4 uppercase"
          >
            View Full Calendar
          </button>
        </div>

        {/* Recent Orders Overview Feed Data Summary Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="font-serif text-xl font-bold text-primary">Recent Orders</h3>
            <button 
              onClick={() => router.push('/dashboard/orders')}
              className="text-xs font-semibold text-secondary tracking-wider hover:underline underline-offset-4 uppercase"
            >
              All Orders
            </button>
          </div>
          <div className="bg-surface-container-lowest border border-zinc-200 overflow-x-auto w-full">
            <table className="w-full text-left min-w-[550px]">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">ORDER NUMBER</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">CUSTOMER</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">GARMENT ITEM</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">STATUS</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold text-on-surface-variant tracking-wider uppercase text-right">BALANCES DUE</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-outline-variant">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-sm text-center text-ink-muted">No orders registered</td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr 
                      key={order.id}
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                      className="hover:bg-surface-container-low transition-colors cursor-pointer group zebra-row"
                    >
                      <td className="px-6 py-4 font-medium text-on-surface-variant">{order.orderNumber}</td>
                      <td className="px-6 py-4 font-bold text-primary">{order.customerName}</td>
                      <td className="px-6 py-4 text-on-surface truncate max-w-[200px]">{order.itemName}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                          order.status === 'ready' ? 'bg-secondary-container text-on-secondary-container' :
                          order.status === 'delivered' ? 'bg-status-paid text-white' : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {order.status === 'ready' ? 'Ready for Trial' : order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${order.amountOutstanding > 0 ? 'text-status-due' : 'text-status-paid'}`}>
                        {order.amountOutstanding > 0 ? `₹${order.amountOutstanding.toLocaleString('en-IN')}` : 'Settled'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Universal Workspace Floating Action Button Action Link Shortcut Matrix Overlay Pin */}
      <button 
        onClick={() => router.push('/dashboard/orders/create')}
        className="fixed bottom-20 lg:bottom-10 right-6 lg:right-10 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 group"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
        <span className="absolute right-16 bg-primary text-white px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
          New Quick Order
        </span>
      </button>
    </>
  );
}
