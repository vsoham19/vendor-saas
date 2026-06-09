'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

export interface FieldTemplate {
  id: string;
  field_name: string;
  unit: string | null;
  display_order: number;
  is_active: boolean;
}

export function useMeasurements() {
  const queryClient = useQueryClient();

  // 1. Fetch vendor template keys to build dynamic measurement form arrays at runtime
  const useTemplates = () => useQuery<FieldTemplate[]>({
    queryKey: ['measurement-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('measurement_field_templates')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw new Error(error.message);
      return data || [];
    }
  });

  // 2. Fetch specific customer consultation snapshot logs
  const useCustomerRecords = (customerId: string) => useQuery({
    queryKey: ['customer-measurements', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_measurements')
        .select('*')
        .eq('customer_id', customerId)
        .order('recorded_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!customerId
  });

  // 3. Create a dynamic user-defined column name definition template key
  const useAddFieldTemplate = () => useMutation({
    mutationFn: async (payload: Omit<FieldTemplate, 'id' | 'display_order' | 'is_active'>) => {
      // Determine display position sequentially
      const { data: currentFields } = await supabase.from('measurement_field_templates').select('id');
      const nextOrder = (currentFields?.length || 0) + 1;

      const { data, error } = await supabase
        .from('measurement_field_templates')
        .insert([{ ...payload, display_order: nextOrder, is_active: true }])
        .select();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurement-templates'] });
    }
  });

  return { useTemplates, useCustomerRecords, useAddFieldTemplate };
}