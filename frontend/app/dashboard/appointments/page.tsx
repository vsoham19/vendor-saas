'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useAuthStore } from '@/store/authStore';
import { buildAppointmentMessage, buildWhatsAppLink } from '@/utils/whatsapp';

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
  const { user } = useAuthStore();
  
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

  // Details Modal and Management Overlay State
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');

  // Fetch Appointments from Supabase
  const { data: appointments = [], isLoading } = useQuery<AppointmentItem[]>({
    queryKey: ['appointments-master-list', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(full_name, name, phone), orders(order_number)')
        .eq('vendor_id', user.vendorId)
        .order('scheduled_date', { ascending: true });
        
      if (error) throw new Error(error.message);
      
      return (data || []).map((appt: any) => ({
        id: appt.id,
        customer_id: appt.customer_id,
        customer_name: appt.customers?.full_name || appt.customers?.name || 'Unknown Client',
        customer_phone: appt.customers?.phone || '',
        order_number: appt.orders?.order_number || null,
        title: appt.title,
        appointment_type: appt.appointment_type,
        stage: appt.stage,
        scheduled_date: appt.scheduled_date || appt.appointment_date,
        time_slot: appt.time_slot,
        status: appt.status || 'scheduled',
        notes: appt.notes
      }));
    },
    enabled: !!user?.vendorId
  });

  // Fetch Customers for select dropdown
  const { data: customerList = [] } = useQuery({
    queryKey: ['appointments-customer-select', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, name, phone')
        .eq('vendor_id', user.vendorId)
        .order('full_name', { ascending: true });
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.vendorId
  });

  // Fetch Orders for select dropdown
  const { data: orderList = [] } = useQuery({
    queryKey: ['appointments-order-select', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customers(full_name, name)')
        .eq('vendor_id', user.vendorId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.vendorId
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
      if (!user?.vendorId) {
        throw new Error('No vendor store associated with your profile.');
      }
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
        appointment_date: scheduledDate,
        time_slot: timeSlotText || null,
        notes: notesText || null,
        status: 'scheduled',
        vendor_id: user.vendorId
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

  // Supabase Mutation: Update appointment status, scheduled date or time slot
  const updateAppointmentMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
      scheduled_date?: string;
      time_slot?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(payload)
        .eq('id', payload.id)
        .select();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-master-list'] });
      setSelectedAppointment(null);
      setIsManageOpen(false);
    }
  });

  // Background Sweep: Automatically set past scheduled appointments to completed
  React.useEffect(() => {
    if (appointments.length === 0) return;
    const now = new Date();
    const pastScheduled = appointments.filter(appt => {
      if (appt.status !== 'scheduled') return false;
      const apptDate = new Date(appt.scheduled_date);
      return apptDate < now;
    });

    if (pastScheduled.length > 0) {
      const pastIds = pastScheduled.map(appt => appt.id);
      const sweepPastAppointments = async () => {
        try {
          const { error } = await supabase
            .from('appointments')
            .update({ status: 'completed' })
            .in('id', pastIds);
          if (error) {
            console.error('Failed to auto-complete past appointments:', error);
          } else {
            queryClient.invalidateQueries({ queryKey: ['appointments-master-list'] });
          }
        } catch (err) {
          console.error('Failed to auto-complete past appointments error:', err);
        }
      };
      sweepPastAppointments();
    }
  }, [appointments, queryClient]);

  return (
    <div className="space-y-6">
      {/* Title Header Bar */}
      <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Fitting Schedules</h2>
          <p className="text-sm text-on-surface-variant">Track month-long client outfit trials and fitting checkpoints.</p>
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
              <div 
                key={appt.id} 
                onClick={() => {
                  setSelectedAppointment(appt);
                  setIsManageOpen(false);
                }}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 hover:bg-zinc-50 cursor-pointer transition-colors zebra-row text-sm"
              >
                <div className="space-y-1 sm:max-w-md">
                  <div className="flex gap-2 items-center text-xs font-mono font-bold text-secondary">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>{new Date(appt.scheduled_date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})} | {appt.time_slot || 'Flexible Window'}</span>
                  </div>
                  <h4 className="font-bold text-primary text-base hover:underline">{appt.title}</h4>
                  <p className="text-xs text-on-surface-variant font-medium">Customer Profile: <span className="text-on-surface font-bold">{appt.customer_name}</span> ({appt.customer_phone})</p>
                  {appt.notes && <p className="text-xs text-ink-muted italic pt-1">Memo: &quot;{appt.notes}&quot;</p>}
                </div>

                <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-none text-[9px] font-bold tracking-wider uppercase border ${
                    appt.appointment_type === 'walk_in' ? 'border-outline text-outline bg-zinc-50' : 'border-secondary text-secondary bg-orange-50/20'
                  }`}>
                    {appt.appointment_type === 'walk_in' ? 'Walk In Consultation' : `Order Trial: ${appt.stage?.replace('_', ' ')}`}
                  </span>
                  <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-sm ${
                    appt.status === 'scheduled' ? 'bg-primary/10 text-primary border border-primary/20' :
                    appt.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
                    appt.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>{appt.status}</span>
                  {appt.customer_phone && (
                    <a
                      href={buildWhatsAppLink(
                        appt.customer_phone,
                        buildAppointmentMessage({
                          customerName: appt.customer_name,
                          title: appt.title,
                          date: new Date(appt.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                          time: appt.time_slot,
                          status: appt.status
                        })
                      )}
                      onClick={(event) => event.stopPropagation()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-800 transition-colors"
                      title="Open WhatsApp with a prefilled appointment message"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        
        /* PRESENTATION SUB-VIEW B: SIMPLE COMPACT MONOTONE MONTH-GRID CELL ARCHITECTURE */
        (() => {
          const calNow = new Date();
          const calYear = calNow.getFullYear();
          const calMonth = calNow.getMonth(); // 0-indexed
          const calMonthName = calNow.toLocaleString('en-IN', { month: 'long' });
          const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
          const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun

          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDayIndex; i++) {
            cells.push(null);
          }
          for (let i = 1; i <= totalDays; i++) {
            cells.push(i);
          }

          return (
            <div className="bg-surface-container-lowest border border-zinc-200 p-4 shadow-xs">
              <div className="text-center font-serif text-lg font-bold text-primary mb-4">{calMonthName} {calYear}</div>
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] tracking-wider text-on-surface-variant uppercase border-b border-zinc-100 pb-2 mb-2">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>
              <div className="grid grid-cols-7 gap-2 min-h-[300px] text-xs font-medium text-ink-muted">
                {cells.map((dayNum, i) => {
                  if (dayNum === null) {
                    return <div key={`empty-${i}`} className="min-h-[60px] bg-zinc-50/40 border border-zinc-50"></div>;
                  }

                  const dayAppts = appointments.filter(appt => {
                    const d = new Date(appt.scheduled_date);
                    return d.getDate() === dayNum && d.getMonth() === calMonth && d.getFullYear() === calYear;
                  });

                  const hasAppt = dayAppts.length > 0;

                  return (
                    <div 
                      key={`day-${dayNum}`} 
                      className={`min-h-[60px] p-1 border border-zinc-100 flex flex-col justify-between items-start transition-colors ${
                        hasAppt ? 'bg-secondary-fixed/5 border-secondary/20' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <span className={`font-bold text-[10px] ${hasAppt ? 'text-secondary' : 'text-zinc-400'}`}>{dayNum}</span>
                      
                      {hasAppt && (
                        <div className="w-full space-y-1 mt-1">
                          {dayAppts.slice(0, 3).map(appt => (
                            <button
                              key={appt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppointment(appt);
                                setIsManageOpen(false);
                              }}
                              title={appt.title}
                              className="w-full text-left truncate text-[9px] bg-secondary text-white font-semibold px-1 py-0.5 rounded-sm hover:brightness-95 transition-all block"
                            >
                              {appt.title}
                            </button>
                          ))}
                          {dayAppts.length > 3 && (
                            <span className="text-[8px] text-ink-muted block text-right font-bold">+{dayAppts.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-ink-muted italic mt-4 text-center">Click on any colored trial banner in the cells above to read profile specifications and manage appointments.</p>
            </div>
          );
        })()
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
                  {customerList.map((cust: any) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.full_name || cust.name} ({cust.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-50 border border-zinc-100">
                <div>
                  <label className="block font-bold text-primary uppercase">Link to Existing Order Invoice?</label>
                  <p className="text-[10px] text-ink-muted">Enables step-by-step tailored production pipeline tracking.</p>
                </div>
                <input type="checkbox" checked={linkToOrder} onChange={(e) => setLinkToOrder(e.target.checked)} className="h-5 w-5 border-outline-variant text-primary focus:ring-primary cursor-pointer" />
              </div>

              {linkToOrder && (
                <div className="grid grid-cols-2 gap-4 pt-1 animate-fadeIn">
                  <div className="space-y-1">
                    <label className="block font-bold text-on-surface-variant uppercase">Select Order</label>
                    <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="w-full min-h-[44px] px-2 bg-surface-container-low border border-outline-variant">
                      <option value="">-- Select active ID --</option>
                      {orderList.map((order: any) => (
                        <option key={order.id} value={order.id}>
                          {order.order_number} ({order.customers?.full_name || order.customers?.name || 'Unknown'})
                        </option>
                      ))}
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

      {/* DETAILS CARD MODAL */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-zinc-950/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-background w-full sm:max-w-md p-6 border-t sm:border border-outline-variant max-h-[90vh] overflow-y-auto space-y-5 shadow-xl">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-outline-variant pb-3">
              <div>
                <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase border rounded-xs ${
                  selectedAppointment.appointment_type === 'walk_in' ? 'border-outline text-outline bg-zinc-50' : 'border-secondary text-secondary bg-orange-50/20'
                }`}>
                  {selectedAppointment.appointment_type === 'walk_in' ? 'Walk In Consultation' : 'Order Fitting Trial'}
                </span>
                <h3 className="font-serif text-lg font-bold text-primary mt-2">{selectedAppointment.title}</h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedAppointment(null);
                  setIsManageOpen(false);
                }} 
                className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors"
              >
                close
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-3 border border-zinc-100 rounded-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-ink-muted block">Scheduled Date</span>
                  <span className="font-bold text-primary text-xs">
                    {new Date(selectedAppointment.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-ink-muted block">Time Slot</span>
                  <span className="font-bold text-primary text-xs">{selectedAppointment.time_slot || 'Flexible Window'}</span>
                </div>
              </div>

              <div className="space-y-2 border-b border-outline-variant pb-3">
                <span className="text-[9px] uppercase font-bold text-ink-muted block">Client Details</span>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-on-surface text-sm">{selectedAppointment.customer_name}</p>
                    <p className="font-mono text-on-surface-variant">{selectedAppointment.customer_phone}</p>
                  </div>
                  <a 
                    href={`/dashboard/customers?id=${selectedAppointment.customer_id}`}
                    className="text-[9px] font-bold uppercase tracking-wider text-secondary bg-orange-50 border border-secondary/20 px-2.5 py-1 hover:bg-orange-100 transition-all rounded-xs"
                  >
                    View Profile
                  </a>
                </div>
              </div>

              {selectedAppointment.order_number && (
                <div className="space-y-2 border-b border-outline-variant pb-3">
                  <span className="text-[9px] uppercase font-bold text-ink-muted block">Linked Order</span>
                  <p className="font-bold text-on-surface text-sm">Invoice No: {selectedAppointment.order_number}</p>
                </div>
              )}

              {selectedAppointment.stage && (
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-ink-muted block">Production Checkpoint Stage</span>
                  <p className="font-medium text-secondary uppercase tracking-wide text-[9px] bg-orange-50 border border-secondary/15 inline-block px-2 py-0.5 rounded-xs">
                    {selectedAppointment.stage.replace('_', ' ')}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-ink-muted block">Internal Notes</span>
                <p className="text-on-surface-variant italic bg-zinc-50 p-2.5 border border-zinc-100/60 rounded-xs">
                  {selectedAppointment.notes ? `"${selectedAppointment.notes}"` : 'No custom notes annotated for this fitting session.'}
                </p>
              </div>

              <div className="flex justify-between items-center border-t border-outline-variant pt-3">
                <div>
                  <span className="text-[9px] uppercase font-bold text-ink-muted block">Current Status</span>
                  <span className={`text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-0.5 border rounded-xs ${
                    selectedAppointment.status === 'scheduled' ? 'bg-primary/10 text-primary border-primary/20' :
                    selectedAppointment.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                    selectedAppointment.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedAppointment.status}
                  </span>
                </div>
                
                {!isManageOpen ? (
                  <button 
                    onClick={() => {
                      setIsManageOpen(true);
                      setRescheduleDate(selectedAppointment.scheduled_date.substring(0, 10));
                      setRescheduleTimeSlot(selectedAppointment.time_slot || '');
                    }}
                    className="min-h-[36px] px-4 bg-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-opacity-95 flex items-center gap-1.5 cursor-pointer rounded-xs"
                  >
                    <span className="material-symbols-outlined text-base">settings</span> Manage Schedule
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsManageOpen(false)}
                    className="min-h-[36px] px-4 border border-outline text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 cursor-pointer rounded-xs"
                  >
                    Hide Panel
                  </button>
                )}
              </div>

              {selectedAppointment.customer_phone && (
                <a
                  href={buildWhatsAppLink(
                    selectedAppointment.customer_phone,
                    buildAppointmentMessage({
                      customerName: selectedAppointment.customer_name,
                      title: selectedAppointment.title,
                      date: new Date(selectedAppointment.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                      time: selectedAppointment.time_slot,
                      status: selectedAppointment.status
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[38px] bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-emerald-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  Send WhatsApp Message
                </a>
              )}
            </div>

            {/* EXPANDABLE MANAGEMENT AND RESCHEDULING PANEL */}
            {isManageOpen && (
              <div className="border-t border-outline-variant pt-4 space-y-4 text-xs animate-fadeIn">
                <h4 className="font-serif text-sm font-bold text-primary">Resolve Status Checkpoints</h4>
                
                {/* Resolution Action Strip */}
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => updateAppointmentMutation.mutate({
                      id: selectedAppointment.id,
                      status: 'completed',
                      scheduled_date: new Date().toISOString().substring(0, 10),
                      time_slot: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    })}
                    disabled={updateAppointmentMutation.isPending}
                    className="flex flex-col items-center justify-center p-2.5 bg-green-50 hover:bg-green-100/80 border border-green-200 text-green-800 rounded-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg mb-1">check_circle</span>
                    <span className="font-bold text-[8px] uppercase tracking-wider">Attend Now</span>
                  </button>
                  <button 
                    onClick={() => updateAppointmentMutation.mutate({
                      id: selectedAppointment.id,
                      status: 'no_show'
                    })}
                    disabled={updateAppointmentMutation.isPending}
                    className="flex flex-col items-center justify-center p-2.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-800 rounded-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg mb-1">person_off</span>
                    <span className="font-bold text-[8px] uppercase tracking-wider">No-Show</span>
                  </button>
                  <button 
                    onClick={() => updateAppointmentMutation.mutate({
                      id: selectedAppointment.id,
                      status: 'cancelled'
                    })}
                    disabled={updateAppointmentMutation.isPending}
                    className="flex flex-col items-center justify-center p-2.5 bg-red-50 hover:bg-red-100/80 border border-red-200 text-red-800 rounded-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg mb-1">cancel</span>
                    <span className="font-bold text-[8px] uppercase tracking-wider">Cancel</span>
                  </button>
                </div>

                <div className="border-t border-zinc-150 my-2" />

                {/* Rescheduling (Prepone / Postpone) */}
                <h4 className="font-serif text-sm font-bold text-primary">Reschedule (Prepone / Postpone)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase">New Date</label>
                    <input 
                      type="date" 
                      value={rescheduleDate} 
                      onChange={(e) => setRescheduleDate(e.target.value)} 
                      className="w-full min-h-[38px] px-2 bg-surface-container-low border border-outline-variant focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-on-surface-variant uppercase">Time Slot</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 02:00 PM"
                      value={rescheduleTimeSlot} 
                      onChange={(e) => setRescheduleTimeSlot(e.target.value)} 
                      className="w-full min-h-[38px] px-3 bg-surface-container-low border border-outline-variant focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => updateAppointmentMutation.mutate({
                    id: selectedAppointment.id,
                    scheduled_date: rescheduleDate,
                    time_slot: rescheduleTimeSlot,
                    status: 'scheduled'
                  })}
                  disabled={updateAppointmentMutation.isPending || !rescheduleDate}
                  className="w-full min-h-[40px] bg-secondary text-white text-xs font-bold uppercase tracking-wider hover:bg-opacity-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 rounded-xs"
                >
                  <span className="material-symbols-outlined text-base">calendar_today</span> Save New Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
