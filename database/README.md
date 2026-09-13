# RentFlow — Vehicle Rental Management System

A professional, full-featured vehicle rental management system featuring dedicated workflows for **Customers (Guests)**, **Operations Staff (Managers)**, and **System Administrators**.

Built with modern Vanilla JavaScript (ES Modules), custom responsive CSS, and powered by Supabase (PostgreSQL with Row Level Security).

---

## Features

### 1. Guest / Customer Portal
- **Vehicle Catalog:** Browse vehicles filtered by categories (Sedans, SUVs, MPVs, Economy, Motorcycles, Vans).
- **Search & Filter:** Instant search by model name, transmission, fuel type, and price range.
- **Booking Workflow:** Multi-step reservation process with date picker, price calculation, and optional promo codes.
- **My Bookings:** Track booking status (Pending, Approved, Active, Completed), payment receipts, and balance dues.
- **Profile & Favorites:** Manage personal details and driver's license, and bookmark favorite vehicles.

### 2. Operations / Staff Portal
- **Operations Dashboard:** Live fleet overview, rental statistics, and pending actions.
- **Booking Requests:** Review, approve, or reject incoming reservations with reason notes.
- **Active Rentals & Handovers:** Record downpayments, release vehicles, and monitor ongoing trips.
- **Vehicle Returns:** Inspect vehicle condition, log extra charges (damages/fuel), finalize returns, and issue receipts.
- **Refunds & Claims:** Process deposit returns and vouchers.

### 3. Administrator Portal
- **Fleet Management:** Add, edit, decommission, and maintain vehicles with custom daily rates and photo uploads.
- **Categories & Rates:** Configure vehicle classes and default rental pricing.
- **Transactions & Analytics:** Comprehensive audit log of all bookings, revenues, payments, and fleet utilization.
- **System Settings:** Customize company branding, contact info, rental terms, and tax policies.

---

## Tech Stack
- **Frontend:** HTML5, Modern CSS3 (CSS Variables, Flexbox, Grid, Light & Dark Theme), Vanilla JavaScript (ES6+ Modules)
- **Icons & Typography:** FontAwesome 6, Inter, Plus Jakarta Sans, Space Grotesk
- **Backend & Database:** Supabase (PostgreSQL, Row Level Security, Storage)

---

## Getting Started

### 1. Database Setup
1. Create a project on [Supabase](https://supabase.com).
2. Go to **SQL Editor** -> **New Query**.
3. Copy and run the contents of [schema.sql](schema.sql).

### 2. Configure API Credentials
Open `js/config.js` and input your Supabase project URL and anon key:
```javascript
export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 3. Running Locally
Run with any local web server:
- **VS Code:** Right-click `index.html` -> **Open with Live Server**.
- **Node.js:** `npx serve .`
- **Python:** `python -m http.server 5500`

Visit `http://localhost:5500` in your web browser.
