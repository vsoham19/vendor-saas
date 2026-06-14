'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/utils/supabase';

const navigationLinks = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { label: 'Customers', icon: 'group', href: '/dashboard/customers' },
  { label: 'Orders', icon: 'shopping_bag', href: '/dashboard/orders' },
  { label: 'Appointments', icon: 'calendar_today', href: '/dashboard/appointments' },
  { label: 'Analytics', icon: 'analytics', href: '/dashboard/analytics', ownerOnly: true },
  { label: 'Settings', icon: 'settings', href: '/dashboard/settings', ownerOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, clearAuth, setAuth, setLoading } = useAuthStore();
  const [studioName, setStudioName] = useState('Loading...');

  // Session hydration: on mount, restore session from Supabase if auth store is empty
  useEffect(() => {
    const hydrateSession = async () => {
      if (isAuthenticated && user) {
        // Already authenticated, just fetch the vendor name
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // No session — redirect to login
          clearAuth();
          router.push('/');
          return;
        }

        // Fetch staff profile
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('id, vendor_id, full_name, email, role, is_active')
          .eq('auth_user_id', session.user.id)
          .single();

        if (staffError || !staffData) {
          // Authenticated but no store — redirect to onboarding
          router.push('/onboarding');
          return;
        }

        if (!staffData.is_active) {
          clearAuth();
          router.push('/');
          return;
        }

        // Hydrate auth store
        setAuth({
          id: staffData.id,
          vendorId: staffData.vendor_id,
          fullName: staffData.full_name,
          email: staffData.email,
          role: staffData.role as 'owner' | 'assistant',
          isActive: staffData.is_active,
        }, session.access_token);
      } catch {
        clearAuth();
        router.push('/');
      }
    };

    hydrateSession();
  }, [isAuthenticated, user, clearAuth, setAuth, setLoading, router]);

  // Fetch the vendor/studio name dynamically
  useEffect(() => {
    const fetchVendorName = async () => {
      if (!user?.vendorId) return;
      
      const { data, error } = await supabase
        .from('vendors')
        .select('name, business_name')
        .eq('id', user.vendorId)
        .single();

      if (data && !error) {
        setStudioName(data.business_name || data.name || 'My Studio');
      } else {
        setStudioName('My Studio');
      }
    };

    fetchVendorName();
  }, [user?.vendorId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearAuth();
    router.push('/');
  };

  // Show loading while checking auth
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-on-surface-variant">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Desktop Sidebar Panel Navigation Framework */}
      <aside className="hidden lg:flex h-screen w-64 fixed left-0 top-0 sidebar-border bg-background flex-col py-6 px-4 z-50">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-primary tracking-tight font-bold mb-1">The Atelier</h1>
          <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase font-sans truncate" title={studioName}>{studioName}</p>
        </div>
        
        <nav className="flex-grow space-y-1">
          {navigationLinks.map((link) => {
            if (link.ownerOnly && user.role !== 'owner') return null;
            const isCurrent = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center px-4 py-3 font-medium transition-colors border-r-2 ${
                  isCurrent 
                    ? 'text-primary border-primary bg-surface-container-low font-bold' 
                    : 'text-on-surface-variant border-transparent hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined mr-3">{link.icon}</span>
                <span className="text-sm">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant">
          <button 
            onClick={() => router.push('/dashboard/orders/create')}
            className="w-full bg-primary text-white text-sm font-medium py-3 px-4 flex items-center justify-center gap-2 hover:bg-opacity-90 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create New Order
          </button>
          
          <div className="mt-6 flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
              {user.fullName.substring(0, 2)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-on-surface truncate">{user.fullName}</p>
              <button 
                onClick={handleSignOut}
                className="text-[10px] text-on-surface-variant uppercase tracking-widest block hover:text-status-due transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Primary Workspace Window Viewport Layer */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Universal Top Application Bar Header */}
        <header className="w-full h-16 bg-background header-border flex justify-between items-center px-4 lg:px-10 sticky top-0 z-40">
          <div className="flex items-center w-2/3 lg:w-1/3">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input 
                type="text" 
                placeholder="Search orders, customers..." 
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-none focus:ring-2 focus:ring-primary text-sm transition-all text-on-surface"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-6">
            <button className="text-on-surface-variant hover:text-primary rounded-full p-1 transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="hidden sm:block h-8 w-px bg-outline-variant"></div>
            <p className="font-serif text-lg lg:text-xl text-primary font-bold whitespace-nowrap truncate max-w-[200px]">{studioName}</p>
          </div>
        </header>

        {/* Primary Screen Area Canvas Layout Wrapper */}
        <main className="flex-grow p-4 lg:p-10 max-w-[1200px] w-full mx-auto space-y-10 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Sticky Action Bottom Tab Bar Component Matrix */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-outline-variant grid grid-cols-5 h-16 z-50 text-center items-center">
        {navigationLinks.slice(0, 5).map((link) => {
          return (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`flex flex-col items-center justify-center text-xs h-full transition-all ${
                pathname === link.href 
                  ? 'text-primary font-bold bg-surface-container-low' 
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined mb-1">{link.icon}</span>
              <span className="text-[10px]">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}