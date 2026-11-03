# Antigravity Setup: Rentals UI Restyle

## Bago magsimula

1. I-commit muna ang kasalukuyang code (`git add . && git commit -m "before restyle"`). Ito ang pang-balik mo kung may masira.
2. Gumawa ng folder `reference/` sa project root at ilagay doon ang `ui-reference-board.html` at `restyle-prompt.md`. Gumawa rin ng `reference/images/` at ilagay ang anim na PNG mula sa `reference-images/` (1-homepage, 2-sign-in, 3-renter-portal, 4-booking-process, 5-staff-portal, 6-admin-portal). Sa bawat stage, i-drag o i-paste din ang PNG ng screen na yun sa chat box kung tumatanggap ito ng image. Kung hindi, sapat na ang nasa folder, dahil nakasulat sa prompt na buksan ng agent ang file.
3. Sa Antigravity: File > Open Folder, piliin mismo ang `rentals` folder (yung may `index.html`), hindi ang parent folder.
4. Sa Agent Manager, piliin ang **Planning** mode (hindi Fast). Sa bawat stage, basahin ang Implementation Plan bago i-approve.
5. **Contract checker (importante para gumana ang lahat ng button):** kopyahin ang `scripts/contract-check.mjs` sa `rentals/scripts/`. Habang buo pa ang code mo at wala pang binabago, i-run ito sa terminal sa loob ng `rentals` folder:
   ```
   node scripts/contract-check.mjs --init
   ```
   Gagawa ito ng baseline ng lahat ng id, class, data-attribute, handler at bilang ng buttons na kailangan ng JS mo (sa scan ko: 395 ids, 253 buttons, 312 listeners). Mula dito, ang `node scripts/contract-check.mjs` na walang dagdag ay dapat laging magbigay ng "OK". Kung may lumabas na "CONTRACT BROKEN", may nasira, at hindi pwedeng ituloy ang stage hangga't hindi naaayos. I-commit din ang baseline file.

## Step 1: Rule (Always On)

