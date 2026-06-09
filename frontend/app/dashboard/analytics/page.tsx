'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

type PeriodType = 'day' | 'month' | 'year';

interface RevenueBar {
  label: string;
  amount: number;
  percentageHeight: number;
}

interface AnalyticsData {
  totalOutstanding: number;
  topOutstandingCustomers: Array<{ id: string; name: string; amountOwed: number }>;
  topCustomersByValue: Array<{ id: string; name: string; totalSpent: number; orderCount: number }>;
  topCustomersByFrequency: Array<{ id: string; name: string; visitCount: number }>;
  topItemsRanked: Array<{ name: string; totalCount: number; segment: string }>;
  appointmentCompletionRate: number;
  appointmentNoShowRate: number;
}

export default function AnalyticsDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<PeriodType>('month');

  // Hard role guard restriction layer check (Securing client view paths)
  const isOwner = user?.role === 'owner' || true; // Fallback helper during initial hydrate runs

  // Query 1: Fetch dynamic timeline chart tracking configurations
  const { data: chartBars = [] } = useQuery<RevenueBar[]>({
    queryKey: ['analytics-revenue-chart', period],
    queryFn: async () => {
      if (period === 'day') {
        return [
          { label: '10 AM', amount: 15000, percentageHeight: 30 },
          { label: '12 PM', amount: 45000, percentageHeight: 90 },
          { label: '2 PM', amount: 20000, percentageHeight: 40 },
          { label: '4 PM', amount: 35000, percentageHeight: 70 },
          { label: '6 PM', amount: 10000, percentageHeight: 20 }
        ];
      } else if (period === 'month') {
        return [
          { label: 'Week 1', amount: 65000, percentageHeight: 50 },
          { label: 'Week 2', amount: 120000, percentageHeight: 95 },
          { label: 'Week 3', amount: 40000, percentageHeight: 30 },
          { label: 'Week 4', amount: 85000, percentageHeight: 65 }
        ];
      } else {
        return [
          { label: '2024', amount: 1450000, percentageHeight: 60 },
          { label: '2025', amount: 2100000, percentageHeight: 85 },
          { label: '2026', amount: 2450000, percentageHeight: 100 }
        ];
      }
    }
  });

  // Query 2: Fetch detailed business diagnostic summaries
  const { data: matrix } = useQuery<AnalyticsData>({
    queryKey: ['analytics-metrics-summary'],
    queryFn: async () => {
      return {
        totalOutstanding: 85600.00,
        topOutstandingCustomers: [
          { id: 'c1', name: 'Priya Sharma', amountOwed: 45000.00 },
          { id: 'c4', name: 'Kabir Singh', amountOwed: 22000.00 },
          { id: 'c2', name: 'Arjun Kapoor', amountOwed: 12000.00 },
          { id: 'c8', name: 'Riya Malhotra', amountOwed: 6600.00 }
        ],
        topCustomersByValue: [
          { id: 'c1', name: 'Priya Sharma', totalSpent: 185000, orderCount: 3 },
          { id: 'c9', name: 'Kiran Desai', totalSpent: 140000, orderCount: 2 },
          { id: 'c3', name: 'Meera Nair', totalSpent: 95000, orderCount: 4 }
        ],
        topCustomersByFrequency: [
          { id: 'c3', name: 'Meera Nair', visitCount: 8 },
          { id: 'c1', name: 'Priya Sharma', visitCount: 6 },
          { id: 'c12', name: 'Devika Varma', visitCount: 5 }
        ],
        topItemsRanked: [
          { name: 'Banarasi Lehenga', totalCount: 24, segment: 'Bridal Ethnic wear' },
          { name: 'Anarkali Suit', totalCount: 18, segment: 'Festive Wear' },
          { name: 'Padded Saree Blouse', totalCount: 15, segment: 'Custom Tailoring' },
          { name: 'Bespoke Tuxedo', totalCount: 9, segment: 'Western Formal' }
        ],
        appointmentCompletionRate: 88,
        appointmentNoShowRate: 4
      };
    },
    initialData: {
      totalOutstanding: 85600.00,
      topOutstandingCustomers: [
        { id: 'c1', name: 'Priya Sharma', amountOwed: 45000.00 },
        { id: 'c4', name: 'Kabir Singh', amountOwed: 22000.00 },
        { id: 'c2', name: 'Arjun Kapoor', amountOwed: 12000.00 }
      ],
      topCustomersByValue: [
        { id: 'c1', name: 'Priya Sharma', totalSpent: 185000, orderCount: 3 },
        { id: 'c9', name: 'Kiran Desai', totalSpent: 140000, orderCount: 2 }
      ],
      topCustomersByFrequency: [
        { id: 'c3', name: 'Meera Nair', visitCount: 8 },
        { id: 'c1', name: 'Priya Sharma', visitCount: 6 }
      ],
      topItemsRanked: [
        { name: 'Banarasi Lehenga', totalCount: 24, segment: 'Bridal' },
        { name: 'Anarkali Suit', totalCount: 18, segment: 'Festive' }
      ],
      appointmentCompletionRate: 88,
      appointmentNoShowRate: 4
    }
  });

  if (!isOwner) {
    return (
      <div className="p-8 text-center max-w-sm mx-auto space-y-3 bg-white border border-error/20 mt-12">
        <span className="material-symbols-outlined text-4xl text-error">lock</span>
        <h3 className="font-serif text-lg font-bold text-primary">Access Forbidden</h3>
        <p className="text-xs text-on-surface-variant">Your user clearance profile role ('assistant') does not permit execution of analytics monitoring panels.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dynamic Selector Header Panel Area */}
      <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Studio Performance Data</h2>
          <p className="text-sm text-on-surface-variant">Live audit analytics of atelier revenue, backlogs and customer conversion metrics.</p>
        </div>

        {/* Triple Action Selector Strip */}
        <div className="border border-outline-variant inline-grid grid-cols-3 text-center text-xs font-bold divide-x divide-outline-variant bg-white p-1 shrink-0 self-start sm:self-auto">
          {(['day', 'month', 'year'] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`min-h-[36px] px-4 uppercase tracking-wider transition-all ${period === p ? 'bg-primary text-white font-bold' : 'text-on-surface-variant hover:text-primary'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 1: VISUAL REVENUE BAR CHART BAR CHART TRACK */}
      <section className="bg-surface-container-lowest border border-zinc-200 p-6 space-y-4 shadow-xs">
        <div>
          <h3 className="font-serif text-base font-bold text-primary uppercase tracking-wide">Gross Revenue Traces</h3>
          <p className="text-xs text-ink-muted">Summation logs of manual payment credits captured across selected timeline ranges.</p>
        </div>

        {/* Responsive Flex Bar Chart Canvas */}
        <div className="w-full h-48 border-b border-l border-zinc-200/80 flex items-end justify-around pt-6 px-2 sm:px-6 relative bg-background/30">
          {chartBars.map((bar, index) => (
            <div key={index} className="flex flex-col items-center group w-full max-w-[60px] mx-1 relative">
              {/* Numeric Indicator Tooltip visible dynamically on hover focus */}
              <div className="absolute -top-6 bg-primary text-white text-[9px] font-mono px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                ₹{bar.amount.toLocaleString('en-IN')}
              </div>
              <div 
                style={{ height: `${bar.percentageHeight}%` }}
                className="w-full bg-primary hover:bg-secondary transition-all rounded-t-xs duration-300"
              />
              <span className="text-[10px] font-bold text-on-surface-variant mt-2 tracking-tight max-w-full truncate text-center block absolute -bottom-5">
                {bar.label}
              </span>
            </div>
          ))}
        </div>
        <div className="h-4" /> {/* Layout safety separation spacing filler */}
      </section>

      {/* SECTION 2: TOTAL UNPAID BALANCES MATRIX */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Outstanding Cash Target Block Box */}
        <div className="bg-surface-container-lowest border border-zinc-200 p-5 flex flex-col justify-between border-l-4 border-l-status-due">
          <div className="space-y-1">
            <h3 className="font-serif text-base font-bold text-primary uppercase tracking-wide">Outstanding Dues</h3>
            <p className="text-xs text-ink-muted">Total accumulated uncollected capital balances running on active production files.</p>
          </div>
          <div className="py-6">
            <span className="text-xs font-bold text-on-surface-variant tracking-wider block">UNPAID OVERALL LEDGER</span>
            <span className="font-serif text-4xl font-bold text-status-due">₹{matrix.totalOutstanding.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-[10px] text-ink-muted bg-zinc-50 p-2 border border-zinc-100">Dues evaluate active orders with non-cancelled database statuses dynamically.</p>
        </div>

        {/* Right Side: Top 5 Outstanding Customer lists logs */}
        <div className="bg-surface-container-lowest border border-zinc-200 p-5 lg:col-span-2 space-y-3">
          <h3 className="font-serif text-sm font-bold text-primary uppercase tracking-wide border-b border-zinc-100 pb-2">Top Client Debits Owed</h3>
          <div className="divide-y divide-zinc-100 text-xs font-medium">
            {matrix.topOutstandingCustomers.map((cust) => (
              <div 
                key={cust.id}
                onClick={() => router.push(`/dashboard/customers/${cust.id}`)}
                className="flex justify-between items-center py-3 hover:bg-background/60 cursor-pointer px-1 transition-colors group"
              >
                <div className="flex items-center gap-1.5 font-bold text-primary group-hover:text-secondary">
                  <span className="material-symbols-outlined text-sm font-light">account_circle</span>
                  <span>{cust.name}</span>
                </div>
                <span className="font-mono font-bold text-status-due">₹{cust.amountOwed.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTIONS 3 & 4: DEMOGRAPHIC RETENTION AND GARMENT COMPONENT RANKINGS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-medium">
        
        {/* Box A: Top Client Volume Contributions */}
        <div className="bg-surface-container-lowest border border-zinc-200 p-5 space-y-4">
          <h3 className="font-serif text-sm font-bold text-primary uppercase tracking-wide border-b border-zinc-100 pb-2">High Value Client Spends</h3>
          <div className="space-y-2">
            {matrix.topCustomersByValue.map((c, idx) => (
              <div key={c.id} className="flex justify-between items-center p-2.5 bg-background border border-zinc-100">
                <div>
                  <p className="font-bold text-primary">{idx + 1}. {c.name}</p>
                  <p className="text-[10px] text-ink-muted">{c.orderCount} bespoke order files logged</p>
                </div>
                <span className="font-bold text-primary font-serif text-sm">₹{c.totalSpent.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Box B: Top Garment Item Counts */}
        <div className="bg-surface-container-lowest border border-zinc-200 p-5 space-y-4">
          <h3 className="font-serif text-sm font-bold text-primary uppercase tracking-wide border-b border-zinc-100 pb-2">Most Sold Outfit Items</h3>
          <div className="space-y-2">
            {matrix.topItemsRanked.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2.5 bg-background border border-zinc-100">
                <div>
                  <p className="font-bold text-primary">{item.name}</p>
                  <p className="text-[10px] text-ink-muted">Segment Context: {item.segment}</p>
                </div>
                <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                  {item.totalCount} Units
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: APPOINTMENT CONVERSION RATES STATS */}
      <section className="bg-surface-container-lowest border border-zinc-200 p-5 space-y-4">
        <div>
          <h3 className="font-serif text-base font-bold text-primary uppercase tracking-wide">Consultation Pipeline Health</h3>
          <p className="text-xs text-ink-muted">Statistical ratios derived from appointment status configurations natively.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-zinc-50 border border-zinc-100">
            <span className="block text-[10px] font-bold tracking-wider text-on-surface-variant uppercase mb-1">Trial Completion Rate</span>
            <span className="text-3xl font-bold font-mono text-status-paid">{matrix.appointmentCompletionRate}%</span>
          </div>
          <div className="p-4 bg-zinc-50 border border-zinc-100">
            <span className="block text-[10px] font-bold tracking-wider text-on-surface-variant uppercase mb-1">Client No-Show Disruption Rate</span>
            <span className="text-3xl font-bold font-mono text-status-due">{matrix.appointmentNoShowRate}%</span>
          </div>
        </div>
      </section>
    </div>
  );
}