'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useAuthStore } from '@/store/authStore';

export interface OrderInput {
  customer_id: string;
  vendor_id?: string;
  description: string | null;
  total_amount: number;
  delivery_date: string | null;
  notes: string | null;
}

export interface OrderItemInput {
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
}

export function useListOrders(statusFilter?: string) {
  const { user } = useAuthStore();
  const vendorId = user?.vendorId;

  return useQuery({
    queryKey: ['orders', statusFilter, vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      let query = supabase
        .from('orders')
        .select('*, customers(full_name, phone)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
        
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!vendorId
  });
}

export function useOrderDetails(id: string) {
  const { user } = useAuthStore();
  const vendorId = user?.vendorId;

  return useQuery({
    queryKey: ['order', id, vendorId],
    queryFn: async () => {
      if (!vendorId) throw new Error('Not authenticated');
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*, customers(*)')
        .eq('id', id)
        .eq('vendor_id', vendorId)
        .single();
        
      if (orderErr) throw new Error(orderErr.message);

      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', id);
      const { data: payments } = await supabase.from('payments').select('*').eq('order_id', id).order('paid_at', { ascending: false });

      return { ...order, items: items || [], payments: payments || [] };
    },
    enabled: !!id && !!vendorId
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { order: OrderInput; items: OrderItemInput[]; advance?: { amount: number; mode: string; ref: string } | null }) => {
      // Step A: Insert master order base record (Trigger handles ORD- number auto-generation)
      const { data: newOrder, error: orderErr } = await supabase.from('orders').insert([payload.order]).select().single();
      if (orderErr) throw new Error(orderErr.message);

      // Step B: Inject itemization configurations mapping newly assigned order id bounds
      const itemizedRows = payload.items.map(item => ({
        order_id: newOrder.id,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));
      const { error: itemsErr } = await supabase.from('order_items').insert(itemizedRows);
      if (itemsErr) throw new Error(itemsErr.message);

      // Step C: Process advance token if checkbox parameter evaluates to true
      if (payload.advance && payload.advance.amount > 0) {
        const { error: payErr } = await supabase.from('payments').insert([{
          order_id: newOrder.id,
          customer_id: payload.order.customer_id,
          amount: payload.advance.amount,
          payment_mode: payload.advance.mode,
          reference_note: payload.advance.ref
        }]);
        if (payErr) throw new Error(payErr.message);
      }

      return newOrder;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customer-profile', variables.order.customer_id] });
    }
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { order_id: string; customer_id: string; amount: number; payment_mode: string; reference_note: string | null }) => {
      const { data, error } = await supabase.from('payments').insert([payload]).select();
      if (error) throw new Error(error.message);

      return data;
    },
    onSuccess: (data) => {
      const orderId = data?.[0]?.order_id;
      const custId = data?.[0]?.customer_id;
      if (orderId) queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      if (custId) queryClient.invalidateQueries({ queryKey: ['customer-profile', custId] });
    }
  });
}

export function useOrders() {
  return {
    useList: useListOrders,
    useDetails: useOrderDetails,
    useCreate: useCreateOrder,
    useRecordPayment: useRecordPayment
  };
}