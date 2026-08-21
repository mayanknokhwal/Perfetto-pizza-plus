# Perfetto Pizza Plus

A full-stack mobile-first food delivery platform, kitchen staff portal, and administrative dashboard. Optimized for Vercel Serverless (Single Unified Function for Hobby Plan compatibility).

## 🚀 Features

- **Customer Web App (`index.html`)**: Interactive food ordering, dynamic zone-based delivery calculation, interactive Leaflet GPS location picker, single-step unified checkout, Cash on Delivery, and PhonePe payment integration.
- **Staff Kitchen Portal (`staff.html`)**: Live kitchen orders queue, real-time status transitions (Accept, Preparing, Out for Delivery, Complete), live elapsed order timers, and MongoDB sync.
- **Admin Dashboard (`admin.html`)**: Dynamic menu & category editor, size-variant pricing, shop status toggle, delivery distance zones (Zone 1-6), free delivery & minimum order thresholds, customer care configuration, team member role approvals, and revenue analytics.
- **Unified Serverless API (`api/index.js`)**: Single entry-point router dispatching to modular controllers (`api/controllers/*`), keeping the total Vercel Serverless Function count at **1** (well under the Hobby plan limit of 12).

## 📁 Project Structure

```
├── api/
│   ├── controllers/
│   │   ├── adminAuthController.js   # Admin role management & team approvals
│   │   ├── authGoogleController.js  # Google OAuth 2.0 auth & verification
│   │   ├── menuController.js        # Menu items CRUD & seeding
│   │   ├── ordersController.js      # Customer & kitchen orders management
│   │   ├── otpController.js         # MSG91 Voice / OTP dispatcher & verifier
│   │   ├── paymentController.js     # PhonePe payment initiate, status, webhook
│   │   └── usersController.js       # Customer user profiles sync
│   └── index.js                     # Unified Master Serverless Router
├── lib/
│   └── mongodb.js                   # MongoDB Atlas connection pooling
├── models/
│   ├── AdminUser.js                 # Mongoose AdminUser schema
│   ├── MenuItem.js                  # Mongoose MenuItem schema
│   ├── Order.js                     # Mongoose Order schema
│   └── User.js                      # Mongoose User schema
├── admin.html                       # Admin Dashboard
├── index.html                       # Customer Ordering App
├── staff.html                       # Staff Kitchen Portal
├── styles.css                       # Customer App Styling
├── staff.css                        # Staff Portal Styling
├── app.js                           # Customer App Logic
├── staff.js                         # Staff Portal Logic
├── server.js                        # Local Node.js Development Server
├── vercel.json                      # Vercel Deployment Configuration
├── package.json                     # Dependencies & start scripts
├── .env.example                     # Template environment variables
└── .gitignore                       # Protected secrets and node_modules
```

## 🛠️ Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and configure your credentials:
   ```bash
   cp .env.example .env
   ```

3. Start the local server:
   ```bash
   npm start
   ```

4. Open in browser:
   - **Customer App**: `http://localhost:8080/index.html` (or `http://localhost:8080/`)
   - **Staff Portal**: `http://localhost:8080/staff.html`
   - **Admin Dashboard**: `http://localhost:8080/admin.html`

## ☁️ Deployment (Vercel)

1. Push your repository to GitHub (sensitive files `.env`, `.env.*.local`, `client_secret*.json`, and `node_modules` are automatically ignored by `.gitignore`).
2. Import your GitHub repository into [Vercel](https://vercel.com).
3. In Vercel Project Settings > **Environment Variables**, add the following:
   - `MONGODB_URI`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `MSG91_AUTH_KEY`
   - `PHONEPE_MERCHANT_ID`
   - `PHONEPE_SALT_KEY`
   - `PHONEPE_SALT_INDEX`
   - `PHONEPE_HOST_URL`
4. Deploy! Vercel will automatically deploy the frontend and the unified `/api/index.js` serverless function (1 Function Total).