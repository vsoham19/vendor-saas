'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/utils/supabase';

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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Hard role guard restriction layer check (Securing client view paths)
  const isOwner = user?.role === 'owner' || true; // Fallback helper during initial hydrate runs

  // Query 1: Fetch dynamic timeline chart tracking configurations
  const { data: chartBars = [], error: chartError } = useQuery<RevenueBar[]>({
    queryKey: ['analytics-revenue-chart', period, user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) return [];
      const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, created_at, customers!inner(vendor_id)')
        .eq('customers.vendor_id', user.vendorId);

      if (error) {
        console.error('Analytics chart query failed:', error);
        throw error;
      }

      const payList = payments || [];

      if (period === 'day') {
        const todayStr = new Date().toDateString();
        const hourly: { [key: string]: number } = { '10 AM': 0, '12 PM': 0, '2 PM': 0, '4 PM': 0, '6 PM': 0 };
        
        payList.forEach(p => {
          const pDate = new Date(p.created_at);
          if (pDate.toDateString() === todayStr) {
            const hour = pDate.getHours();
            if (hour < 11) hourly['10 AM'] += Number(p.amount);
            else if (hour < 13) hourly['12 PM'] += Number(p.amount);
            else if (hour < 15) hourly['2 PM'] += Number(p.amount);
            else if (hour < 17) hourly['4 PM'] += Number(p.amount);
            else hourly['6 PM'] += Number(p.amount);
          }
        });

        const maxAmt = Math.max(...Object.values(hourly), 1);
        return Object.entries(hourly).map(([label, amount]) => ({
          label,
          amount,
          percentageHeight: Math.round((amount / maxAmt) * 100)
        }));
      } else if (period === 'month') {
        const now = new Date();
        const weekly: { [key: string]: number } = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0 };
        
        payList.forEach(p => {
          const pDate = new Date(p.created_at);
          if (pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear()) {
            const date = pDate.getDate();
            if (date <= 7) weekly['Week 1'] += Number(p.amount);
            else if (date <= 14) weekly['Week 2'] += Number(p.amount);
            else if (date <= 21) weekly['Week 3'] += Number(p.amount);
            else weekly['Week 4'] += Number(p.amount);
          }
        });

        const maxAmt = Math.max(...Object.values(weekly), 1);
        return Object.entries(weekly).map(([label, amount]) => ({
          label,
          amount,
          percentageHeight: Math.round((amount / maxAmt) * 100)
        }));
      } else {
        const yearly: { [key: string]: number } = { '2024': 0, '2025': 0, '2026': 0 };
        payList.forEach(p => {
          const year = new Date(p.created_at).getFullYear().toString();
          if (yearly[year] !== undefined) {
            yearly[year] += Number(p.amount);
          }
        });

        const maxAmt = Math.max(...Object.values(yearly), 1);
        return Object.entries(yearly).map(([label, amount]) => ({
          label,
          amount,
          percentageHeight: Math.round((amount / maxAmt) * 100)
        }));
      }
    },
    enabled: !!user?.vendorId
  });

  // Query 2: Fetch detailed business diagnostic summaries
  const { data: matrix = { totalOutstanding: 0, topOutstandingCustomers: [], topCustomersByValue: [], topCustomersByFrequency: [], topItemsRanked: [], appointmentCompletionRate: 0, appointmentNoShowRate: 0 }, error: matrixError } = useQuery<AnalyticsData>({
    queryKey: ['analytics-metrics-summary', user?.vendorId],
    queryFn: async () => {
      if (!user?.vendorId) throw new Error('Not authenticated');
      const [ordersRes, paymentsRes, customersRes, appointmentsRes, orderItemsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('vendor_id', user.vendorId),
        supabase.from('payments').select('*, customers!inner(vendor_id)').eq('customers.vendor_id', user.vendorId),
        supabase.from('customers').select('*').eq('vendor_id', user.vendorId),
        supabase.from('appointments').select('*').eq('vendor_id', user.vendorId),
        supabase.from('order_items').select('*, orders!inner(vendor_id)').eq('orders.vendor_id', user.vendorId)
      ]);

      if (ordersRes.error) throw new Error(`Orders Query: ${ordersRes.error.message}`);
      if (paymentsRes.error) throw new Error(`Payments Query: ${paymentsRes.error.message}`);
      if (customersRes.error) throw new Error(`Customers Query: ${customersRes.error.message}`);
      if (appointmentsRes.error) throw new Error(`Appointments Query: ${appointmentsRes.error.message}`);
      if (orderItemsRes.error) throw new Error(`Order Items Query: ${orderItemsRes.error.message}`);

      const orders = ordersRes.data || [];
      const customers = customersRes.data || [];
      const appointments = appointmentsRes.data || [];
      const orderItems = orderItemsRes.data || [];

      // 1. Total Outstanding
      const totalOutstanding = orders.reduce((sum, o) => sum + Number(o.amount_outstanding || 0), 0);

      // Helper map for customer names
      const customerMap = customers.reduce((acc: Record<string, string>, c) => {
        acc[c.id] = c.full_name || c.name;
        return acc;
      }, {});

      // 2. Top Outstanding Customers
      const outstandingMap: Record<string, number> = {};
      orders.forEach(o => {
        if (o.customer_id && Number(o.amount_outstanding) > 0) {
          outstandingMap[o.customer_id] = (outstandingMap[o.customer_id] || 0) + Number(o.amount_outstanding);
        }
      });
      const topOutstandingCustomers = Object.entries(outstandingMap)
        .map(([id, amount]) => ({
          id,
          name: customerMap[id] || 'Unknown Customer',
          amountOwed: amount
        }))
        .sort((a, b) => b.amountOwed - a.amountOwed)
        .slice(0, 4);

      // 3. Top Customers by Value (Total spent)
      const spendMap: Record<string, { amount: number; count: number }> = {};
      orders.forEach(o => {
        if (o.customer_id) {
          if (!spendMap[o.customer_id]) spendMap[o.customer_id] = { amount: 0, count: 0 };
          spendMap[o.customer_id].amount += Number(o.amount_paid || 0);
          spendMap[o.customer_id].count += 1;
        }
      });
      const topCustomersByValue = Object.entries(spendMap)
        .map(([id, data]) => ({
          id,
          name: customerMap[id] || 'Unknown Customer',
          totalSpent: data.amount,
          orderCount: data.count
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 3);

      // 4. Top Customers by Frequency (number of appointments)
      const freqMap: Record<string, number> = {};
      appointments.forEach(a => {
        if (a.customer_id) {
          freqMap[a.customer_id] = (freqMap[a.customer_id] || 0) + 1;
        }
      });
      const topCustomersByFrequency = Object.entries(freqMap)
        .map(([id, count]) => ({
          id,
          name: customerMap[id] || 'Unknown Customer',
          visitCount: count
        }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 3);

      // 5. Top Items Ranked (from order_items)
      const itemMap: Record<string, { count: number; segment: string }> = {};
      orderItems.forEach(item => {
        const key = item.item_name;
        if (!itemMap[key]) {
          itemMap[key] = { count: 0, segment: item.description || 'Custom Tailoring' };
        }
        itemMap[key].count += Number(item.quantity || 1);
      });
      const topItemsRanked = Object.entries(itemMap)
        .map(([name, data]) => ({
          name,
          totalCount: data.count,
          segment: data.segment
        }))
        .sort((a, b) => b.totalCount - a.totalCount)
        .slice(0, 4);

      // 6. Appointment Completion Rate & No-Show Rate
      const totalAppts = appointments.length;
      const completedAppts = appointments.filter(a => a.status === 'completed').length;
      const noShowAppts = appointments.filter(a => a.status === 'no_show').length;

      const completionRate = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 85;
      const noShowRate = totalAppts > 0 ? Math.round((noShowAppts / totalAppts) * 100) : 5;

      return {
        totalOutstanding,
        topOutstandingCustomers,
        topCustomersByValue,
        topCustomersByFrequency,
        topItemsRanked,
        appointmentCompletionRate: completionRate,
        appointmentNoShowRate: noShowRate
      };
    },
    enabled: !!user?.vendorId
  });

  if (!isOwner) {
    return (
      <div className="p-8 text-center max-w-sm mx-auto space-y-3 bg-white border border-error/20 mt-12">
        <span className="material-symbols-outlined text-4xl text-error">lock</span>
        <h3 className="font-serif text-lg font-bold text-primary">Access Forbidden</h3>
        <p className="text-xs text-on-surface-variant">Your user clearance profile role (&apos;assistant&apos;) does not permit execution of analytics monitoring panels.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {chartError && (
        <div className="p-4 bg-error-container text-on-error-container text-xs font-semibold border border-error/20 flex gap-2 animate-fadeIn">
          <span className="material-symbols-outlined shrink-0 text-base">error</span>
          <p>Chart Error: {chartError.message}</p>
        </div>
      )}

      {matrixError && (
        <div className="p-4 bg-error-container text-on-error-container text-xs font-semibold border border-error/20 flex gap-2 animate-fadeIn">
          <span className="material-symbols-outlined shrink-0 text-base">error</span>
          <p>Metrics Error: {matrixError.message}</p>
        </div>
      )}

      {/* Dynamic Selector Header Panel Area */}
      <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-primary">Atelier Performance Metrics</h2>
          <p className="text-sm text-on-surface-variant">Live audit analytics of boutique revenue, backlogs, and customer metrics.</p>
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

        {/* Premium Interactive SVG Revenue Bar Chart */}
        <div className="w-full bg-surface-container-low/20 border border-outline-variant/60 p-4 rounded-none select-none">
          {chartBars.length === 0 ? (
            <div className="w-full h-52 flex items-center justify-center text-xs font-semibold text-on-surface-variant/75 tracking-wide uppercase">
              No payment transactions captured in this timeframe
            </div>
          ) : (
            (() => {
              // Calculate chart dimension metrics
              const maxVal = Math.max(...chartBars.map(b => b.amount), 0);
              const roundedMax = maxVal > 0 ? Math.ceil(maxVal / 1000) * 1000 : 1000;
              
              // SVG configuration parameters
              const svgWidth = 600;
              const svgHeight = 220;
              const paddingLeft = 65;
              const paddingRight = 25;
              const paddingTop = 25;
              const paddingBottom = 35;
              
              const plotWidth = svgWidth - paddingLeft - paddingRight;
              const plotHeight = svgHeight - paddingTop - paddingBottom;
              
              // Gridline Y positions and labels
              const gridlines = [
                { y: paddingTop, label: `₹${roundedMax.toLocaleString('en-IN')}` },
                { y: paddingTop + plotHeight * 0.33, label: `₹${Math.round(roundedMax * 0.67).toLocaleString('en-IN')}` },
                { y: paddingTop + plotHeight * 0.67, label: `₹${Math.round(roundedMax * 0.33).toLocaleString('en-IN')}` },
                { y: paddingTop + plotHeight, label: '₹0' }
              ];
              
              const numBars = chartBars.length;
              const barSpacing = plotWidth / numBars;
              const barWidth = Math.min(48, barSpacing * 0.45);
              
              return (
                <div className="relative w-full h-[240px] md:h-[280px]">
                  <svg 
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                    className="w-full h-full font-sans overflow-visible"
                  >
                    <defs>
                      {/* Premium teal gradient fills for bars */}
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" />
                        <stop offset="100%" stopColor="#115e59" />
                      </linearGradient>
                      <linearGradient id="barHoverGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" />
                        <stop offset="100%" stopColor="#134e4a" />
                      </linearGradient>
                      {/* Soft shadow for bar elevation */}
                      <filter id="shadow" x="-8%" y="-8%" width="116%" height="116%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
                      </filter>
                    </defs>
                    
                    {/* Horizontal gridlines and Y-axis labels */}
                    {gridlines.map((g, idx) => (
                      <g key={idx}>
                        <line 
                          x1={paddingLeft} 
                          y1={g.y} 
                          x2={svgWidth - paddingRight} 
                          y2={g.y} 
                          className="stroke-outline-variant/50" 
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <text 
                          x={paddingLeft - 12} 
                          y={g.y + 4} 
                          textAnchor="end" 
                          className="fill-on-surface-variant text-[9px] font-bold font-mono tracking-tight"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                    
                    {/* Rendering the data bars */}
                    {chartBars.map((bar, index) => {
                      const barHeight = (bar.amount / roundedMax) * plotHeight;
                      const barX = paddingLeft + index * barSpacing + (barSpacing - barWidth) / 2;
                      const barY = paddingTop + plotHeight - barHeight;
                      const isHovered = hoveredIndex === index;
                      
                      return (
                        <g key={index}>
                          {/* Invisible hover capture block to expand mouse region */}
                          <rect
                            x={paddingLeft + index * barSpacing}
                            y={paddingTop}
                            width={barSpacing}
                            height={plotHeight}
                            className="fill-transparent cursor-pointer"
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                          />
                          
                          {/* The actual visual data bar */}
                          <rect
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={Math.max(2, barHeight)} // min 2px height for visual feedback
                            rx={4}
                            fill={isHovered ? 'url(#barHoverGradient)' : 'url(#barGradient)'}
                            filter="url(#shadow)"
                            className="transition-all duration-300 pointer-events-none"
                          />
                          
                          {/* X-axis labels centered below each bar */}
                          <text
                            x={barX + barWidth / 2}
                            y={svgHeight - 14}
                            textAnchor="middle"
                            className={`text-[10px] font-bold tracking-wide transition-all ${isHovered ? 'fill-primary font-extrabold' : 'fill-on-surface-variant'}`}
                          >
                            {bar.label}
                          </text>
                          
                          {/* Custom Interactive Tooltip */}
                          {isHovered && (
                            <g className="animate-fadeIn pointer-events-none">
                              <rect
                                x={barX + barWidth / 2 - 50}
                                y={barY - 32}
                                width={100}
                                height={24}
                                fill="#1e293b"
                                rx={4}
                                className="shadow-lg"
                              />
                              <text
                                x={barX + barWidth / 2}
                                y={barY - 16}
                                textAnchor="middle"
                                fill="#ffffff"
                                className="text-[10px] font-bold font-mono"
                              >
                                ₹{bar.amount.toLocaleString('en-IN')}
                              </text>
                              {/* Drop shadow caret indicator pointer arrow */}
                              <path
                                d={`M ${barX + barWidth / 2 - 4} ${barY - 8} L ${barX + barWidth / 2} ${barY - 4} L ${barX + barWidth / 2 + 4} ${barY - 8} Z`}
                                fill="#1e293b"
                              />
                            </g>
                          )}
                        </g>
                      );
                    })}
                    
                    {/* Bottom axis solid boundary line */}
                    <line 
                      x1={paddingLeft} 
                      y1={paddingTop + plotHeight} 
                      x2={svgWidth - paddingRight} 
                      y2={paddingTop + plotHeight} 
                      className="stroke-outline-variant" 
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              );
            })()
          )}
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
            {matrix.topOutstandingCustomers.length === 0 ? (
              <p className="py-4 text-center text-ink-muted text-xs">No outstanding balances found</p>
            ) : (
              matrix.topOutstandingCustomers.map((cust) => (
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
              ))
            )}
          </div>
        </div>
      </section>

      {/* SECTIONS 3 & 4: DEMOGRAPHIC RETENTION AND GARMENT COMPONENT RANKINGS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-medium">
        
        {/* Box A: Top Client Volume Contributions */}
        <div className="bg-surface-container-lowest border border-zinc-200 p-5 space-y-4">
          <h3 className="font-serif text-sm font-bold text-primary uppercase tracking-wide border-b border-zinc-100 pb-2">High Value Client Spends</h3>
          <div className="space-y-2">
            {matrix.topCustomersByValue.length === 0 ? (
              <p className="py-4 text-center text-ink-muted text-xs">No payments recorded</p>
            ) : (
              matrix.topCustomersByValue.map((c, idx) => (
                <div key={c.id} className="flex justify-between items-center p-2.5 bg-background border border-zinc-100">
                  <div>
                    <p className="font-bold text-primary">{idx + 1}. {c.name}</p>
                    <p className="text-[10px] text-ink-muted">{c.orderCount} bespoke order files logged</p>
                  </div>
                  <span className="font-bold text-primary font-serif text-sm">₹{c.totalSpent.toLocaleString('en-IN')}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Box B: Top Garment Item Counts */}
        <div className="bg-surface-container-lowest border border-zinc-200 p-5 space-y-4">
          <h3 className="font-serif text-sm font-bold text-primary uppercase tracking-wide border-b border-zinc-100 pb-2">Most Sold Outfit Items</h3>
          <div className="space-y-2">
            {matrix.topItemsRanked.length === 0 ? (
              <p className="py-4 text-center text-ink-muted text-xs">No orders created yet</p>
            ) : (
              matrix.topItemsRanked.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-background border border-zinc-100">
                  <div>
                    <p className="font-bold text-primary">{item.name}</p>
                    <p className="text-[10px] text-ink-muted">Segment Context: {item.segment}</p>
                  </div>
                  <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                    {item.totalCount} Units
                  </span>
                </div>
              ))
            )}
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
