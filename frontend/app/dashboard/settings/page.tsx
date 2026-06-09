'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

interface MeasurementTemplateField {
  id: string;
  field_name: string;
  unit: string | null;
  display_order: number;
  is_active: boolean;
}

interface StaffProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'assistant';
  is_active: boolean;
}

export default function AtelierStudioSettingsPage() {
  const queryClient = useQueryClient();
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Form Field Local Temporary Capture Buffers
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldUnit, setNewFieldUnit] = useState('inches');
  
  // Staff Invite Buffer
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');

  // Query A: Fetch Custom User-Defined Column Arrays
  const { data: fields = [] } = useQuery<MeasurementTemplateField[]>({
    queryKey: ['settings-measurement-fields-list'],
    queryFn: async () => {
      return [
        { id: 'f1', field_name: 'Kamar (Waist)', unit: 'inches', display_order: 1, is_active: true },
        { id: 'f2', field_name: 'Seena (Chest)', unit: 'inches', display_order: 2, is_active: true },
        { id: 'f3', field_name: 'Gala Front (Neck)', unit: 'inches', display_order: 3, is_active: true },
        { id: 'f4', field_name: 'Length (Ghara Lower)', unit: 'inches', display_order: 4, is_active: true },
        { id: 'f5', field_name: 'Mori (Ankle sleeve)', unit: 'cm', display_order: 5, is_active: false }
      ];
    }
  });

  // Query B: Fetch Studio Coworkers List
  const { data: staffList = [] } = useQuery<StaffProfileRow[]>({
    queryKey: ['settings-staff-list'],
    queryFn: async () => {
      return [
        { id: 'st1', full_name: 'Alex Mercer', email: 'alex@stitchandsoul.com', role: 'owner', is_active: true },
        { id: 'st2', full_name: 'Rahul Kumar', email: 'rahul.assistant@gmail.com', role: 'assistant', is_active: true },
        { id: 'st3', full_name: 'Priya Das', email: 'priya.stitcher@gmail.com', role: 'assistant', is_active: false }
      ];
    }
  });

  // Mutation 1: Write New Field Parameters to Schema Template Configurations
  const addFieldMutation = useMutation({
    mutationFn: async () => {
      setSectionError(null);
      if (!newFieldName) throw new Error('Field headers cannot be initialized blank.');
      
      const payload = {
        field_name: newFieldName,
        unit: newFieldUnit || null,
        display_order: fields.length + 1,
        is_active: true
      };

      const { data, error } = await supabase.from('measurement_field_templates').insert([payload]).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-measurement-fields-list'] });
      setNewFieldName('');
    }
  });

  // Mutation 2: Toggle Field State or Alter Sequence Index Order Positions
  const updateFieldMetaMutation = useMutation({
    mutationFn: async ({ fieldId, patches }: { fieldId: string; patches: Partial<MeasurementTemplateField> }) => {
      const { data, error } = await supabase.from('measurement_field_templates').update(patches).eq('id', fieldId).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-measurement-fields-list'] })
  });

  // Mutation 3: Modify Active Access Parameters for Staff Configurations
  const toggleStaffStatusMutation = useMutation({
    mutationFn: async ({ staffId, nextStatus }: { staffId: string; nextStatus: boolean }) => {
      setSectionError(null);
      // Hard Boundary Guard Constraint Logic Check matching Critical Rule 8 block conditions
      const subject = staffList.find(s => s.id === staffId);
      if (subject?.role === 'owner') throw new Error('Administrative owner roots cannot be deactivated or muted.');

      const { data, error } = await supabase.from('staff').update({ is_active: nextStatus }).eq('id', staffId).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-staff-list'] }),
    onError: (err: any) => setSectionError(err.message)
  });

  return (
    <div className="space-y-10 max-w-2xl mx-auto pb-12">
      {/* Title block */}
      <div className="border-b border-outline-variant pb-4">
        <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Studio Settings</h2>
        <p className="text-sm text-on-surface-variant">Configure workspace definitions, column keys, and staff roles.</p>
      </div>

      {sectionError && (
        <div className="p-4 bg-error-container text-on-error-container text-xs font-medium border border-error/20 flex gap-2">
          <span className="material-symbols-outlined shrink-0 text-base">error</span>
          <p>{sectionError}</p>
        </div>
      )}

      {/* SEGMENT 1: BASE STUDIO BUSINESS PROFILE FORM */}
      <section className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
        <h3 className="font-serif text-base font-bold text-primary border-b border-zinc-100 pb-2">Business Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-on-surface-variant">
          <div className="space-y-1">
            <label className="uppercase">Studio Business Name</label>
            <input type="text" defaultValue="Stitch & Soul Atelier" className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1">
            <label className="uppercase">Primary GSTIN / Tax Identity (Optional)</label>
            <input type="text" defaultValue="07AAAAA1111A1Z1" className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:ring-1 focus:ring-primary font-mono tracking-wider" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="uppercase">Physical Atelier Studio Address</label>
            <input type="text" defaultValue="H-24, Green Park Extension, New Delhi, 110016" className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:ring-1 focus:ring-primary" />
          </div>
        </div>
      </section>

      {/* SEGMENT 2: THE REGISTER KILLER — DYNAMIC VARIABLE MEASUREMENT FIELDS DEFINITIONS SETUP */}
      <section className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
        <div>
          <h3 className="font-serif text-base font-bold text-primary uppercase tracking-wide">Measurement Column Fields Definition</h3>
          <p className="text-xs text-ink-muted mt-0.5">Define your custom structural parameters. Changes instantly instantiate fields runtime across data entry sheets.</p>
        </div>

        {/* Input Block configuration setup anchor */}
        <div className="flex flex-col sm:flex-row gap-2 items-end bg-background p-3 border border-zinc-100">
          <div className="w-full sm:flex-grow space-y-1 text-xs font-bold text-on-surface-variant">
            <label className="uppercase">Field Header Label</label>
            <input 
              type="text" 
              placeholder="e.g., Kamar, Chest Length, Across Shoulder" 
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-surface-container-lowest border border-outline-variant text-sm font-medium text-on-surface focus:ring-1 focus:ring-primary" 
            />
          </div>
          <div className="w-full sm:w-28 space-y-1 text-xs font-bold text-on-surface-variant">
            <label className="uppercase">Unit Label</label>
            <select 
              value={newFieldUnit} 
              onChange={(e) => setNewFieldUnit(e.target.value)}
              className="w-full min-h-[44px] px-2 bg-surface-container-lowest border border-outline-variant text-sm font-medium text-on-surface"
            >
              <option value="inches">Inches</option>
              <option value="cm">cm</option>
              <option value="">None (Numeric Only)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => addFieldMutation.mutate()}
            disabled={addFieldMutation.isPending}
            className="w-full sm:w-auto min-h-[44px] px-5 bg-secondary text-white text-xs font-bold tracking-wider uppercase hover:bg-opacity-95 disabled:opacity-50"
          >
            Add Key
          </button>
        </div>

        {/* Active configurations dynamic tracking grid lists */}
        <div className="border border-zinc-200 divide-y divide-zinc-100 max-h-[350px] overflow-y-auto">
          {fields.map((f, index) => (
            <div key={f.id} className={`p-3 flex items-center justify-between gap-4 text-xs ${f.is_active ? 'bg-white' : 'bg-zinc-50 opacity-60'}`}>
              <div className="space-y-0.5">
                <p className="font-bold text-primary text-sm">{f.field_name}</p>
                <p className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">Unit Type: {f.unit || 'Standard Float'} | Order Matrix Index: {f.display_order}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Positional Sequence Modifiers matching Drag specifications using tap triggers */}
                <button 
                  type="button" 
                  disabled={index === 0}
                  onClick={() => updateFieldMetaMutation.mutate({ fieldId: f.id, patches: { display_order: f.display_order - 1 } })}
                  className="material-symbols-outlined text-sm p-1 border border-zinc-200 text-on-surface-variant hover:text-primary disabled:opacity-30"
                >
                  arrow_upward
                </button>
                <button 
                  type="button" 
                  disabled={index === fields.length - 1}
                  onClick={() => updateFieldMetaMutation.mutate({ fieldId: f.id, patches: { display_order: f.display_order + 1 } })}
                  className="material-symbols-outlined text-sm p-1 border border-zinc-200 text-on-surface-variant hover:text-primary disabled:opacity-30"
                >
                  arrow_downward
                </button>
                
                {/* Visibility Deactivation Toggle switch segment */}
                <button
                  type="button"
                  onClick={() => updateFieldMetaMutation.mutate({ fieldId: f.id, patches: { is_active: !f.is_active } })}
                  className={`px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase border ${f.is_active ? 'border-status-paid text-status-paid bg-emerald-50/20' : 'border-outline text-ink-muted bg-zinc-100'}`}
                >
                  {f.is_active ? 'Active' : 'Muted'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SEGMENT 3: STAFF MANAGEMENT ACCESS LEVEL SECURITY CONTROLS */}
      <section className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
        <div>
          <h3 className="font-serif text-base font-bold text-primary uppercase tracking-wide">Studio Coworkers & Staff Clearance</h3>
          <p className="text-xs text-ink-muted mt-0.5">Authorize assistants. Assistants handle store flow checks but have locked access paths targeting settings/deletes/analytics rulesets.</p>
        </div>

        {/* Core Coworkers List Ledger Data Elements Trace */}
        <div className="border border-zinc-100 divide-y divide-zinc-100 text-xs font-medium">
          {staffList.map((st) => (
            <div key={st.id} className="p-3 flex items-center justify-between gap-4 zebra-row">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-primary text-sm">{st.full_name}</p>
                  <span className={`px-2 py-0.5 rounded-none text-[8px] font-bold uppercase tracking-wider ${st.role === 'owner' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                    {st.role}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant font-mono">{st.email}</p>
              </div>

              {/* Exclusion guard verification logic trace checks */}
              {st.role !== 'owner' ? (
                <button
                  type="button"
                  onClick={() => toggleStaffStatusMutation.mutate({ staffId: st.id, nextStatus: !st.is_active })}
                  disabled={toggleStaffStatusMutation.isPending}
                  className={`min-h-[36px] px-3 font-bold uppercase tracking-wider text-[10px] transition-all border ${
                    st.is_active ? 'border-status-due text-status-due hover:bg-red-50/40' : 'border-status-paid text-status-paid hover:bg-emerald-50/40'
                  }`}
                >
                  {st.is_active ? 'Deactivate Access' : 'Reactivate Key'}
                </button>
              ) : (
                <span className="text-[10px] uppercase text-ink-muted font-bold tracking-widest p-1 select-none">Root Account</span>
              )}
            </div>
          ))}
        </div>

        <hr className="border-zinc-100" />

        {/* Quick invite inline trigger box entry form element */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-bold text-primary uppercase tracking-wide">Invite New Assistant Token</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-on-surface-variant">
            <div className="space-y-1">
              <label>Full Name</label>
              <input type="text" placeholder="e.g., Rahul Kumar" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant font-medium text-sm text-on-surface focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label>Authorization Invite Email Address</label>
              <div className="flex gap-2">
                <input type="email" placeholder="assistant@gmail.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full flex-grow min-h-[44px] px-3 bg-surface-container-low border border-outline-variant font-medium text-sm text-on-surface focus:ring-1 focus:ring-primary" />
                <button
                  type="button"
                  onClick={() => { setSectionError('Supabase Invitation transmission framework requires verification key activation.'); }}
                  className="bg-primary text-white text-xs font-bold uppercase tracking-wider px-4 shrink-0 hover:bg-opacity-95"
                >
                  Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}