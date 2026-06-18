# Changelog & Reference Manual: Today's System Fixes & SVG Analytics
**Date**: June 14 - 18, 2026  
**Project**: Multi-tenant Vendor SaaS Platform (The Atelier)  
**Author**: Antigravity AI  

This document provides a detailed, comprehensive reference of every change made to the repository. It outlines the root causes, architecture adjustments, database fixes, interactive SVG chart widgets, data seeding, and deployment procedures for future reference.

---

## Table of Contents
1. [Architectural Overview & Next.js API Routes](#1-architectural-overview--nextjs-api-routes)
2. [Database Trigger Repair & Calculation Engine](#2-database-trigger-repair--calculation-engine)
3. [Sanskriti Couture (Lehenga & Saree) Data Seeding](#3-sanskriti-couture-lehenga--saree-data-seeding)
4. [Premium Interactive SVG Analytics Dashboards](#4-premium-interactive-svg-analytics-dashboards)
5. [React Custom Hooks & Safety Guard Enhancements](#5-react-custom-hooks--safety-guard-enhancements)
6. [Complete File Changes Log](#6-complete-file-changes-log)
7. [Deployment & Verification Steps](#7-deployment--verification-steps)

---

## 1. Architectural Overview & Next.js API Routes

### Root Cause: Assistant Invite "Failed to Fetch" (CORS Preflight Blocks)
* Programmatic creation of Supabase Auth users requires the `service_role` key, which must never be exposed to the client browser.
* To resolve this, a backend endpoint (`POST /api/staff/invite`) was originally added to a separate backend Express service.
* However, when deployed, the Express backend ran on a different Vercel domain than the frontend, leading to **CORS Preflight failures** on Vercel preview/production links due to strict domain whitelists.

### Solution: Next.js Serverless API Route Migration
Instead of running a separate backend service that introduces cross-origin issues and setup overhead, we integrated the invitation backend handler directly into the Next.js App Router as a serverless API route:
* **File**: `frontend/app/api/staff/invite/route.ts`
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
* **File**: `fix_triggers.sql` (located in the workspace root)
* Registers **4 core database triggers**:
  1. `trg_generate_order_number` (`BEFORE INSERT`): Automatically generates order numbers in the format `ORD-YYYYMM-XXXX`.
  2. `trg_calculate_order_outstanding` (`BEFORE INSERT OR UPDATE`): Enforces `amount_outstanding = total_amount - amount_paid`.
  3. `trg_update_balances_on_payment` (`AFTER INSERT OR UPDATE OR DELETE`): Summarizes all payment amounts for an order, updates the order's `amount_paid`, and recalculates the customer's total outstanding balances.
  4. `trg_update_customer_outstanding_on_order` (`AFTER INSERT OR UPDATE OR DELETE`): Syncs the customer's total outstanding balance when orders are added, edited, or moved between clients.
* Runs a **data-repair sequence** on existing records to recalculate balances and populate any null `order_number` values.
* **This operation preserves all existing store configuration, owners, and client data.**

---

## 3. Sanskriti Couture (Lehenga & Saree) Data Seeding

To provide a fully populated demo environment for design and analytics validation, we created and executed an automated database seeding script.

* **Seeding Script**: `seed_new_store.js` (under `backend/scratch/` or workspace root)
* **Demo Store Configuration**: 
  - **Store Name**: `Sanskriti Couture` (A high-end boutique specializing in bridal Lehengas, Sarees, and custom Saree Blouses).
  - **Measurement Templates**: Custom templates added for `Lehenga` (Waist, Length, Hip, Flare, Under-skirt) and `Saree Blouse` (Bust, Waist, Shoulder, Sleeve Length, Arm Hole, Front Neck Depth, Back Neck Depth).
* **Seeded Entities**:
  - **1 Owner account** (`sanskriti@gmail.com`) and **1 Assistant account** (`sanskriti_assistant@gmail.com`).
  - **10 Customers** with individual measurements populated using the custom templates.
  - **18 Orders** tracking status and payments (gross revenue sums to ₹3,03,700).
  - **10 Appointments** for bridal trials, design consultations, and pickup fittings.

---

## 4. Premium Interactive SVG Analytics Dashboards

We refactored `frontend/app/dashboard/analytics/page.tsx` to replace simple block bars with three beautiful, interactive SVG charts:

### A. Revenue Trends (Area / Line Chart)
* **Visuals**: A smooth area chart representing manual payment credits captured across selected timelines. Incorporates linear SVG gradients (`#areaGradient`) for a modern, glowing teal visual.
* **Interactive Crosshair**: Hovering over the chart draws a vertical coordinate line tracking the cursor and snaps a glowing dot to the area curve.
* **Floating Tooltip**: Shows the exact date/label and the formatted payment amount (e.g. `₹4,000`) in a floating dark tooltip card.
* **Dynamic Scaling**: Automatically rounds the maximum value to the nearest thousand and divides the scale evenly (e.g. ₹0, ₹2,000, ₹4,000) with dashed horizontal coordinates lines.

### B. Garment Segment Sales (Donut Chart)
* **Visuals**: A circular donut chart dividing sales contribution by garment categories (Lehengas vs. Sarees vs. Blouses). 
* **Interactive Hover segments**: Hovering over a legend item or donut segment expands its stroke width (from 16px to 22px) and highlights it.
* **Center HUD**: Dynamically renders the segment's label, revenue sum, and percentage share directly inside the center of the donut chart.
* **Layout Fix**: Removed the CSS `origin-center` (`transform-origin: center`) class which previously caused segments to render off-center and shift down outside the card container. Segments now rotate perfectly around the coordinate center `(donutX, donutY)`.

### C. Production Pipeline (Concentric Radial Rings)
* **Visuals**: Apple-Watch style concentric radial rings displaying order counts across workflow statuses (Delivered, Ready, In Production, Pending).
* **Dynamic Central HUD**: Displays the active ring's status label and order count when hovered (or total order count by default).
* **Layout Fix**: Shifted the vertical center from `180` to `110` (half of the `220px` height) so the rings are perfectly contained within the SVG canvas instead of clipping and overflowing into the rest of the page.

---

## 5. React Custom Hooks & Safety Guard Enhancements

### React Rules of Hooks Violations Resolved
* **Root Cause**: The order queries in `frontend/hooks/useOrders.ts` were previously defined as nested closures (`useOrders().useDetails()`), which violates the React Rules of Hooks and causes component re-render compilation warning crashes.
* **Solution**: Refactored the closures into static, top-level custom hooks (`useListOrders`, `useOrderDetails`, `useCreateOrder`, `useRecordPayment`). Maintained backward compatibility mapping inside the exported `useOrders` helper.

### Search Filtering Safety Guards
* **Root Cause**: Typing in the customer/order list search bar threw `TypeError: Cannot read properties of null (reading 'toLowerCase')` whenever a database record had an empty field, unmounting the entire application.
* **Solution**: Added strict guard clauses (`customer && customer.full_name`, `order.order_number || ''`) into the filter mappings in `customers/page.tsx` and `orders/page.tsx`.

---

## 6. Complete File Changes Log

Here is the index of files created or modified:

### A. Frontend Files (Next.js)

1. **`frontend/app/api/staff/invite/route.ts`** `[NEW]`
   * Standard Next.js serverless route handler. Validates the owner session, creates the Auth user using the service role key, and inserts the staff profile.
   
2. **`frontend/app/dashboard/settings/page.tsx`** `[MODIFY]`
   * Updated the `inviteStaffMutation` to call the relative URL `/api/staff/invite`.
   * Displays clear inline success (`check_circle` icon) or failure (`error` icon) alerts.

3. **`frontend/app/dashboard/analytics/page.tsx`** `[MODIFY]`
   * Added `segmentSales` and `pipelineRings` to type declarations.
   * Restructured the chart renderer to include the Area, Donut, and Concentric Rings SVG widgets.
   * Fixed type-inference destructuring by including default fields.
   * Removed conflicting CSS `origin-center` class on donut segments and centered radial rings vertically at `centerY = 110`.

4. **`frontend/hooks/useOrders.ts`** `[MODIFY]`
   * Refactored hook nesting structures to eliminate hook-state compiler violations.

5. **`frontend/app/dashboard/orders/create/page.tsx`** `[MODIFY]`
   * Replaced hardcoded client mock data with live customer listings and hooked up the database insert mutation.

6. **`frontend/app/dashboard/orders/page.tsx` & `customers/page.tsx`** `[MODIFY]`
   * Wrapped search filters inside safe empty-string fallbacks to prevent runtime unmounting crashes.

### B. SQL Scripts

1. **`fix_triggers.sql`** `[NEW]`
   * Safe, SQL file to recreate database triggers and repair outstanding ledger balances without losing data.
   
2. **`cleanup_mock_data.sql`** `[MODIFY]`
   * Added trigger recreation instructions and data repair routines.

---

## 7. Deployment & Verification Steps

### Step 1: Run the Database Repairs
1. Log in to your **Supabase Dashboard** and navigate to the **SQL Editor**.
2. Copy all code from the [fix_triggers.sql](file:///c:/Users/vsoha/Desktop/Work/igloo/vendor-saas/fix_triggers.sql) file.
3. Run the script.

### Step 2: Add Vercel Environment Variables
1. Open your **Vercel Project Settings** for the frontend application.
2. Under **Environment Variables**, add:
   * **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   * **Value**: *(Your Supabase service_role key - copy this from Supabase Dashboard → Settings → API)*

### Step 3: Verify Sanskriti Couture Store (Lehengas & Sarees)
You can log in to the newly seeded boutique using the following credentials:
* **Owner Profile**:
  * **Email**: `sanskriti@gmail.com`
  * **Password**: `password123`
* **Assistant Profile**:
  * **Email**: `sanskriti_assistant@gmail.com`
  * **Password**: `password123`

### Step 4: Verify the SVG Charts
* Navigating to `/dashboard/analytics` displays the interactive Gross Revenue Area chart, the Garment Segment Donut chart, and the Production Pipeline concentric rings. All charts render without visual displacement or clipping.
