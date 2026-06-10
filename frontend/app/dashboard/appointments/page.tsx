'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

interface AppointmentItem {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  order_number: string | null;
  title: string;
  appointment_type: 'walk_in' | 'linked_to_order';
  stage: 'initial_measurement' | 'trial_1' | 'trial_2' | 'final_fitting' | 'delivery' | null;
  scheduled_date: string;
  time_slot: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
}

export default function AppointmentCalendarPage() {
  const queryClient = useQueryClient();
  
  // View Toggle State: 'list' or 'calendar'
  const [viewType, setViewType] = useState<'list' | 'calendar'>('list');
  
  // Status Listing Filtering Context
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // New Appointment Form Matrix Local Capture States
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [linkToOrder, setLinkToOrder] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [fittingStage, setFittingStage] = useState('trial_1');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().substring(0, 10));
  const [timeSlotText, setTimeSlotText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);

  // TanStack Query: Fetch Appointments Data Tree Set
  const { data: appointments = [], isLoading } = useQuery<AppointmentItem[]>({
    queryKey: ['appointments-master-list'],
    queryFn: async () => {
      return [
        { id: 'ap1', customer_id: 'c1', customer_name: 'Rohan Malhotra', customer_phone: '9811223344', order_number: 'ORD-202606-0012', title: 'Sherwani First Trial Fit Checks', appointment_type: 'linked_to_order', stage: 'trial_1', scheduled_date: '2026-06-15', time_slot: '11:30 AM', status: 'scheduled', notes: 'Verify sleeve lengths specifically with shirts worn.' },
        { id: 'ap2', customer_id: 'c2', customer_name: 'Aditi Rao', customer_phone: '9988776655', order_number: 'ORD-202605-0094', title: 'Evening Gown Final Alteration Checks', appointment_type: 'linked_to_order', stage: 'final_fitting', scheduled_date: '2026-06-15', time_slot: '02:15 PM', status: 'scheduled', notes: null },
        { id: 'ap3', customer_id: 'c3', customer_name: 'Vikram Seth', customer_phone: '9123456789', order_number: null, title: 'Bespoke Suit Fabric Intake Measurement', appointment_type: 'walk_in', stage: null, scheduled_date: '2026-06-16', time_slot: '04:45 PM', status: 'scheduled', notes: 'Walk-in reference consultation file entry.' }
      ];
    }
  });

  // Client Side Filtering Engine logic pipeline mapping
  const filteredAppointments = appointments.filter(appt => {
    if (statusFilter === 'all') return true;
    return appt.status === statusFilter;
  });

  // Supabase Mutation: Write verified appointment entries
  const scheduleAppointmentMutation = useMutation({
    mutationFn: async () => {
      setMutationError(null);
      if (!selectedCustomerId || !appointmentTitle || !scheduledDate) {
        throw new Error('Customer assignment, title anchors and date fields are mandatory details.');
      }

      const payload = {
        customer_id: selectedCustomerId,
        order_id: linkToOrder ? selectedOrderId || null : null,
        title: appointmentTitle,
        appointment_type: linkToOrder ? 'linked_to_order' : 'walk_in',
        stage: linkToOrder ? fittingStage : null,
        scheduled_date: scheduledDate,
        time_slot: timeSlotText || null,
        notes: notesText || null,
        status: 'scheduled'
      };

      const { data, error } = await supabase.from('appointments').insert([payload]).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-master-list'] });
      setIsFormOpen(false);
      setAppointmentTitle('');
      setNotesText('');
    },
    onError: (err: any) => {
      setMutationError(err.message || 'Failed to capture appointment scheduler parameters.');
    }
  });

  return (
    <div className="space-y-6">
      {/* Title Header Bar */}
      <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Fitting Schedules</h2>
          <p className="text-sm text-on-surface-variant">Track month-long client outfit trials and fitting checkpoints[cite: 2, 36].</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="min-h-[44px] px-5 py-2.5 bg-primary text-white text-xs font-bold tracking-wider uppercase hover:bg-opacity-95 flex items-center gap-2 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-lg">calendar_add</span>
          Book Appointment
        </button>
      </section>

      {/* Control Navigation Filters & Sub-view Switchers Row */}
      <section className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-surface-container-low p-2">
        <div className="flex gap-1 overflow-x-auto">
          {['all', 'scheduled', 'completed', 'no_show'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`min-h-[36px] px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-none transition-all ${
                statusFilter === st ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* List View vs Calendar View Split Toggle */}
        <div className="border border-outline-variant grid grid-cols-2 text-center text-xs font-bold divide-x divide-outline-variant shrink-0 bg-background">
          <button 
            onClick={() => setViewType('list')}
            className={`px-4 py-2 flex items-center gap-2 ${viewType === 'list' ? 'bg-zinc-200 text-primary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-sm">view_list</span> List
          </button>
          <button 
            onClick={() => setViewType('calendar')}
            className={`px-4 py-2 flex items-center gap-2 ${viewType === 'calendar' ? 'bg-zinc-200 text-primary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span> Calendar
          </button>
        </div>
      </section>

      {/* Dynamic Render Surface Area */}
      {isLoading ? (
        <p className="text-center text-xs p-10 text-on-surface-variant">Synchronizing calendar pipelines...</p>
      ) : viewType === 'list' ? (
        
        /* PRESENTATION SUB-VIEW A: TIMELINE CHRONOLOGICAL DATA LISTING */
        <div className="bg-surface-container-lowest border border-zinc-200 divide-y divide-outline-variant overflow-hidden">
          {filteredAppointments.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">No consultations found matching your filters.</p>
          ) : (
            filteredAppointments.map(appt => (
              <div key={appt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 hover:bg-zinc-50/50 transition-colors zebra-row text-sm">
                <div className="space-y-1 sm:max-w-md">
                  <div className="flex gap-2 items-center text-xs font-mono font-bold text-secondary">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>{new Date(appt.scheduled_date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})} | {appt.time_slot || 'Flexible Window'}</span>
                  </div>
                  <h4 className="font-bold text-primary text-base">{appt.title}</h4>
                  <p className="text-xs text-on-surface-variant font-medium">Customer Profile: <span className="text-on-surface font-bold">{appt.customer_name}</span> ({appt.customer_phone})</p>
                  {appt.notes && <p className="text-xs text-ink-muted italic pt-1">Memo: &quot;{appt.notes}&quot;</p>}
                </div>

                <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-none text-[9px] font-bold tracking-wider uppercase border ${
                    appt.appointment_type === 'walk_in' ? 'border-outline text-outline bg-zinc-50' : 'border-secondary text-secondary bg-orange-50/20'
                  }`}>
                    {appt.appointment_type === 'walk_in' ? 'Walk In Consultation' : `Order Trial: ${appt.stage?.replace('_', ' ')}`}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-ink-muted bg-surface-container px-2 py-0.5">{appt.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        
        /* PRESENTATION SUB-VIEW B: SIMPLE COMPACT MONOTONE MONTH-GRID CELL ARCHITECTURE */
        <div className="bg-surface-container-lowest border border-zinc-200 p-4 shadow-xs">
          <div className="text-center font-serif text-lg font-bold text-primary mb-4">June 2026</div>
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] tracking-wider text-on-surface-variant uppercase border-b border-zinc-100 pb-2 mb-2">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="grid grid-cols-7 gap-2 min-h-[260px] text-xs font-medium text-ink-muted">
            {/* Minimal architectural block representation sample matrix mapping June 2026 calendar days explicitly */}
            {Array.from({ length: 31 }).map((_, i) => {
              const dayNum = i + 1;
              const hasAppt = dayNum === 15 || dayNum === 16;
              return (
                <div key={i} className={`min-h-[50px] p-1 border border-zinc-100 flex flex-col justify-between items-start transition-colors ${hasAppt ? 'bg-secondary-fixed/20 border-secondary/30' : ''}`}>
                  <span className={`font-bold ${hasAppt ? 'text-secondary' : 'text-zinc-400'}`}>{dayNum}</span>
                  {hasAppt && <div className="h-2 w-2 rounded-full bg-secondary self-end mr-1 mb-1"></div>}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-ink-muted italic mt-4 text-center">Dates containing dots show tailored trial check sessions. Select list view to read individual client profiles.</p>
        </div>
      )}

      {/* OVERLAY DRAWER SHEET: OVERLAY APPOINTMENT SCHEDULER ENTRY FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-zinc-950/40 backdrop-blur-xs">
          <div className="bg-background w-full sm:max-w-md p-6 border-t sm:border border-outline-variant max-h-[90vh] overflow-y-auto space-y-5 shadow-xl">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <h3 className="font-serif text-lg font-bold text-primary">Log Trial Fitting Check</h3>
              <button onClick={() => setIsFormOpen(false)} className="material-symbols-outlined text-on-surface-variant cursor-pointer">close</button>
            </div>

            {mutationError && <p className="p-2 bg-error-container text-on-error-container text-xs font-semibold">{mutationError}</p>}

            <form onSubmit={(e) => { e.preventDefault(); scheduleAppointmentMutation.mutate(); }} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-on-surface-variant uppercase">Assign Customer Profile *</label>
                <select required value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full min-h-[44px] px-2 bg-surface-container-low border border-outline-variant">
                  <option value="">-- Select active profile --</option>
                  <option value="c1">Rohan Malhotra (9811223344)</option>
                  <option value="c2">Aditi Rao (9988776655)</option>
                  <option value="c3">Vikram Seth (9123456789)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-50 border border-zinc-100">
                <div>
                  <label className="block font-bold text-primary uppercase">Link to Existing Order Invoice?</label>
                  <p className="text-[10px] text-ink-muted">Enables step-by-step tailored production pipeline tracking[cite: 2].</p>
                </div>
                <input type="checkbox" checked={linkToOrder} onChange={(e) => setLinkToOrder(e.target.checked)} className="h-5 w-5 border-outline-variant text-primary focus:ring-primary cursor-pointer" />
              </div>

              {linkToOrder && (
                <div className="grid grid-cols-2 gap-4 pt-1 animate-fadeIn">
                  <div className="space-y-1">
                    <label className="block font-bold text-on-surface-variant uppercase">Select Order</label>
                    <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="w-full min-h-[44px] px-2 bg-surface-container-low border border-outline-variant">
                      <option value="">-- Select active ID --</option>
                      <option value="o1">ORD-202606-0012</option>
                      <option value="o2">ORD-202605-0094</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-on-surface-variant uppercase">Trial Target Stage</label>
                    <select value={fittingStage} onChange={(e) => setFittingStage(e.target.value)} className="w-full min-h-[44px] px-2 bg-surface-container-low border border-outline-variant font-medium">
                      <option value="initial_measurement">Initial Intake Measurements</option>
                      <option value="trial_1">Trial fitting checkpoint 1</option>
                      <option value="trial_2">Trial fitting checkpoint 2</option>
                      <option value="final_fitting">Final fitting evaluation</option>
                      <option value="delivery">Final handoff hand delivery</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-on-surface-variant uppercase">Appointment Title Session Header *</label>
                <input type="text" required placeholder="e.g., Lehenga waist belt correction matching check" value={appointmentTitle} onChange={(e) => setAppointmentTitle(e.target.value)} className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-bold text-on-surface-variant uppercase">Date Mapped *</label>
                  <input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full min-h-[44px] px-2 bg-surface-container-low border border-outline-variant" />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-on-surface-variant uppercase">Time Window Slot String</label>
                  <input type="text" placeholder="e.g., 03:00 PM - 04:00 PM" value={timeSlotText} onChange={(e) => setTimeSlotText(e.target.value)} className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-on-surface-variant uppercase">Internal Session Memo Annotation</label>
                <textarea rows={2} placeholder="Any specific requirements or fabric matching adjustments parameters..." value={notesText} onChange={(e) => setNotesText(e.target.value)} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant focus:ring-1 focus:ring-primary focus:outline-none" />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 min-h-[44px] border border-outline text-xs uppercase font-bold">Cancel</button>
                <button type="submit" disabled={scheduleAppointmentMutation.isPending} className="flex-1 min-h-[44px] bg-primary text-white text-xs uppercase font-bold disabled:opacity-50">Commit Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
