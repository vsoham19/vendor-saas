'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMeasurements } from '@/hooks/useMeasurements';
import DynamicMeasurementForm from '@/components/forms/DynamicMeasurementForm';

export default function NewCustomerMeasurementPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  
  const { useTemplates } = useMeasurements();
  const { data: templates = [], isLoading, isError, error } = useTemplates();

  const handleSuccess = () => {
    // Redirect back to the customer profile measurements tab
    router.push(`/dashboard/customers/${customerId}`);
  };

  const handleCancel = () => {
    // Redirect back to the customer profile overview tab
    router.push(`/dashboard/customers/${customerId}`);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="border-b border-outline-variant pb-4">
        <button 
          onClick={handleCancel}
          className="flex items-center text-xs font-semibold text-secondary tracking-wider uppercase mb-2"
        >
          <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
          Back to Profile
        </button>
        <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">New Measurement</h2>
        <p className="text-sm text-on-surface-variant">Record design measurements and fitting sizes directly to client history.</p>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-on-surface-variant">Loading boutique measurement templates...</div>
      ) : isError ? (
        <div className="p-4 bg-error-container text-on-error-container border border-error/20 text-xs font-medium flex gap-2">
          <span className="material-symbols-outlined text-base shrink-0">error</span>
          <p>Error retrieving templates: {error?.message || 'Unknown error occurred.'}</p>
        </div>
      ) : (
        <DynamicMeasurementForm 
          customerId={customerId} 
          templates={templates}
          onSuccessCallback={handleSuccess}
          onCancelCallback={handleCancel}
        />
      )}
    </div>
  );
}
