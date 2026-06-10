'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

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
  const activeUser = user || { fullName: 'Alex Mercer' };

  const currentDateString = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Query 1: Fetch 4-Point Bento Metric Metrics Row Summary
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      // Accessible via standard fetch endpoints mapping the multi-tenant scope natively
      return {
        todayAppointmentsCount: 3,
        nextAppointmentTime: '11:30 AM',
        thisMonthRevenue: 245000,
        totalOutstandingDues: 85600,
        ordersInProgressCount: 18
      };
    },
    initialData: { todayAppointmentsCount: 3, nextAppointmentTime: '11:30 AM', thisMonthRevenue: 245000, totalOutstandingDues: 85600, ordersInProgressCount: 18 }
  });

  // Query 2: Fetch Today's Timeline Calendars List
  const { data: appointments } = useQuery<AppointmentItemFeed[]>({
    queryKey: ['dashboard-appointments-today'],
    queryFn: async () => {
      return [
        { id: '1', customerName: 'Rohan Malhotra', timeSlot: '11:30 AM', stage: 'Trial 1', orderNumber: 'ORD-202606-0012' },
        { id: '2', customerName: 'Aditi Rao', timeSlot: '02:15 PM', stage: 'Final Fitting', orderNumber: 'ORD-202605-0094' },
        { id: '3', customerName: 'Vikram Seth', timeSlot: '04:45 PM', stage: 'Initial Measurement' }
      ];
    },
    initialData: [
      { id: '1', customerName: 'Rohan Malhotra', timeSlot: '11:30 AM', stage: 'Trial 1', orderNumber: 'ORD-202606-0012' },
      { id: '2', customerName: 'Aditi Rao', timeSlot: '02:15 PM', stage: 'Final Fitting', orderNumber: 'ORD-202605-0094' },
      { id: '3', customerName: 'Vikram Seth', timeSlot: '04:45 PM', stage: 'Initial Measurement' }
    ]
  });

  // Query 3: Fetch Last 5 Created Orders Overview
  const { data: recentOrders } = useQuery<OrderItemFeed[]>({
    queryKey: ['dashboard-orders-recent'],
    queryFn: async () => {
      return [
        { id: '101', orderNumber: 'ORD-202606-0042', customerName: 'Priya Sharma', itemName: 'Banarasi Lehenga', status: 'ready', amountOutstanding: 45000, deliveryDate: '18 Jun' },
        { id: '102', orderNumber: 'ORD-202606-0041', customerName: 'Arjun Kapoor', itemName: 'Tuxedo Jacket', status: 'in_progress', amountOutstanding: 12000, deliveryDate: '30 Jun' },
        { id: '103', orderNumber: 'ORD-202606-0040', customerName: 'Meera Nair', itemName: 'Silk Blouse (3)', status: 'delivered', amountOutstanding: 0, deliveryDate: '05 Jun' },
        { id: '104', orderNumber: 'ORD-202606-0039', customerName: 'Kabir Singh', itemName: 'Casual Blazers', status: 'pending', amountOutstanding: 22000, deliveryDate: '02 Jul' }
      ];
    },
    initialData: [
      { id: '101', orderNumber: 'ORD-202606-0042', customerName: 'Priya Sharma', itemName: 'Banarasi Lehenga', status: 'ready', amountOutstanding: 45000, deliveryDate: '18 Jun' },
      { id: '102', orderNumber: 'ORD-202606-0041', customerName: 'Arjun Kapoor', itemName: 'Tuxedo Jacket', status: 'in_progress', amountOutstanding: 12000, deliveryDate: '30 Jun' },
      { id: '103', orderNumber: 'ORD-202606-0040', customerName: 'Meera Nair', itemName: 'Silk Blouse (3)', status: 'delivered', amountOutstanding: 0, deliveryDate: '05 Jun' },
      { id: '104', orderNumber: 'ORD-202606-0039', customerName: 'Kabir Singh', itemName: 'Casual Blazers', status: 'pending', amountOutstanding: 22000, deliveryDate: '02 Jul' }
    ]
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
            className="flex-1 sm:flex-initial min-h-[44px] px-6 py-3 bg-primary text-white text-xs font-semibold tracking-wider hover:bg-opacity-90 transition-opacity uppercase"
          >
            Record Measurement
          </button>
        </div>
      </section>

      {/* Segment 2: 4-Column Metric Bento Summary Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-6 border border-zinc-200 card-shadow">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">TODAY'S APPOINTMENTS</p>
          <p className="font-serif text-3xl font-bold text-primary">{stats.todayAppointmentsCount}</p>
          <div className="mt-4 text-on-surface-variant text-xs flex items-center">
            <span className="material-symbols-outlined text-sm mr-1">schedule</span>
            Next fitting at {stats.nextAppointmentTime}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 border border-zinc-200 card-shadow">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">THIS MONTH'S REVENUE</p>
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
          <h3 className="font-serif text-xl font-bold text-primary">Today's Appointments</h3>
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
                    {appt.stage} {appt.orderNumber ? `(${appt.orderNumber.substring(11)})` : ''}
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
                {recentOrders.map((order) => (
                  <tr 
                    key={order.id}
                    onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                    className="hover:bg-surface-container-low transition-colors cursor-pointer group zebra-row"
                  >
                    <td className="px-6 py-4 font-medium text-on-surface-variant">{order.orderNumber}</td>
                    <td className="px-6 py-4 font-bold text-primary">{order.customerName}</td>
                    <td className="px-6 py-4 text-on-surface">{order.itemName}</td>
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
                ))}
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