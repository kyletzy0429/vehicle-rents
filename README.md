# RentFlow — Vehicle Rental Management System

A complete Customer / Staff / Admin vehicle rental system: plain HTML, CSS, and
JavaScript on the front end, Supabase (Postgres + Auth + Row Level Security)
on the back end. No build step, no framework — open it and it runs.

Follows the flow: browse → check availability → book → staff approves/rejects
→ payment → vehicle released → customer uses vehicle → return & damage
inspection → finalize payment → vehicle available again → receipt.

## Files

```
index.html    the app shell
style.css     glassmorphism design system
app.js        all application logic (auth, data, all 3 portals)
config.js     <-- put your Supabase URL + anon key here
schema.sql    run this in Supabase to create tables, security rules, seed data
```

## 1. Create a Supabase project

1. Go to https://supabase.com, sign in, and click **New Project**.
2. Pick a name, database password, and region, then wait ~2 minutes for it to spin up.

## 2. Run the database setup

1. In your Supabase project, open **SQL Editor** → **New query**.
2. Open `schema.sql` from this folder, copy the whole file, paste it in, and click **Run**.
3. This creates all tables (`profiles`, `categories`, `vehicles`, `bookings`,
   `payments`, `rental_returns`, `receipts`), sets up Row Level Security so
   customers only see their own data while staff/admin see everything, adds a
   trigger that auto-creates a `profiles` row whenever someone signs up, and
   seeds a few sample categories and vehicles so the app isn't empty on first run.

## 3. Connect the app to your project

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key.
3. Open `config.js` and paste them in:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

The anon key is meant to be public — your Row Level Security policies (already
set up by `schema.sql`) control what each user can actually read or write.

## 4. Turn off "Confirm email" for easy local testing (optional)

By default Supabase requires email confirmation before login works. For quick
testing: **Authentication → Providers → Email** → turn off **Confirm email**.
(Leave it on if you want a production-realistic flow with real inboxes.)

## 5. Run it

Because the app uses ES module imports, open it through a local web server
rather than double-clicking the file. Any of these work:

**Option A — VS Code:** install the "Live Server" extension, right-click
`index.html` → **Open with Live Server**.

**Option B — Python (already on most Macs/Linux):**
```bash
cd vehicle-rental
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.

**Option C — Node:**
```bash
cd vehicle-rental
npx serve .
```

## 6. Try all three portals

The sign-up form has a role picker (Customer / Staff / Admin) so you can
create one test account for each and try the whole flow:

1. **Sign up as Customer** → Browse Vehicles → open a vehicle → pick dates →
   submit a booking request.
2. **Sign up as Staff** (separate email) → Booking Requests → Approve it →
   Active Rentals → Record Payment (marks it successful) → vehicle becomes
   "rented."
3. Back in the **Staff** account → Returns → Process Return on that booking →
   say "No" to damage (or "Yes" and enter a charge) → Finalize. This generates
   a receipt and frees the vehicle up again.
4. Back in the **Customer** account → My Bookings → the completed booking now
   has a **View Receipt** button.
5. **Sign up as Admin** (separate email) → Dashboard for stats, Vehicles /
   Categories & Rates to manage the fleet and pricing, Users to promote or
   demote roles, Rentals & Transactions and Reports for the full picture.

> **Production note:** the role picker on sign-up is a deliberate demo
> shortcut so you can test every portal without manual database edits. Before
> shipping this for real, remove the role selector from sign-up (default
> everyone to `customer`) and instead promote trusted people to `staff` or
> `admin` from the Admin → Users panel — the database policies already
> restrict role changes to admins only, so the UI is the only thing to change.

## How the workflow maps to the code

| Flowchart step | Where it happens |
|---|---|
| Browse / Search / Check Availability | `renderBrowse()`, `openVehicleDetail()` in app.js — checks for overlapping bookings before allowing a request |
| Submit Booking Request | inserts a `bookings` row with `status = 'pending'` |
| Staff reviews / Approve / Reject | `renderStaffRequests()` — updates `bookings.status` and, on reject, stores a note the customer sees |
| Record Payment / Payment Successful? | `openStaffPaymentModal()` and the customer-side `openPaymentModal()` — inserts into `payments`; on success sets booking to `active` and vehicle to `rented` |
| During Rental Period | booking stays `active`; nothing to do until return |
| Return Process / Inspect / Damage | `openReturnModal()` — inserts into `rental_returns`, optionally adds a payment for damage charges |
| Finalize Payment / Update Vehicle / Generate Receipt | booking set to `completed`, vehicle set to `available`, a row inserted into `receipts` |
| Admin panels | `renderAdminDashboard/Vehicles/Categories/Users/Rentals/Reports()` |

## Customizing the look

All design tokens (colors, radii, blur) live at the top of `style.css` under
`:root`. Swap the `--accent`, `--bg-1/2/3` gradient stops, or fonts there to
retheme the whole app without touching component styles.
