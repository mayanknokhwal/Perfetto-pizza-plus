# Perfetto Pizza Plus

A full-stack, mobile-first food delivery platform, kitchen staff portal, and administrative dashboard powered by **Real-Time Firebase Firestore Synchronization**, **MongoDB Atlas**, **Google OAuth 2.0**, and **PhonePe Payment Gateway**. Optimized for seamless **Vercel Serverless** auto-deployment.

## 🚀 Features

- **Real-Time Dynamic Synchronization (Firebase Firestore)**:
  - **Menu & Pricing Live Updates**: Updates made in Admin panel (changing prices, editing items, toggling availability) reflect on Customer panels dynamically and instantly without page refreshes.
  - **Store Rates & Service Settings**: Delivery charges (zones 1–6), minimum order value, free delivery limit, and customer care status instantly update across active customer sessions.
  - **Live Kitchen Orders Queue**: Orders placed by customers instantly ring the kitchen bell and appear on Chef's screen in real-time.
- **Customer Web App (`index.html`)**: Interactive food ordering, dynamic zone-based delivery calculation, interactive Leaflet GPS location picker, single-step unified checkout, Cash on Delivery, and PhonePe payment integration.
- **Staff Kitchen Portal (`staff.html`)**: Real-time kitchen orders queue, live status transitions (Accept, Preparing, Out for Delivery, Complete), and live elapsed order timers.
- **Admin Dashboard (`admin.html`)**: Dynamic menu & category editor, size-variant pricing, shop status toggle, delivery distance zones (Zone 1-6), free delivery & minimum order thresholds, customer care configuration, team member role approvals, and revenue analytics.
- **Unified Serverless API (`api/index.js`)**: Single master serverless router keeping Vercel Serverless Function count at **1** (well under the Hobby plan limit).

## 📁 Project Structure

```
├── api/
│   └── index.js                     # Unified Master Serverless Router (/api/config, /api/menu, /api/orders, etc.)
├── controllers/
│   ├── adminAuthController.js       # Admin role management & team approvals
│   ├── authGoogleController.js      # Google OAuth 2.0 & Firebase config endpoint
│   ├── menuController.js            # Menu items CRUD & MongoDB seeding
│   ├── ordersController.js          # Customer & kitchen orders management
│   ├── otpController.js             # MSG91 Voice / OTP dispatcher & verifier
│   ├── paymentController.js         # PhonePe payment initiate, status, webhook
│   └── usersController.js           # Customer user profiles sync
├── lib/
│   └── mongodb.js                   # MongoDB Atlas connection pooling
├── models/
│   ├── AdminUser.js                 # Mongoose AdminUser schema
│   ├── MenuItem.js                  # Mongoose MenuItem schema
│   ├── Order.js                     # Mongoose Order schema
│   └── User.js                      # Mongoose User schema
├── admin.html                       # Admin Dashboard with Live Firestore sync
├── index.html                       # Customer Ordering App with Live Firestore sync
├── staff.html                       # Staff Kitchen Portal with Live Firestore sync
├── styles.css                       # Customer App Styling
├── staff.css                        # Staff Portal Styling
├── app.js                           # Customer App Logic & Firestore real-time listeners
├── staff.js                         # Staff Portal Logic & Firestore real-time listeners
├── server.js                        # Node.js Server
├── vercel.json                      # Vercel Deployment Configuration
├── package.json                     # Dependencies & start scripts
├── .env.example                     # Template environment variables
└── .gitignore                       # Protected secrets and node_modules
```

## 🛠️ Environment Variables Configuration

Copy `.env.example` to `.env` or add these in **Vercel Project Settings > Environment Variables**:

| Variable | Description |
| :--- | :--- |
| `MONGODB_URI` | MongoDB Atlas cluster connection string |
| `FIREBASE_API_KEY` | Firebase Web API Key |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain (`website-fa79c.firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | Firebase Project ID (`website-fa79c`) |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `FIREBASE_APP_ID` | Firebase Web App ID |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database / Firestore URL |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://<your-project>.vercel.app/api/auth/google/callback` |
| `MSG91_AUTH_KEY` | MSG91 OTP & Flash Call Auth Key |
| `PHONEPE_MERCHANT_ID` | PhonePe Merchant ID |
| `PHONEPE_SALT_KEY` | PhonePe Salt Key |
| `PHONEPE_SALT_INDEX` | PhonePe Salt Index |
| `PHONEPE_HOST_URL` | PhonePe Gateway Host URL |

## ☁️ Deployment (Vercel)

1. Push your repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Add the Environment Variables from `.env.example` in Vercel Settings.
4. Deploy! Vercel automatically deploys both static frontend and the unified serverless API.