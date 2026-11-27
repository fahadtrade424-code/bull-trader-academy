# Sir Hamza Bull Trader Academy — Static Website

A complete, 100% static HTML5, CSS3, and Vanilla JavaScript website for **Sir Hamza Bull Trader Academy**. Designed specifically for direct hosting on **GitHub Pages** with zero backend servers, zero databases, and zero runtime dependencies.

## Features Included

- **Luxury Dark & Metallic Gold Design**: Responsive layout for mobile, tablet, and desktop with lightweight HTML5 Canvas candlestick animation and custom 3D Golden Bull hero centerpiece.
- **Four-Step Student Admission System (`#admission`)**:
  1. Personal Information (with optional profile photo upload)
  2. Course & Payment Selection (dynamic batches, auto fee calculation, Transaction ID, payment screenshot upload)
  3. Goals & Agreement (trading experience, learning goals, terms & conditions)
  4. Confirm & Sign (complete preview + touch/mouse digital signature canvas + unique Student ID generation + instant client-side PDF Admission Slip download)
- **Student Portal (`#portal`)**: Login using Student ID to view profile, admission status, selected course & batch, payment verification status, and download the official PDF Admission Slip.
- **Student ID Verification (`#verify`)**: Public lookup tool to verify locally stored Student IDs and inspect admission and payment status.
- **Eight-Module Admin Panel (`#admin`)**:
  1. Executive Dashboard
  2. Students Management (search, filter, view, approve, reject, edit, delete)
  3. Batch Management (add, edit, delete, schedule, availability)
  4. Course Management (add, edit, delete, fee, description)
  5. Payment Verification (screenshot inspection, approve/reject/update)
  6. Student ID Management (generate, view, verify, manage)
  7. Activity Logs (local chronological audit trail)
  8. Admin Settings (profile, local demo password, academy/contact info, JSON backup export & import)

## LocalStorage Architecture Note

All student admissions, courses, batches, payment reviews, activity logs, and settings are stored in the visitor's browser via `localStorage`. Because this is a pure static site with no server:
- Data persists across page refreshes on the same browser and device.
- Use **Admin Settings -> Export Backup (JSON)** and **Import Backup (JSON)** to transfer or back up academy data across devices.
- The Admin Panel login is a client-side demonstration gate (default username: `admin`, default password: `hamza2026`).

## Deploying to GitHub Pages

1. Create a new repository on GitHub (for example, `sir-hamza-bull-trader-academy`).
2. Upload all project files and folders (`index.html`, `css/`, `js/`, `src/`, `README.md`) to the repository root (keeping the exact folder structure).
3. In your GitHub repository, open **Settings** -> **Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder, then click **Save**.
6. Wait 1–2 minutes for GitHub Pages to publish your site at `https://<your-username>.github.io/<repository-name>/`.

All navigation uses hash routing (`#home`, `#admission`, `#portal`, `#verify`, `#admin`) and relative asset paths (`./css/styles.css`, `./js/app.js`, `./src/assets/images/...`), so every route works cleanly on page refresh.

## Academy Contact

- **WhatsApp / Phone**: `0325 6000474`
- **Email**: `sirhamzawebsite@gmail.com`
