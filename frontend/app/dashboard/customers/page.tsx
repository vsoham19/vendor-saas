'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useAuthStore } from '@/store/authStore';

interface CustomerListItem {
  id: string;
  full_name: string;
  phone: string;
  total_outstanding: number;
  active_orders_count: number;
}

function CustomerListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // Local UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Automatically open modal if add=true query parameter is present
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsModalOpen(true);
      // Clean up the URL query parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('add');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [searchParams]);

  // TanStack React Query v5: Fetch Vendor Customers
  const { data: customers = [], isLoading } = useQuery<CustomerListItem[]>({
    queryKey: ['customers-list', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*, orders(id, status)')
        .eq('vendor_id', user.vendorId)
        .order('full_name', { ascending: true });
        
      if (error) throw new Error(error.message);
      
      return (data || []).map((customer: any) => ({
        id: customer.id,
        full_name: customer.full_name || customer.name,
        phone: customer.phone,
        total_outstanding: Number(customer.total_outstanding || 0),
        active_orders_count: (customer.orders || []).filter(
          (o: any) => o.status !== 'delivered' && o.status !== 'cancelled'
        ).length
      }));
    },
    enabled: !!user?.vendorId
  });

  // Client Side Fuzzy/Exact Match Filter Engine for Name or Phone Lookups
  const filteredCustomers = customers.filter(customer => 
    customer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  // Supabase Database Mutation for instant client insertion
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: { full_name: string; phone: string }) => {
      setFormError(null);
      
      if (!user?.vendorId) {
        throw new Error('No store linked to your account. Please complete onboarding first.');
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          full_name: payload.full_name,
          name: payload.full_name,
          phone: payload.phone,
          vendor_id: user.vendorId
        }])
        .select();
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      setIsModalOpen(false);
      setNewName('');
      setNewPhone('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Customer validation failed. Check unique parameters.');
    }
  });

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) {
      setFormError('Name and valid phone matching fields are required.');
      return;
    }
    createCustomerMutation.mutate({ full_name: newName, phone: newPhone });
  };

  return (
    <>
      {/* Module Title Section */}
      <section className="flex justify-between items-center gap-4">
        <div>
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Customers</h2>
          <p className="text-sm text-on-surface-variant">Manage clients profile files, historical ledgers and dues</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="min-h-[44px] px-5 py-2.5 bg-primary text-white text-xs font-bold tracking-wider uppercase hover:bg-opacity-95 transition-all flex items-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          <span className="hidden sm:inline">Add Customer</span>
        </button>
      </section>

      {/* Interactive Mobile-First Search Action Bar */}
      <section className="w-full">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
            search
          </span>
          <input
            type="text"
            inputMode="search"
            placeholder="Search customer profiles by name or contact number..."
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

      {/* Dynamic Scannable Customer Ledger Cards / Tables */}
      <section className="bg-surface-container-lowest border border-zinc-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-on-surface-variant">Synchronizing database ledger lines...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <span className="material-symbols-outlined text-4xl text-outline-variant">person_search</span>
            <p className="text-sm text-ink-muted">No client matching parameters found.</p>
          </div>
        ) : (
          <div className="w-full divide-y divide-outline-variant">
            {/* Desktop and Tablet High-Information Table Header Layout View */}
            <div className="hidden sm:grid sm:grid-cols-12 bg-surface-container-low px-6 py-3.5 text-[10px] font-bold text-on-surface-variant tracking-wider uppercase">
              <div className="col-span-4">Full Name</div>
              <div className="col-span-3">Contact Number</div>
              <div className="col-span-2 text-center">Active Orders</div>
              <div className="col-span-3 text-right">Outstanding Dues</div>
            </div>

            {/* Loop Segment optimized for seamless multi-platform responsive interactions */}
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-0 px-4 sm:px-6 py-4 text-sm items-center hover:bg-surface-container-low transition-colors cursor-pointer zebra-row group min-h-[64px]"
              >
                {/* Mobile First Block Sizing Priorities */}
                <div className="col-span-4 font-bold text-primary sm:text-on-surface sm:font-semibold flex items-center justify-between sm:block">
                  <span className="truncate pr-2">{customer.full_name}</span>
                  <span className="sm:hidden material-symbols-outlined text-on-surface-variant text-lg">arrow_forward</span>
                </div>
                
                <div className="col-span-3 text-xs text-on-surface-variant font-medium tracking-wide">
                  {customer.phone}
                </div>
                
                <div className="col-span-2 text-xs sm:text-center text-on-surface-variant sm:text-on-surface">
                  <span className="sm:hidden text-ink-muted mr-1">Active Orders:</span>
                  <span className="bg-surface-container px-2 py-0.5 font-medium">{customer.active_orders_count}</span>
                </div>
                
                <div className="col-span-3 text-left sm:text-right font-bold pt-1 sm:pt-0">
                  <span className="sm:hidden text-ink-muted text-xs font-normal mr-1.5">Outstanding Balance:</span>
                  <span className={customer.total_outstanding > 0 ? 'text-status-due' : 'text-status-paid'}>
                    {customer.total_outstanding > 0 ? `₹${customer.total_outstanding.toLocaleString('en-IN')}` : 'Settled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Slide-Over/Overlay Sheet for Instant Customer Insertion */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-zinc-950/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-background w-full sm:max-w-md p-6 border-t sm:border border-outline-variant max-h-[90vh] overflow-y-auto space-y-6 shadow-xl">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="font-serif text-lg font-bold text-primary">Add New Client</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer p-1"
              >
                close
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-error-container text-on-error-container text-xs font-semibold border border-error/20 flex gap-2">
                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Priya Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Contact Phone *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g., 9810012345"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={createCustomerMutation.isPending}
                className="w-full min-h-[44px] bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-opacity-95 transition-all"
              >
                {createCustomerMutation.isPending ? 'Saving Record...' : 'Confirm Registration'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function CustomerListPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-on-surface-variant">Loading customers...</div>}>
      <CustomerListContent />
    </Suspense>
  );
}