'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomers } from '@/hooks/useCustomer';
import { useMeasurements } from '@/hooks/useMeasurements';
import DynamicMeasurementForm from '@/components/forms/DynamicMeasurementForm';

export default function NewMeasurementStandalonePage() {
  const router = useRouter();
  const { useList } = useCustomers();
  const { useTemplates } = useMeasurements();

  const { data: customers = [], isLoading: isCustomersLoading } = useList();
  const { data: templates = [], isLoading: isTemplatesLoading } = useTemplates();

  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const handleSuccess = () => {
    if (selectedCustomerId) {
      router.push(`/dashboard/customers/${selectedCustomerId}`);
    } else {
      router.push('/dashboard');
    }
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="border-b border-outline-variant pb-4">
        <button 
          onClick={handleCancel}
          className="flex items-center text-xs font-semibold text-secondary tracking-wider uppercase mb-2"
        >
          <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
          Cancel
        </button>
        <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Record Measurement</h2>
        <p className="text-sm text-on-surface-variant">Select a boutique client and log their design dimensions.</p>
      </div>

      <div className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
        <h3 className="font-serif text-base font-bold text-primary border-b border-zinc-100 pb-2">Client Selection</h3>
        
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Select Customer *</label>
          {isCustomersLoading ? (
            <div className="text-xs text-on-surface-variant">Loading clients...</div>
          ) : (
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">-- Choose active customer profile --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {selectedCustomerId && (
        <div className="animate-fadeIn">
          {isTemplatesLoading ? (
            <div className="p-10 text-center text-sm text-on-surface-variant">Loading templates...</div>
          ) : (
            <DynamicMeasurementForm
              customerId={selectedCustomerId}
              templates={templates}
              onSuccessCallback={handleSuccess}
              onCancelCallback={handleCancel}
            />
          )}
        </div>
      )}
    </div>
  );
}
