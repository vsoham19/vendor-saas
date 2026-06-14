'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useAuthStore } from '@/store/authStore';

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

interface VendorProfile {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
}

export default function AtelierStudioSettingsPage() {
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [sectionSuccess, setSectionSuccess] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);

  // Form Field Local Temporary Capture Buffers
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldUnit, setNewFieldUnit] = useState('inches');
  
  // Staff Invite Buffer
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');

  // Business Profile Editable States
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editBusinessAddress, setEditBusinessAddress] = useState('');
  const [editBusinessDescription, setEditBusinessDescription] = useState('');
  const [isBusinessEditing, setIsBusinessEditing] = useState(false);

  // Query A: Fetch Vendor Profile
  const { data: vendorProfile } = useQuery<VendorProfile | null>({
    queryKey: ['vendor-profile', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return null;
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, business_name, address, description')
        .eq('id', user.vendorId)
        .single();
      if (error) throw error;
      return data ? { ...data, name: data.business_name || data.name } : null;
    },
    enabled: !!user?.vendorId,
  });

  // Query B: Fetch Measurement Field Templates
  const { data: fields = [] } = useQuery<MeasurementTemplateField[]>({
    queryKey: ['settings-measurement-fields-list', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data, error } = await supabase
        .from('measurement_field_templates')
        .select('id, field_name, unit, display_order, is_active')
        .eq('vendor_id', user.vendorId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.vendorId,
  });

  // Query C: Fetch Studio Staff List
  const { data: staffList = [] } = useQuery<StaffProfileRow[]>({
    queryKey: ['settings-staff-list', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email, role, is_active')
        .eq('vendor_id', user.vendorId)
        .order('role', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.vendorId,
  });

  // Mutation: Update Business Profile
  const updateBusinessMutation = useMutation({
    mutationFn: async () => {
      setSectionError(null);
      if (!editBusinessName.trim()) throw new Error('Store name cannot be empty.');
      
      const { error } = await supabase
        .from('vendors')
        .update({
          business_name: editBusinessName.trim(),
          name: editBusinessName.trim(),
          address: editBusinessAddress.trim() || null,
          description: editBusinessDescription.trim() || null,
        })
        .eq('id', user?.vendorId);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-profile'] });
      setIsBusinessEditing(false);
      setSectionSuccess('Business profile updated successfully.');
      setTimeout(() => setSectionSuccess(null), 3000);
    },
    onError: (err: any) => setSectionError(err.message),
  });

  // Mutation: Add New Measurement Field
  const addFieldMutation = useMutation({
    mutationFn: async () => {
      setSectionError(null);
      if (!newFieldName) throw new Error('Field name cannot be empty.');
      
      const payload = {
        vendor_id: user?.vendorId,
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
    },
    onError: (err: any) => setSectionError(err.message),
  });

  // Mutation: Toggle Field State
  const updateFieldMetaMutation = useMutation({
    mutationFn: async ({ fieldId, patches }: { fieldId: string; patches: Partial<MeasurementTemplateField> }) => {
      const { data, error } = await supabase.from('measurement_field_templates').update(patches).eq('id', fieldId).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-measurement-fields-list'] }),
  });

  // Mutation: Toggle Staff Status
  const toggleStaffStatusMutation = useMutation({
    mutationFn: async ({ staffId, nextStatus }: { staffId: string; nextStatus: boolean }) => {
      setSectionError(null);
      const subject = staffList.find(s => s.id === staffId);
      if (subject?.role === 'owner') throw new Error('Owner accounts cannot be deactivated.');

      const { data, error } = await supabase.from('staff').update({ is_active: nextStatus }).eq('id', staffId).select();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-staff-list'] }),
    onError: (err: any) => setSectionError(err.message),
  });

  // Mutation: Invite New Staff (calls backend API)
  const inviteStaffMutation = useMutation({
    mutationFn: async () => {
      setStaffError(null);
      setStaffSuccess(null);
      if (!inviteName.trim() || !inviteEmail.trim() || !invitePassword.trim()) {
        throw new Error('Name, email, and password are all required.');
      }
      if (invitePassword.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          password: invitePassword.trim(),
          vendor_id: user?.vendorId,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || errBody.error || `Request failed with status ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-staff-list'] });
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setStaffSuccess('Assistant added successfully! They can now sign in.');
      setTimeout(() => setStaffSuccess(null), 4000);
    },
    onError: (err: any) => setStaffError(err.message),
  });

  const handleStartEditBusiness = () => {
    setEditBusinessName(vendorProfile?.name || '');
    setEditBusinessAddress(vendorProfile?.address || '');
    setEditBusinessDescription(vendorProfile?.description || '');
    setIsBusinessEditing(true);
  };

  return (
    <div className="space-y-10 max-w-2xl mx-auto pb-12">
      {/* Title block */}
      <div className="border-b border-outline-variant pb-4">
        <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Studio Settings</h2>
        <p className="text-sm text-on-surface-variant">Configure workspace definitions, column keys, and staff roles.</p>
      </div>

      {sectionError && (
        <div className="p-4 bg-error-container text-on-error-container text-xs font-medium border border-error/20 flex gap-2 animate-fadeIn">
          <span className="material-symbols-outlined shrink-0 text-base">error</span>
          <p>{sectionError}</p>
        </div>
      )}

      {sectionSuccess && (
        <div className="p-4 bg-secondary-container text-on-secondary-container text-xs font-medium border border-secondary/20 flex gap-2 animate-fadeIn">
          <span className="material-symbols-outlined shrink-0 text-base">check_circle</span>
          <p>{sectionSuccess}</p>
        </div>
      )}

      {/* SEGMENT 1: BUSINESS PROFILE */}
      <section className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
          <h3 className="font-serif text-base font-bold text-primary">Business Profile</h3>
          {!isBusinessEditing && (
            <button
              type="button"
              onClick={handleStartEditBusiness}
              className="text-xs font-bold text-secondary uppercase tracking-wider hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {isBusinessEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-on-surface-variant">
              <div className="space-y-1 sm:col-span-2">
                <label className="uppercase">Studio Business Name *</label>
                <input type="text" value={editBusinessName} onChange={(e) => setEditBusinessName(e.target.value)} className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:ring-1 focus:ring-primary" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="uppercase">Physical Address</label>
                <input type="text" value={editBusinessAddress} onChange={(e) => setEditBusinessAddress(e.target.value)} className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:ring-1 focus:ring-primary" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="uppercase">About / Description</label>
                <textarea rows={2} value={editBusinessDescription} onChange={(e) => setEditBusinessDescription(e.target.value)} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => updateBusinessMutation.mutate()} disabled={updateBusinessMutation.isPending} className="px-5 min-h-[40px] bg-primary text-white text-xs font-bold tracking-wider uppercase hover:bg-opacity-95 disabled:opacity-50">
                {updateBusinessMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setIsBusinessEditing(false)} className="px-5 min-h-[40px] border border-outline-variant text-xs font-bold tracking-wider uppercase text-on-surface-variant hover:bg-surface-container-low">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-on-surface-variant">
            <div className="space-y-1 sm:col-span-2">
              <label className="uppercase text-[10px]">Studio Name</label>
              <p className="text-sm text-on-surface font-medium">{vendorProfile?.name || '—'}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="uppercase text-[10px]">Address</label>
              <p className="text-sm text-on-surface font-medium">{vendorProfile?.address || 'Not set'}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="uppercase text-[10px]">Description</label>
              <p className="text-sm text-on-surface font-medium">{vendorProfile?.description || 'Not set'}</p>
            </div>
          </div>
        )}
      </section>

      {/* SEGMENT 2: MEASUREMENT FIELDS DEFINITION */}
      <section className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
        <div>
          <h3 className="font-serif text-base font-bold text-primary uppercase tracking-wide">Measurement Column Fields Definition</h3>
          <p className="text-xs text-ink-muted mt-0.5">Define your custom structural parameters. Changes appear instantly across data entry sheets.</p>
        </div>

        {/* Input Block */}
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

        {/* Active fields list */}
        <div className="border border-zinc-200 divide-y divide-zinc-100 max-h-[350px] overflow-y-auto">
          {fields.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-muted">No measurement fields configured yet. Add one above.</div>
          ) : (
            fields.map((f, index) => (
              <div key={f.id} className={`p-3 flex items-center justify-between gap-4 text-xs ${f.is_active ? 'bg-white' : 'bg-zinc-50 opacity-60'}`}>
                <div className="space-y-0.5">
                  <p className="font-bold text-primary text-sm">{f.field_name}</p>
                  <p className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">Unit Type: {f.unit || 'Standard Float'} | Order: {f.display_order}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                  
                  <button
                    type="button"
                    onClick={() => updateFieldMetaMutation.mutate({ fieldId: f.id, patches: { is_active: !f.is_active } })}
                    className={`px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase border ${f.is_active ? 'border-status-paid text-status-paid bg-emerald-50/20' : 'border-outline text-ink-muted bg-zinc-100'}`}
                  >
                    {f.is_active ? 'Active' : 'Muted'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* SEGMENT 3: STAFF MANAGEMENT */}
      <section className="bg-surface-container-lowest p-5 border border-zinc-200 space-y-4">
        <div>
          <h3 className="font-serif text-base font-bold text-primary uppercase tracking-wide">Studio Coworkers & Staff Clearance</h3>
          <p className="text-xs text-ink-muted mt-0.5">Authorize assistants. Assistants handle store flow checks but have locked access to settings and analytics.</p>
        </div>

        {/* Staff List */}
        <div className="border border-zinc-100 divide-y divide-zinc-100 text-xs font-medium">
          {staffList.length === 0 ? (
            <div className="p-6 text-center text-ink-muted">No staff members found.</div>
          ) : (
            staffList.map((st) => (
              <div key={st.id} className="p-3 flex items-center justify-between gap-4 zebra-row">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-primary text-sm">{st.full_name}</p>
                    <span className={`px-2 py-0.5 rounded-none text-[8px] font-bold uppercase tracking-wider ${st.role === 'owner' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                      {st.role}
                    </span>
                    {!st.is_active && (
                      <span className="px-2 py-0.5 rounded-none text-[8px] font-bold uppercase tracking-wider bg-error-container text-on-error-container">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant font-mono">{st.email}</p>
                </div>

                {st.role !== 'owner' ? (
                  <button
                    type="button"
                    onClick={() => toggleStaffStatusMutation.mutate({ staffId: st.id, nextStatus: !st.is_active })}
                    disabled={toggleStaffStatusMutation.isPending}
                    className={`min-h-[36px] px-3 font-bold uppercase tracking-wider text-[10px] transition-all border ${
                      st.is_active ? 'border-status-due text-status-due hover:bg-red-50/40' : 'border-status-paid text-status-paid hover:bg-emerald-50/40'
                    }`}
                  >
                    {st.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                ) : (
                  <span className="text-[10px] uppercase text-ink-muted font-bold tracking-widest p-1 select-none">Root Account</span>
                )}
              </div>
            ))
          )}
        </div>

        <hr className="border-zinc-100" />

        {/* Add New Assistant Form */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-bold text-primary uppercase tracking-wide">Add New Assistant</p>
          <p className="text-[11px] text-on-surface-variant">Create a new staff account. The assistant can immediately sign in with these credentials.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-on-surface-variant">
            <div className="space-y-1">
              <label>Full Name *</label>
              <input type="text" placeholder="e.g., Rahul Kumar" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant font-medium text-sm text-on-surface focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label>Email Address *</label>
              <input type="email" placeholder="assistant@gmail.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full min-h-[44px] px-3 bg-surface-container-low border border-outline-variant font-medium text-sm text-on-surface focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label>Password * <span className="font-normal text-ink-muted">(Min. 6 characters)</span></label>
              <div className="flex gap-2">
                <input type="password" placeholder="Create a password for the assistant" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} className="w-full flex-grow min-h-[44px] px-3 bg-surface-container-low border border-outline-variant font-medium text-sm text-on-surface focus:ring-1 focus:ring-primary" />
                <button
                  type="button"
                  onClick={() => inviteStaffMutation.mutate()}
                  disabled={inviteStaffMutation.isPending}
                  className="bg-primary text-white text-xs font-bold uppercase tracking-wider px-5 shrink-0 hover:bg-opacity-95 disabled:opacity-50 min-h-[44px]"
                >
                  {inviteStaffMutation.isPending ? 'Adding...' : 'Add Assistant'}
                </button>
              </div>
              {staffError && (
                <p className="text-status-due text-xs font-bold mt-2 flex gap-1.5 items-center">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  <span>{staffError}</span>
                </p>
              )}
              {staffSuccess && (
                <p className="text-status-paid text-xs font-bold mt-2 flex gap-1.5 items-center">
                  <span className="material-symbols-outlined text-base shrink-0">check_circle</span>
                  <span>{staffSuccess}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}