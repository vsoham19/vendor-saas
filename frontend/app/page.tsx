'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/utils/supabase';

type AuthMode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  // Auth mode toggle
  const [mode, setMode] = useState<AuthMode>('signin');

  // Local interface states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for existing session on mount and redirect appropriately
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // User has a session, check if they have a staff/vendor profile
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, vendor_id, full_name, email, role, is_active')
          .eq('auth_user_id', session.user.id)
          .single();

        if (staffData) {
          // Existing user with store — go to dashboard
          setAuth({
            id: staffData.id,
            vendorId: staffData.vendor_id,
            fullName: staffData.full_name,
            email: staffData.email,
            role: staffData.role as 'owner' | 'assistant',
            isActive: staffData.is_active,
          }, session.access_token);
          router.push('/dashboard');
        } else {
          // Authenticated but no store — go to onboarding
          router.push('/onboarding');
        }
      }
    };
    checkSession();
  }, [router, setAuth]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Authentication failed. Please verify your credentials.');
      }

      // 2. Fetch staff profile to check if they have a store
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, vendor_id, full_name, email, role, is_active')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (staffError || !staffData) {
        // User is authenticated but has no store — redirect to onboarding
        router.push('/onboarding');
        return;
      }

      if (!staffData.is_active) {
        throw new Error('Your account has been deactivated by the store owner.');
      }

      // 3. Populate auth store and navigate to dashboard
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
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      // Create new user with Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      // If email confirmation is disabled, user gets a session immediately
      if (signUpData.session) {
        router.push('/onboarding');
        return;
      }

      // If email confirmation is enabled, show success message
      if (signUpData.user && !signUpData.session) {
        // Check if user was already registered (identities array is empty)
        if (signUpData.user.identities && signUpData.user.identities.length === 0) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        setSuccessMsg('Account created! Check your email for a confirmation link, then sign in.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
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
            Welcome to your workspace. Streamline measurements, catalog fabric assignments, track orders, and manage client consultations seamlessly.
          </p>
          <div className="pt-4 border-t border-outline/30 w-32">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
              The Atelier ERP
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Authorization Form Viewport */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-4 sm:px-8 md:px-16 bg-background">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Mobile Specific App Brand Title */}
          <div className="lg:hidden text-center space-y-1">
            <h1 className="font-serif text-3xl font-bold text-primary tracking-tight">The Atelier</h1>
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">Studio Ledger Management</p>
          </div>

          {/* Sign In / Sign Up Tab Toggle */}
          <div className="flex border-b border-outline-variant">
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
                mode === 'signin' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
                mode === 'signup' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-xl font-bold text-primary tracking-tight">
              {mode === 'signin' ? 'Access Your Atelier' : 'Register Your Studio'}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {mode === 'signin' 
                ? 'Enter credentials to access your boutique workspace.' 
                : 'Create an account to set up your boutique store.'}
            </p>
          </div>

          {/* Success Feedback Banner */}
          {successMsg && (
            <div className="p-4 bg-secondary-container text-on-secondary-container border border-secondary/20 flex gap-3 items-start animate-fadeIn">
              <span className="material-symbols-outlined text-secondary text-xl shrink-0">check_circle</span>
              <p className="text-xs font-medium leading-normal">{successMsg}</p>
            </div>
          )}

          {/* Error Feedback Banner */}
          {errorMsg && (
            <div className="p-4 bg-error-container text-on-error-container border border-error/20 flex gap-3 items-start animate-fadeIn">
              <span className="material-symbols-outlined text-error text-xl shrink-0">error</span>
              <p className="text-xs font-medium leading-normal">{errorMsg}</p>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@yourstudio.com"
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
                disabled={isSubmitting}
                className="w-full min-h-[44px] mt-2 bg-primary text-white text-xs font-bold tracking-wider uppercase flex items-center justify-center transition-all active:scale-[0.99] hover:bg-opacity-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@yourstudio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-all text-on-surface"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px] mt-2 bg-primary text-white text-xs font-bold tracking-wider uppercase flex items-center justify-center transition-all active:scale-[0.99] hover:bg-opacity-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="text-center pt-4 border-t border-surface-container">
            <p className="text-xs text-on-surface-variant">
              {mode === 'signin' ? (
                <>
                  New boutique setup?{' '}
                  <button 
                    type="button"
                    onClick={() => { setMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
                    className="font-semibold text-secondary hover:underline underline-offset-2"
                  >
                    Register Studio Tenant
                  </button>
                </>
              ) : (
                <>
                  Already have a workspace?{' '}
                  <button 
                    type="button"
                    onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                    className="font-semibold text-secondary hover:underline underline-offset-2"
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}