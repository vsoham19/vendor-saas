'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

export interface Customer {
  id: string;
  vendor_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  total_outstanding: number;
  created_at: string;
}

export function useCustomers() {
  const queryClient = useQueryClient();

  // 1. Hook to fetch all customers scoped to the active vendor session
  const useList = () => useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('full_name', { ascending: true });
        
      if (error) throw new Error(error.message);
      return data || [];
    }
  });

  // 2. Hook to fetch a single customer's full profile
  const useProfile = (id: string) => useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id
  });

  // 3. Hook to fetch the customer's immutable payment histories ledger
  const useLedger = (id: string) => useQuery({
    queryKey: ['customer-ledger', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, orders(order_number)')
        .eq('customer_id', id)
        .order('paid_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!id
  });

  // 4. Mutation to register/insert a new customer profile file
  const useCreate = () => useMutation({
    mutationFn: async (payload: Omit<Customer, 'id' | 'vendor_id' | 'total_outstanding' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('customers')
        .insert([payload])
        .select();

      if (error) throw new Error(error.message);
      return data?.[0];
    },
    onSuccess: () => {
      // Invalidate cache triggers to refresh data arrays seamlessly
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  return { useList, useProfile, useLedger, useCreate };
}