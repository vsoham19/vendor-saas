'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/utils/supabase';

export default function OnboardingPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [authUserId, setAuthUserId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // On mount: verify session exists, and redirect if user already has a store
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Not authenticated — go back to login
        router.push('/');
        return;
      }

      setUserEmail(session.user.email || '');
      setAuthUserId(session.user.id);
      setAccessToken(session.access_token);

      // Check if user already has a store/staff record
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, vendor_id, full_name, email, role, is_active')
        .eq('auth_user_id', session.user.id)
        .single();

      if (staffData) {
        // User already has a store — hydrate auth and go to dashboard
        setAuth({
          id: staffData.id,
          vendorId: staffData.vendor_id,
          fullName: staffData.full_name,
          email: staffData.email,
          role: staffData.role as 'owner' | 'assistant',
          isActive: staffData.is_active,
        }, session.access_token);
        router.push('/dashboard');
        return;
      }

      setIsChecking(false);
    };
    checkAuth();
  }, [router, setAuth]);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (!storeName.trim()) {
        throw new Error('Please enter your store name.');
      }

      // 1. Create the vendor (store) record
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .insert([{
          business_name: storeName.trim(),
          name: storeName.trim(),
          address: storeAddress.trim() || null,
          description: storeDescription.trim() || null,
        }])
        .select()
        .single();

      if (vendorError || !vendorData) {
        throw new Error(vendorError?.message || 'Failed to create store.');
      }

      // 2. Create the staff record linking this user as owner
      const ownerName = userEmail.split('@')[0] || 'Owner';
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .insert([{
          vendor_id: vendorData.id,
          auth_user_id: authUserId,
          name: ownerName,
          full_name: ownerName,
          email: userEmail,
          role: 'owner',
          is_active: true,
        }])
        .select()
        .single();

      if (staffError || !staffData) {
        // Rollback: delete the vendor if staff creation fails
        await supabase.from('vendors').delete().eq('id', vendorData.id);
        throw new Error(staffError?.message || 'Failed to create staff profile.');
      }

      // 3. Populate auth store and navigate to dashboard
      setAuth({
        id: staffData.id,
        vendorId: staffData.vendor_id,
        fullName: staffData.full_name,
        email: staffData.email,
        role: 'owner',
        isActive: true,
      }, accessToken);

      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong during setup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while checking auth
  if (isChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-on-surface-variant">Preparing your workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full flex bg-background">
      {/* Left Column: Visual Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary items-center p-16 justify-start overflow-hidden">
        <div className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none bg-cover bg-center"
             style={{ backgroundImage: `url('https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1200')` }} />
        
        <div className="relative z-10 max-w-lg text-white space-y-6">
          <h1 className="font-serif text-5xl tracking-tight leading-tight font-bold">
            Let&apos;s Set Up<br />Your Studio.
          </h1>
          <p className="text-sm tracking-wide leading-relaxed text-outline-variant font-light">
            Tell us about your boutique or atelier. This information will personalize your workspace and appear on customer-facing documents.
          </p>
          <div className="pt-4 border-t border-outline/30 w-32">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
              Step 1 of 1
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Onboarding Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-4 sm:px-8 md:px-16 bg-background">
        <div className="w-full max-w-[440px] space-y-8">
          {/* Mobile Brand */}
          <div className="lg:hidden text-center space-y-1">
            <h1 className="font-serif text-3xl font-bold text-primary tracking-tight">The Atelier</h1>
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">Studio Setup</p>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container px-3 py-1 text-[10px] font-bold tracking-wider uppercase mb-2">
              <span className="material-symbols-outlined text-sm">storefront</span>
              Welcome, {userEmail}
            </div>
            <h2 className="text-xl font-bold text-primary tracking-tight">Create Your Store Profile</h2>
            <p className="text-xs text-on-surface-variant">
              Set up your boutique details. You can always update these later in Settings.
            </p>
          </div>

          {errorMsg && (
            <div className="p-4 bg-error-container text-on-error-container border border-error/20 flex gap-3 items-start animate-fadeIn">
              <span className="material-symbols-outlined text-error text-xl shrink-0">error</span>
              <p className="text-xs font-medium leading-normal">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleOnboardingSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                Store / Boutique Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Stitch & Soul Atelier"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full min-h-[44px] px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                Physical Address
              </label>
              <input
                type="text"
                placeholder="e.g., H-24, Green Park Extension, New Delhi"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full min-h-[44px] px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                About Your Store
              </label>
              <textarea
                rows={3}
                placeholder="A short description of what your studio specializes in..."
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] mt-2 bg-primary text-white text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.99] hover:bg-opacity-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                'Setting Up Your Studio...'
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">rocket_launch</span>
                  Launch My Studio
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-4 border-t border-surface-container">
            <p className="text-[10px] text-on-surface-variant">
              By creating a store, you agree to manage your workspace through The Atelier platform.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
