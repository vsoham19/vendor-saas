'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrders } from '@/hooks/useOrders';

interface OrderListItem {
  id: string;
  order_number: string;
  customer_id: string;
  description: string | null;
  total_amount: number;
  delivery_date: string | null;
  status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
  created_at: string;
  customers: {
    full_name: string;
    phone: string;
  } | null;
}

export default function OrdersListPage() {
  const router = useRouter();
  const { useList } = useOrders();
  
  // Local Filter States
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch orders with status filter hook
  const { data: orders = [], isLoading } = useList(statusFilter);

  // Cast orders to matching UI interface type structure
  const typedOrders = orders as unknown as OrderListItem[];

  // Client side fuzzy match filter by order number or customer name/phone
  const filteredOrders = typedOrders.filter(order => {
    const customer = order.customers;
    const orderNumMatch = order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    const nameMatch = customer?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const phoneMatch = customer?.phone.includes(searchQuery) || false;
    const descriptionMatch = order.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    
    return orderNumMatch || nameMatch || phoneMatch || descriptionMatch;
  });

  return (
    <>
      {/* Module Title Section */}
      <section className="flex justify-between items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Orders</h2>
          <p className="text-sm text-on-surface-variant">Track boutique outfits custom design invoices, statuses and due balances</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/orders/create')}
          className="min-h-[44px] px-5 py-2.5 bg-primary text-white text-xs font-bold tracking-wider uppercase hover:bg-opacity-95 transition-all flex items-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
          <span className="hidden sm:inline">New Order</span>
        </button>
      </section>

      {/* Filter Options and Search Bar Wrapper */}
      <section className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        {/* Status filtering segment controller */}
        <div className="flex gap-1 overflow-x-auto bg-surface-container-low p-1.5 scrollbar-none">
          {['all', 'pending', 'in_progress', 'ready', 'delivered', 'cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`min-h-[36px] px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-none transition-all whitespace-nowrap ${
                statusFilter === st ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Dynamic Search Box Input */}
        <div className="relative flex-grow">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Search orders by number, client, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-all text-on-surface placeholder:text-ink-muted"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm hover:text-primary"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Dynamic Orders Table Layout View */}
      <section className="bg-surface-container-lowest border border-zinc-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-on-surface-variant">Synchronizing boutique invoices ledger...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <span className="material-symbols-outlined text-4xl text-outline-variant">shopping_cart</span>
            <p className="text-sm text-ink-muted">No custom orders found matching parameters.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">
                <tr>
                  <th className="px-6 py-3.5">ORDER NUMBER</th>
                  <th className="px-6 py-3.5">CUSTOMER</th>
                  <th className="px-6 py-3.5">DESCRIPTION SUMMARY</th>
                  <th className="px-6 py-3.5">STATUS</th>
                  <th className="px-6 py-3.5">DELIVERY PROMISE</th>
                  <th className="px-6 py-3.5 text-right">TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-outline-variant font-medium">
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id}
                    onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                    className="hover:bg-surface-container-low transition-colors cursor-pointer group zebra-row text-on-surface"
                  >
                    <td className="px-6 py-4 font-bold text-primary">{order.order_number}</td>
                    <td className="px-6 py-4">
                      {order.customers ? (
                        <div>
                          <p className="font-bold text-on-surface">{order.customers.full_name}</p>
                          <p className="text-[10px] text-ink-muted">{order.customers.phone}</p>
                        </div>
                      ) : (
                        <span className="text-ink-muted">Unassigned Client</span>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate text-on-surface-variant">
                      {order.description || '--'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                        order.status === 'ready' ? 'bg-secondary-container text-on-secondary-container' :
                        order.status === 'delivered' ? 'bg-status-paid text-white' : 
                        order.status === 'in_progress' ? 'bg-surface-container-highest text-on-surface-variant' :
                        order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {order.status === 'ready' ? 'Ready for Trial' : order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {order.delivery_date 
                        ? new Date(order.delivery_date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) 
                        : 'Continuous'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      ₹{order.total_amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