Sa Antigravity: ... menu > Customizations > Rules > **+ Workspace** > Activation Mode: **Always On**. I-paste ang nasa ibaba at i-save bilang `rentals-ui-restyle`. (Gamitin ang panel na ito para ang Antigravity mismo ang pumili ng tamang folder path, dahil magkaiba ang nakasulat sa iba't ibang guide: `.agent/` o `.agents/`.)

```
# Rentals UI restyle rules

Project: vanilla HTML/CSS/ES-module vehicle rental system (Supabase backend). Styles are in css/, markup is rendered from js/*.js. Visual reference: reference/ui-reference-board.html (open it in the browser and compare against it).

Hard rules:
1. Never modify, rename, move, crop, recolor or re-export anything in images/. Never change image_url values. Do not add filters, overlays or blend modes to photos. Vehicle photos are white-background cutouts: use object-fit: contain on a white panel.
2. Do not change business logic: Supabase calls, auth, state, realtime, booking calculations, QR scanning, role switching. Keep every id, data-* attribute and class that JavaScript queries. If you rename one, update the JS selector in the same change.
3. No emojis anywhere (HTML, CSS content, JS strings, toasts, placeholders). Icons only as consistent inline SVG line icons, used sparingly.
4. Theme: soft lavender, flat. Define all colors in css/variables.css only. Background #F5F2FB, surface #FFFFFF, tint #E9E3F7, border #E2DCF0, ink #2A2340, secondary text #5E5778, muted #8C86A3, primary #5B4B8A (hover #4A3C73). Status colors muted: green #3E7C62, amber #B07A2A, rose #B24A5A.
5. Banned: gradients on buttons/cards, glow shadows, glassmorphism/backdrop blur, gradient text, mesh backgrounds, shimmer, bouncing or pulsing animations, !important overrides, hard-coded colors in inline style attributes.
6. Typography: Fraunces for headings, prices and numbers; DM Sans for UI and body. Remove Inter, Outfit, Plus Jakarta Sans. Sentence case headings.
7. Copy must be plain and specific. No filler like "Next-Gen", "World-Class", "Luxury". No invented testimonials or fake stats.
8. Delete dead CSS instead of layering new rules over old ones.
9. Layout: 8px spacing scale, 12-14px card radius, 9px control radius, max content width 1200px, usable at 375px width, touch targets at least 44px.
10. After each stage, run `node server.js` (port 5500), check the browser console for errors, and report what you verified and what you could not.

Scope discipline (do not over-imagine):
11. Do exactly what the prompt and reference board say, nothing more. This is a restyle, not a redesign: keep the existing pages, sections, features, navigation and data. Do not add, remove or rename features, pages, sections, buttons, fields or menu items.
12. Do not invent content: no new text blocks, stats, testimonials, badges, icons, illustrations, animations, sample data or images. Reuse the copy and data already in the project. Change wording only where the prompt names it (filler marketing phrases).
13. Use the reference board for layout and style only. If the board shows something the project has no data or feature for, skip it and list it in your report instead of building it. All names, prices, dates, counts and people shown in the board (for example "Palawan Drive", "PHP 2,200", "Juan Dela Cruz") are placeholders: never copy them into the project, always use the project's real data and existing brand text.
14. Do not refactor, reorganize files, rename classes, upgrade dependencies or "improve" code that the stage does not mention.
15. If an instruction is ambiguous or two readings are possible, choose the smaller change, or ask me in one short question before editing. Do not guess big.
16. Before editing, list the files you will touch. Touch only those. Anything outside the stage's scope goes in a "Suggestions, not done" list at the end of your report.

Buttons and interactions:
17. Every button, link, tab, toggle, menu item, modal control and form submit that works now must still work after the restyle. Never remove an element or wrapper that has an event listener, onclick or data-* hook. Do not replace a <button> with a <div>, and do not nest interactive elements.
18. Every interactive element needs all states styled: default, hover, focus-visible (lavender ring), active (pressed), disabled (muted, cursor not-allowed), and loading where the app already shows one. Do not rely on hover alone, since phones have no hover.
19. No overlay, pseudo-element, sticky bar or z-index change may cover or block a clickable element. Set pointer-events deliberately and check stacking order on the nav, modals, drawers and the booking summary card.
20. Buttons must be responsive on mobile: at least 44px tall touch targets, text never clipped or overflowing, full-width primary action in forms under 600px, button groups wrap or stack instead of overflowing, no horizontal page scroll at 375px.
21. Everything must keep working. Before the first edit of any stage, run `node scripts/contract-check.mjs` and confirm OK. After every batch of edits, run it again. If it prints CONTRACT BROKEN, fix it before doing anything else. Never edit scripts/contract.baseline.json to make the check pass.
22. Do not finish a stage until the check passes AND you have clicked every control of that stage's screens in the browser. Report controls that did not respond instead of hiding or deleting them.
```

## Step 2: Mga prompt, isa-isang stage

Magbukas ng bagong conversation sa Agent Manager kada stage para hindi mapuno ang context.

Sa bawat stage, idagdag sa dulo ng prompt ang linyang ito, palitan ang pangalan ng PNG ayon sa screen:

```
Visual reference for this stage: reference/images/<screen>.png (attached). Open and look at the image before editing. Match its layout, spacing, type and colors. Treat all names, prices, dates and numbers in the image as placeholders and use the project's real data. The image is a style target, not a feature list.
``` I-commit pagkatapos ng bawat stage na pumasa.

### Stage 0: Audit (walang babaguhin)

```
Do not edit any files yet. Read css/variables.css, css/components.css, css/portal.css, css/booking.css, css/admin.css and the render functions in js/app.js, js/auth.js, js/booking.js, js/customer.js, js/vehicles.js, js/admin.js. Produce a report listing: (1) every hard-coded color, gradient and !important, (2) every inline style="" in JS templates, (3) every emoji character in the project, (4) every id/class that JS queries and must be preserved, (5) a button inventory: every button, link, tab, toggle and form submit per screen (renter, staff, admin, booking, landing, auth, modals), with its id/selector and the JS handler that responds to it. Open reference/ui-reference-board.html in the browser and note how each of the 6 screens should map onto the existing markup.
```

### Stage 1: Design tokens, fonts, base components

```
Follow the workspace rules. Rewrite css/variables.css with the lavender tokens (remove the dark-mode override block, or rebuild it later as a separate proper theme using the same variable names). Replace the Google Fonts link in index.html with Fraunces and DM Sans only. Rewrite css/base.css and css/components.css: buttons (primary, ghost, small), inputs with labels and lavender focus ring, pill tags, cards, tables, modals, toasts, stepper. Remove gradients, glow and backdrop blur. Do not touch images/. Verify the app still loads and sign in works.
```

### Stage 2: Homepage and Sign in

```
Follow the workspace rules and match the Homepage and Sign in tabs of reference/ui-reference-board.html. Homepage: top nav, split hero using images/hero-fleet.jpg unedited, search bar card, "Available this week" grid from the existing live vehicle data, plain four-column stats strip, About/Reviews/Privacy as simple editorial sections, footer. Sign in: 50/50 split with images/travel-vacation.jpg unedited on the left, form on the right with Renter/Staff/Admin segmented control. Keep all auth.js ids and handlers working. Rewrite copy to be plain and specific. Test sign in for all three roles.
```

### Stage 3: Renter portal and Booking process

```
Follow the workspace rules and match the Renter and Booking tabs of the reference board. Renter: top bar, upcoming-booking banner, filter chips, 4-column vehicle grid (photos contained on white). Booking: 3-step stepper (Vehicle, Dates and Driver, Fill-up and Pay), forms in the left column, sticky summary card on the right, Back/Continue at the bottom. Do not change price calculation, date validation or Supabase writes. Complete one full test booking and confirm the totals are unchanged from before.
```

### Stage 4: Staff portal

```
Follow the workspace rules and match the Staff tab of the reference board: 220px left sidebar with tinted active item, KPI row, requests table with status pills and one action per row, handover panel with QR scan area. Keep the scanner (html5-qrcode) working and keep all existing staff views (dashboard, scanner, requests, active rentals, returns) reachable. Collapse the sidebar into a slide-in drawer under 900px.
```

### Stage 5: Admin portal

```
Follow the workspace rules and match the Admin tab of the reference board: same shell as staff, KPI row with delta text, revenue bar chart in a single accent color, fleet-status breakdown, recent bookings table. Restyle the vehicles, customers, users, reports and settings pages with the same table, form and modal components. Do not change any data queries or permissions logic.
```

### Stage 6: QA pass

```
Do not add new features. Run a QA pass: (1) search the entire project for emoji characters and remove them, (2) confirm `git diff --stat` shows nothing changed under images/, (3) check every screen at 1280px, 768px and 375px using the browser, with screenshots as artifacts, (4) check text contrast is at least 4.5:1, (5) list any remaining inline style colors, !important rules or unused CSS and remove them, (6) using the Stage 0 button inventory, click every single button and control in the browser on desktop and at 375px, and report a table of: control, screen, works yes/no, states styled (hover, focus, active, disabled), overlapped or blocked yes/no. Fix anything that fails. (7) confirm sign in (renter, staff, admin), a full booking, QR scan, and logout still work. Report anything you could not verify.
```

## Kilalang sira na bago pa ang restyle

Sa scan ko ng code, may isang button na wala nang gumagana ngayon pa lang: sa `js/customer.js` (line 363) tumatawag ito ng `window.switchTab('vehicles')`, pero walang nagde-define ng `switchTab` kahit saan. Dahil may `&&` guard ang onclick, tahimik lang itong walang nangyayari kapag pinindot. Hindi ito sisira ng restyle, pero kapag gusto mong "lahat working", ipagawa ito bilang hiwalay na maliit na task pagkatapos ng Stage 6, dahil labas ito sa saklaw ng restyle:

```
Fix one pre-existing bug only. In js/customer.js around line 363, the button calls window.switchTab('vehicles'), but window.switchTab is never defined, so the button does nothing. Make it navigate to the Browse tab, using the same behavior as the existing brand button in js/app.js (state.tab = 'browse'; renderShell()). Change nothing else. Run node scripts/contract-check.mjs and test the button in the browser.
```

## Mga bantay habang nagpapatakbo

- Kung may binabago ang plan sa `images/`, `js/config.js`, `js/auth.js` logic o `js/state.js`, mag-comment sa Implementation Plan at ipatanggal bago i-approve.
- Sa Agent Manager settings, huwag gamitin ang "Agent-driven" na walang review habang nasa Stage 2 hanggang 5. Mas ligtas ang may review sa terminal commands.
- Sa dulo ng bawat stage (2 hanggang 5), ipa-click din sa agent ang lahat ng buttons ng screen na yun gamit ang button inventory mula sa Stage 0, at ipalista ang mga hindi gumana.
- Pagkatapos ng bawat stage, i-run mo mismo ang app at ikumpara sa reference board bago mag-commit.
- Kung naabot mo na ang limit ng model, ipagpatuloy sa susunod na stage sa bagong conversation. Hindi mawawala ang progress dahil naka-commit na.
