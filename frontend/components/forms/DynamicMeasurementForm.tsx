'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

// Model interface definitions matching the database schema properties
interface MeasurementTemplateField {
  id: string;
  field_name: string;
  unit: string | null;
  is_active: boolean;
}

interface DynamicMeasurementFormProps {
  customerId: string;
  templates: MeasurementTemplateField[];
  onSuccessCallback?: () => void;
  onCancelCallback?: () => void;
}

interface FormValuesPayload {
  session_label: string;
  additional_notes: string;
  [key: string]: string; // Dynamic catch-all signature wrapper for runtime-generated field inputs
}

export default function DynamicMeasurementForm({
  customerId,
  templates,
  onSuccessCallback,
  onCancelCallback
}: DynamicMeasurementFormProps) {
  const queryClient = useQueryClient();
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Filter out deactivated templates per Critical Rule 3 instructions
  const activeFields = templates.filter((field) => field.is_active);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValuesPayload>();

  // TanStack Query Mutation: Insert calculated values structure into customer_measurements table
  const saveMeasurementMutation = useMutation({
    mutationFn: async (data: FormValuesPayload) => {
      setSubmissionError(null);

      // 1. Build the dynamic JSONB dictionary by mapping field names to their inputted values
      const jsonbValuesMap = activeFields.reduce((acc: Record<string, string>, field) => {
        acc[field.field_name] = data[field.id] || '';
        return acc;
      }, {});

      // 2. Formulate execution payload matching Supabase specifications exactly
      const payload = {
        customer_id: customerId,
        label: data.session_label || `Entry - ${new Date().toLocaleDateString('en-IN')}`,
        values: jsonbValuesMap,
        notes: data.additional_notes || null
      };

      const { data: responseData, error } = await supabase
        .from('customer_measurements')
        .insert([payload])
        .select();

      if (error) {
        throw new Error(error.message);
      }
      return responseData;
    },
    onSuccess: () => {
      // Invalidate query caches to instantly update the profile screen summary logs
      queryClient.invalidateQueries({ queryKey: ['customer-measurements', customerId] });
      reset();
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      setSubmissionError(err.message || 'Failed to preserve custom measurement records.');
    }
  });

  const onSubmitHandler = (data: FormValuesPayload) => {
    saveMeasurementMutation.mutate(data);
  };

  // Safe fallback if the vendor has completely omitted template configurations inside Settings
  if (activeFields.length === 0) {
    return (
      <div className="p-6 border border-dashed border-outline-variant text-center space-y-4 bg-surface-container-lowest max-w-[400px] mx-auto">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">straighten</span>
        <div className="space-y-1">
          <p className="text-sm font-bold text-primary">No Fields Configured</p>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Set up your measurement fields in Settings first before compiling records.
          </p>
        </div>
        {onCancelCallback && (
          <button
            type="button"
            onClick={onCancelCallback}
            className="w-full min-h-[44px] border border-outline text-xs uppercase font-bold tracking-wider"
          >
            Close Form
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px] mx-auto bg-surface-container-lowest border border-zinc-200 p-5 shadow-sm animate-fadeIn">
      {/* Session Title Header */}
      <div className="border-b border-zinc-100 pb-3 mb-4 flex justify-between items-center">
        <div>
          <h3 className="font-serif text-lg font-bold text-primary">Record Measurements</h3>
          <p className="text-[11px] text-ink-muted">Capturing parameters to active client profile ledger lines.</p>
        </div>
        <span className="material-symbols-outlined text-secondary text-2xl font-light">straighten</span>
      </div>

      {submissionError && (
        <div className="p-3 bg-error-container text-on-error-container text-xs font-semibold border border-error/20 mb-4 flex gap-2">
          <span className="material-symbols-outlined text-sm shrink-0">error</span>
          <p>{submissionError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-4 text-xs font-semibold text-on-surface-variant">
        
        {/* CORE BLOCK A: IDENTIFICATION SESSION LABELS */}
        <div className="space-y-1">
          <label className="uppercase tracking-wider block">Session Entry Label *</label>
          <input
            type="text"
            placeholder="e.g., Bridal Lehenga - Oct Initial"
            {...register('session_label', { required: 'Session descriptive labels are mandatory' })}
            className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm font-medium text-on-surface focus:ring-1 focus:ring-primary focus:outline-none focus:border-primary"
          />
          {errors.session_label && (
            <span className="text-[10px] text-status-due font-bold tracking-wide block pt-0.5">{errors.session_label.message}</span>
          )}
        </div>

        <hr className="border-zinc-100" />

        {/* CORE BLOCK B: RUNTIME GENERATED GRID SCHEMAS */}
        <div>
          <p className="text-[10px] text-ink-muted uppercase tracking-widest block font-bold mb-2">Bespoke Structural Specifications</p>
          
          {/* Two-column layout grid tracking perfectly balanced for 390px mobile screens without overflows */}
          <div className="grid grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-1">
            {activeFields.map((field) => (
              <div key={field.id} className="space-y-1 bg-background p-2 border border-zinc-100 flex flex-col justify-between">
                <label className="block text-[11px] font-bold text-primary truncate" title={field.field_name}>
                  {field.field_name}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="decimal" // Forces standard numerical overlay formatting across touch devices
                    placeholder="--"
                    {...register(field.id)}
                    className="w-full h-9 px-2 bg-surface-container-lowest border border-outline-variant font-mono font-bold text-primary text-sm focus:ring-1 focus:ring-primary text-left"
                  />
                  {field.unit && (
                    <span className="absolute right-2 text-[10px] font-bold text-ink-muted lowercase tracking-tight select-none pointer-events-none bg-surface-container-lowest pl-1">
                      {field.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-zinc-100" />

        {/* CORE BLOCK C: INTERNAL TEXT ANNOTATIONS MEMO */}
        <div className="space-y-1">
          <label className="uppercase tracking-wider block">Specific Custom Exceptions / Notes</label>
          <textarea
            rows={2}
            placeholder="e.g., Margin extensions needed across chest lines..."
            {...register('additional_notes')}
            className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant text-sm font-medium text-on-surface focus:ring-1 focus:ring-primary focus:outline-none focus:border-primary"
          />
        </div>

        {/* ACTION BUTTON CONTROLS BLOCK MATRIX */}
        <div className="pt-2 flex gap-3">
          {onCancelCallback && (
            <button
              type="button"
              onClick={onCancelCallback}
              className="flex-1 min-h-[44px] border border-outline text-xs uppercase font-bold tracking-wider hover:bg-surface-container-low"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saveMeasurementMutation.isPending}
            className="flex-1 min-h-[44px] bg-primary text-white text-xs uppercase font-bold tracking-wider hover:bg-opacity-95 disabled:opacity-50 transition-all active:scale-[0.99] flex items-center justify-center"
          >
            {saveMeasurementMutation.isPending ? 'Saving Logs...' : 'Commit Record'}
          </button>
        </div>

      </form>
    </div>
  );
}