'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/utils/supabase';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  // Local interface states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoggingIn(true);

    try {
      // 1. Authenticate session credentials against Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Authentication failed. Please verify credentials.');
      }

      // 2. Fetch the corresponding vendor staff profile record to verify permissions
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, vendor_id, full_name, email, role, is_active')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (staffError || !staffData) {
        throw new Error('No associated boutique workspace profile found for this account.');
      }

      if (!staffData.is_active) {
        throw new Error('This user profile has been deactivated by the boutique owner.');
      }

      // 3. Populate global application state cache and route into main dashboard canvas
      setAuth({
        id: staffData.id,
        vendorId: staffData.vendor_id,
        fullName: staffData.full_name,
        email: staffData.email,
        role: staffData.role as 'owner' | 'assistant',
        isActive: staffData.is_active,
      }, authData.session?.access_token || '');

      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected server error occurred.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex bg-background">
      {/* Left Column: Artistic Brand Teaser Canvas (Hidden on mobile screens) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary items-center p-16 justify-start overflow-hidden">
        <div className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none bg-cover bg-center"
             style={{ backgroundImage: `url('https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1200')` }} />
        
        <div className="relative z-10 max-w-lg text-white space-y-6">
          <h1 className="font-serif text-5xl tracking-tight leading-tight font-bold">
            Crafting Order <br />Behind the Art.
          </h1>
          <p className="text-sm tracking-wide leading-relaxed text-outline-variant font-light">
            Welcome back to your workspace. Streamline measurements, catalog fabric assignments, track orders, and manage client consultations seamlessly.
          </p>
          <div className="pt-4 border-t border-outline/30 w-32">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
              The Atelier ERP
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Mobile-first Authorization Form Viewport */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-4 sm:px-8 md:px-16 bg-background">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Mobile Specific App Brand Title */}
          <div className="lg:hidden text-center space-y-1">
            <h1 className="font-serif text-3xl font-bold text-primary tracking-tight">The Atelier</h1>
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">Studio Ledger Management</p>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-xl font-bold text-primary tracking-tight">Access Your Atelier</h2>
            <p className="text-xs text-on-surface-variant">Enter credentials to synchronize boutique floor operations.</p>
          </div>

          {/* Validation Feedback Banner */}
          {errorMsg && (
            <div className="p-4 bg-error-container text-on-error-container border border-error/20 flex gap-3 items-start animate-fadeIn">
              <span className="material-symbols-outlined text-error text-xl shrink-0">error</span>
              <p className="text-xs font-medium leading-normal">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                Studio Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="designer@theatelier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                  Password
                </label>
                <a href="#" className="text-[11px] text-secondary hover:underline underline-offset-2 font-medium">
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full min-h-[44px] mt-2 bg-primary text-white text-xs font-bold tracking-wider uppercase flex items-center justify-center transition-all active:scale-[0.99] hover:bg-opacity-95 disabled:opacity-50"
            >
              {isLoggingIn ? 'Verifying Workspace...' : 'Secure Secure Sign In'}
            </button>
          </form>

          <div className="text-center pt-4 border-t border-surface-container">
            <p className="text-xs text-on-surface-variant">
              New boutique setup?{' '}
              <a href="#" className="font-semibold text-secondary hover:underline underline-offset-2">
                Register Studio Tenant
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}