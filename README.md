# Perfetto Pizza Plus

A full-stack mobile-first food delivery platform, kitchen staff portal, and administrative dashboard.

## 🚀 Features

- **Customer Web App (`index.html`)**: Interactive food ordering, dynamic zone-based delivery calculation, interactive Leaflet GPS location picker, single-step unified checkout, Cash on Delivery, and PhonePe payment integration.
- **Staff Kitchen Portal (`staff.html`)**: Live kitchen orders queue, real-time status transitions (Accept, Preparing, Out for Delivery, Complete), live elapsed order timers, and MongoDB sync.
- **Admin Dashboard (`admin.html`)**: Dynamic menu & category editor, size-variant pricing, shop status toggle, delivery distance zones (Zone 1-6), free delivery & minimum order thresholds, customer care configuration, and revenue analytics.
- **Serverless API (`/api/*`)**: RESTful backend endpoints for Orders, Users, OTP verification, and PhonePe payment gateway integration.

## 📁 Project Structure

```
├── api/
│   ├── lib/
│   │   └── mongodb.js         # MongoDB Atlas connection pooling
│   ├── models/
│   │   ├── Order.js           # Mongoose Order schema
│   │   └── User.js            # Mongoose User schema
│   ├── payment/
│   │   ├── callback.js        # PhonePe webhook handler
│   │   ├── initiate.js        # PhonePe payment initiation
│   │   └── status.js          # PhonePe status verification
│   ├── orders.js              # Orders CRUD endpoint (/api/orders)
│   ├── send-voice-otp.js      # Voice/Flash call OTP dispatcher
│   ├── users.js               # Users profile sync endpoint (/api/users)
│   └── verify-otp.js          # OTP verification endpoint
├── admin.html                 # Admin Dashboard
├── index.html                 # Customer Ordering App
├── staff.html                 # Staff Kitchen Portal
├── styles.css                 # Customer App Styling
├── staff.css                  # Staff Portal Styling
├── app.js                     # Customer App Logic
├── script.js                  # Customer App Sync Copy
├── staff.js                   # Staff Portal Logic
├── server.js                  # Local Node.js Development Server
├── vercel.json                # Vercel Deployment Configuration
├── package.json               # Dependencies & start scripts
└── .gitignore                 # Protected secrets and node_modules
```

## 🛠️ Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local server:
   ```bash
   npm start
   ```

3. Open in browser:
   - **Customer App**: `http://localhost:8080/index.html` (or `http://localhost:8080/`)
   - **Staff Portal**: `http://localhost:8080/staff.html`
   - **Admin Dashboard**: `http://localhost:8080/admin.html`

## ☁️ Vercel Deployment

1. Push your repository to GitHub (sensitive files `.env`, `client_secret*.json`, and `node_modules` are automatically ignored by `.gitignore`).
2. Import your GitHub repository into [Vercel](https://vercel.com).
3. In Vercel Project Settings > **Environment Variables**, add the following:
   - `MONGODB_URI`
   - `PHONEPE_MERCHANT_ID`
   - `PHONEPE_SALT_KEY`
   - `PHONEPE_SALT_INDEX`
   - `PHONEPE_HOST_URL`
   - `MSG91_AUTH_KEY`
4. Deploy! Vercel will automatically host the static apps and deploy the `/api/*` endpoints as serverless functions.