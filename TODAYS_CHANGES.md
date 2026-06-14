# Changelog & Reference Manual: Today's System Fixes
**Date**: June 14, 2026  
**Project**: Multi-tenant Vendor SaaS Platform (The Atelier)  
**Author**: Antigravity AI

This document provides a detailed, comprehensive reference of every change made to the repository today. It outlines the root causes, architecture adjustments, database fixes, and deployment procedures for future developer reference.

---

## Table of Contents
1. [Architectural Overview & CORS Optimization](#1-architectural-overview--cors-optimization)
2. [Database Trigger Repair & Calculation Engine](#2-database-trigger-repair--calculation-engine)
3. [Premium SVG Analytics Chart Component](#3-premium-svg-analytics-chart-component)
4. [React Custom Hooks & Safety Guard Enhancements](#4-react-custom-hooks--safety-guard-enhancements)
5. [Complete File Changes Log](#5-complete-file-changes-log)
6. [Deployment & Verification Steps](#6-deployment--verification-steps)

---

## 1. Architectural Overview & CORS Optimization

### Root Cause: Assistant Invite "Failed to Fetch"
* Programmatic creation of Supabase Auth users requires the `service_role` key, which must never be exposed to the client browser. 
* To resolve this, a backend endpoint (`POST /api/staff/invite`) was originally added to a separate backend Express service.
* However, when deployed, the Express backend ran on a different Vercel domain than the frontend, leading to **CORS Preflight failures** ("Failed to fetch") on Vercel preview/production links due to strict domain whitelists.

### Solution: Next.js Serverless API Route Migration
Instead of running a separate backend service that introduces cross-origin issues and setup overhead, we integrated the invitation backend handler directly into the Next.js App Router as a serverless API route:
* **New File**: `frontend/app/api/staff/invite/route.ts`
* **Settings Page Update**: Updated `frontend/app/dashboard/settings/page.tsx` to make a relative fetch call (`fetch('/api/staff/invite')`).
* **Why this is better**:
  1. **No CORS Issues**: Fetching a relative path on the same domain completely avoids browser cross-origin blocks.
  2. **Single-Project Deployment**: You no longer need to manage a separate backend project on Vercel or configure `NEXT_PUBLIC_API_URL`.
  3. **Secured API**: Next.js API routes execute server-side, meaning `SUPABASE_SERVICE_ROLE_KEY` remains completely hidden from the browser.

---

## 2. Database Trigger Repair & Calculation Engine

### Root Cause: Analytics showing ₹0 / Empty Charts
* The Supabase database was missing crucial calculation triggers. When orders were completed or payments registered, the fields `amount_paid` and `amount_outstanding` on orders, and `total_outstanding` on customers remained at `0`.
* Additionally, new orders were generated with `order_number = NULL` because the numbering trigger was not registered.

### Solution: Non-Destructive Trigger & Repair Script
* **New File**: `fix_triggers.sql` (located in the workspace root)
* Registers **4 core database triggers**:
  1. `trg_generate_order_number` (`BEFORE INSERT`): Automatically generates order numbers in the format `ORD-YYYYMM-XXXX`.
  2. `trg_calculate_order_outstanding` (`BEFORE INSERT OR UPDATE`): Enforces `amount_outstanding = total_amount - amount_paid`.
  3. `trg_update_balances_on_payment` (`AFTER INSERT OR UPDATE OR DELETE`): Summarizes all payment amounts for an order, updates the order's `amount_paid`, and recalculates the customer's total outstanding balances.
  4. `trg_update_customer_outstanding_on_order` (`AFTER INSERT OR UPDATE OR DELETE`): Syncs the customer's total outstanding balance when orders are added, edited, or moved between clients.
* Runs a **data-repair sequence** on your existing records:
  * Generates correct numbers for any orders currently showing `order_number = NULL`.
  * Recalculates `amount_paid` and `amount_outstanding` on existing orders.
  * Syncs `total_outstanding` on existing customers.
* **This operation preserves all your current store configuration, owners, and client data.**

---

## 3. Premium SVG Analytics Chart Component

### Root Cause: Unpolished CSS Div Graph
* The previous chart rendered basic CSS blocks with absolute bottom coordinates. It lacked gridlines, Y-axis scale markings, currency formatting, and hovered state detail indicators, making the analytics page look basic.

### Solution: Interactive SVG Canvas Chart
We refactored `frontend/app/dashboard/analytics/page.tsx` to use a native React-SVG interactive chart structure:
* **Interactive Tooltips**: Hovering over a bar reveals a sleek tooltip showing the exact payment total (e.g., `₹4,000`).
* **Dynamic Y-Axis Scaling**: Rounds the maximum payment up to the nearest thousand and divides the scale evenly (e.g. ₹0, ₹2,000, ₹4,000).
* **Premium Design Elements**:
  * Added linear SVG gradients (`#barGradient`, `#barHoverGradient`) for glowing teal colors.
  * Added horizontal dashed coordinates lines.
  * Added drop shadow filters for bar elevation.
  * Added bottom border line alignment boundaries.

---

## 4. React Custom Hooks & Safety Guard Enhancements

### React Rules of Hooks Violations
* **Root Cause**: The order hooks in `frontend/hooks/useOrders.ts` were previously defined as nested closures (`useOrders().useDetails()`), which violates the React Rules of Hooks and causes component re-render compilation warnings/crashes.
* **Solution**: Refactored the closures into static, top-level custom hooks (`useListOrders`, `useOrderDetails`, `useCreateOrder`, `useRecordPayment`). Maintained backward compatibility mapping inside the exported `useOrders` helper.

### Search Filtering Safety Guards
* **Root Cause**: Typing in the customer/order list search bar threw `TypeError: Cannot read properties of null (reading 'toLowerCase')` whenever a database record had an empty field, unmounting the entire application.
* **Solution**: Added strict guard clauses (`customer && customer.full_name`, `order.order_number || ''`) into the filter mappings in `customers/page.tsx` and `orders/page.tsx`.

---

## 5. Complete File Changes Log

Here is the exact index of files created or modified today:

### A. Frontend Files (Next.js)

1. **`frontend/app/api/staff/invite/route.ts`** `[NEW]`
   * Standard Next.js serverless route handler. Validates the owner session, creates the Auth user using the service role key, and inserts the staff profile into the database. Bypasses CORS completely.
   
2. **`frontend/app/dashboard/settings/page.tsx`** `[MODIFY]`
   * Updated the `inviteStaffMutation` to call the relative URL `/api/staff/invite`.
   * Displays clear inline success (`check_circle` icon) or failure (`error` icon) alerts directly underneath the "Add Assistant" form button.

3. **`frontend/app/dashboard/analytics/page.tsx`** `[MODIFY]`
   * Added `hoveredIndex` local state variables.
   * Replaced the CSS-based chart with the premium SVG bar chart.

4. **`frontend/hooks/useOrders.ts`** `[MODIFY]`
   * Refactored hook nesting structures to eliminate hook-state compiler violations.

5. **`frontend/app/dashboard/orders/create/page.tsx`** `[MODIFY]`
   * Replaced hardcoded client mock data with live customer listings and hooked up the database insert mutation.

6. **`frontend/app/dashboard/orders/page.tsx` & `customers/page.tsx`** `[MODIFY]`
   * Wrapped search filters inside safe empty-string fallbacks to prevent runtime unmounting crashes.

### B. Backend Files (Express - Keep for reference)

1. **`backend/api/index.ts`** `[MODIFY]`
   * Added `.vercel.app` wildcard checking to the CORS origin parameters to enable standard browser preflight access for backup deployment configurations.

### C. SQL Scripts

1. **`fix_triggers.sql`** `[NEW]`
   * Safe, non-destructive SQL file to recreate database triggers and repair outstanding ledger balances without losing data.
   
2. **`cleanup_mock_data.sql`** `[MODIFY]`
   * Setup database reset script. Added trigger recreation instructions and data repair routines.

3. **`backend/scratch/seed_new_store.js`** `[NEW]`
   * Automation seeding script using Supabase Admin client to programmatically reset and seed Sanskriti Couture store bridal lehenga & saree data (owner, assistant, templates, measurements, 10 customers, 18 orders, 10 appointments).

---

## 6. Deployment & Verification Steps

### Step 1: Run the Database Repairs
1. Log in to your **Supabase Dashboard** and navigate to the **SQL Editor**.
2. Copy all code from the [fix_triggers.sql](file:///c:/Users/vsoha/Desktop/Work/igloo/vendor-saas/fix_triggers.sql) file.
3. Run the script and ensure it executes successfully.

### Step 2: Add Vercel Environment Variables
1. Open your **Vercel Project Settings** for the frontend application.
2. Under **Environment Variables**, add:
   * **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   * **Value**: *(Your Supabase service_role key - copy this from Supabase Dashboard → Settings → API)*
3. Save the variable.

### Step 3: Push Changes
Deploy the new API route, hook refactoring, and SVG chart:
```bash
git add .
git commit -m "fix: integrated next api route for invite and interactive svg charts"
git push
```

### Step 4: Access Sanskriti Couture Store (Lehengas & Sarees)
You can now log in to the newly seeded boutique using the following credentials on the login screen:
* **Owner Profile**:
  * **Email**: `sanskriti@gmail.com`
  * **Password**: `password123`
* **Assistant Profile**:
  * **Email**: `sanskriti_assistant@gmail.com`
  * **Password**: `password123`

### Step 5: Verify Seeding Details
* **Customers List**: Navigating to `/dashboard/customers` displays 10 new clients (Priya Sharma, Anjali Mehta, etc.).
* **Measurements**: Click on any customer (e.g. Priya Sharma), open the **Measurements** tab, and view detailed "Lehenga Measurements" and "Saree Blouse Measurements" snapshots.
* **Orders**: Open the **Orders** tab to view 18 bridal saree/lehenga orders, complete with custom items and payment/balance tracking.
* **Appointments**: Open `/dashboard/appointments` to view 10 bridal fittings and fabric design consultation schedules.
* **SVG Analytics Chart**: Open `/dashboard/analytics` to view the interactive gross revenue timeline chart bars with dynamic Indian Rupee (`₹`) labels, gridlines, and animated tooltips!

