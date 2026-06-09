'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

export interface AppointmentPayload {
  customer_id: string;
  order_id: string | null;
  title: string;
  appointment_type: 'walk_in' | 'linked_to_order';
  stage: 'initial_measurement' | 'trial_1' | 'trial_2' | 'final_fitting' | 'delivery' | null;
  scheduled_date: string;
  time_slot: string | null;
  notes: string | null;
}

export function useAppointments() {
  const queryClient = useQueryClient();

  // 1. Pull appointments matching filter scopes
  const useList = (status?: string) => useQuery({
    queryKey: ['appointments', status],
    queryFn: async () => {
      let query = supabase.from('appointments').select('*, customers(full_name, phone)');
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      const { data, error } = await query.order('scheduled_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    }
  });

  // 2. Schedule client fitting sessions
  const useCreate = () => useMutation({
    mutationFn: async (payload: AppointmentPayload) => {
      const { data, error } = await supabase.from('appointments').insert([payload]).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  });

  // 3. Reschedule or patch session status parameters
  const useUpdateStatus = () => useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'completed' | 'cancelled' | 'no_show' }) => {
      const { data, error } = await supabase.from('appointments').update({ status }).eq('id', id).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  });

  return { useList, useCreate, useUpdateStatus };
}