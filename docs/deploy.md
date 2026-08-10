# Deployment Guide - Toka App Stack

This guide provides step-by-step instructions to configure, initialize, and deploy the Toka application stack (Next.js frontend, Node.js Express backend, MongoDB database, Firebase services, and Paystack payments).

---

## 1. Firebase Project Setup

### Authentication
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** in your project (`toka-cd0bb`).
3. Enable the **Email/Password** and **Google** sign-in providers in the "Sign-in method" tab.

### Storage Bucket & CORS
1. In the Firebase Console, go to **Build** -> **Storage** and click **Get Started** to provision the default GCS bucket (e.g. `gs://toka-cd0bb.firebasestorage.app` or `gs://toka-cd0bb.appspot.com`).
2. Set the rules to test mode to allow authorized/client-side writes.
3. Configure CORS on the GCS bucket so browser requests from your production domains are not blocked:
   * Create a `cors.json` file (you can find a copy at `C:\Users\Xolane\.gemini\antigravity-ide\brain\6ef9b5ef-a4f6-4da3-b55d-4acc7fb4b04f\scratch\cors.json`):
     ```json
     [
       {
         "origin": ["https://your-frontend-domain.vercel.app", "http://localhost:3000"],
         "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
         "responseHeader": ["Content-Type", "x-firebase-storage-version", "Authorization"],
         "maxAgeSeconds": 3600
       }
     ]
     ```
   * Apply it using the recommended Google Cloud Storage CLI:
     ```bash
     gcloud auth login
     gcloud config set project toka-cd0bb
     gcloud storage buckets update gs://toka-cd0bb.firebasestorage.app --cors-file=cors.json
     ```
     *(Alternatively, you can use the legacy gsutil: `gsutil cors set cors.json gs://toka-cd0bb.firebasestorage.app`)*

### Cloud Messaging (Web Push & VAPID)
1. In the Firebase Console, navigate to **Project Settings** (gear icon) -> **Cloud Messaging**.
2. Under the **Web configuration** tab, scroll to **Web Push certificates** and click **Generate key pair**.
3. Copy this VAPID Public Key string. You will configure this as `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in your environment.

---

## 2. Database (MongoDB Atlas)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user and copy the connection string.
3. In Atlas Network Access, whitelist the IP addresses of your hosting environments (or `0.0.0.0/0` if deploying to serverless platforms like Render/Heroku).

---

## 3. Backend Deployment (Node.js Express)

Deploy the `backend` folder to a hosting provider such as **Render** (recommended), **Heroku**, or **AWS Elastic Beanstalk**.

### Required Environment Variables
Configure the following environment variables in your hosting settings panel:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Mode of operation | `production` |
| `PORT` | Port for Express server | `5000` (automatically set by hosting provider) |
| `MONGO_URI` | MongoDB Atlas URI connection string | `mongodb+srv://...` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | `toka-cd0bb` |
| `GOOGLE_CLOUD_PROJECT` | Satisfies google-auth-library | `toka-cd0bb` |
| `FIREBASE_STORAGE_BUCKET` | Cloud Storage bucket name | `toka-cd0bb.firebasestorage.app` |
| `PAYSTACK_SECRET_KEY` | Paystack Secret Key (Sandbox/Live) | `sk_test_...` |

### Deploying to Render
1. Sign in to [Render](https://dashboard.render.com/) and click **New** -> **Web Service**.
2. Connect your GitHub repository (`Malopex7/Toka1`).
3. Set the following build settings:
   * **Name**: `toka-backend`
   * **Region**: Choose the closest region to your users
   * **Branch**: `main`
   * **Root Directory**: `backend`
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node src/index.js`
4. Expand **Advanced** -> click **Add Environment Variable** and copy-paste the values from the required backend environment variables table above.
5. Click **Create Web Service**. Render will spin up the Node environment, run your migrations, and host the live API.

---

## 4. Frontend Deployment (Next.js)

Deploy the `frontend` folder to **Vercel** (recommended for Next.js App Router applications).

### Required Environment Variables
Configure the following Environment Variables in the Vercel project settings:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Production URL of your deployed Backend | `https://toka-backend.onrender.com` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client API Key | `AIzaSyDMN...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `toka-cd0bb.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | `toka-cd0bb` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Firebase Storage Bucket | `toka-cd0bb.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | `510564...` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID | `1:510564...` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Analytics ID | `G-...` |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Generated VAPID Public Key | `BPTwssew...` |

### Deploying to Vercel
1. Sign in to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
2. Select your repository `Toka1`.
3. In the project setup page:
   * **Project Name**: `toka-frontend`
   * **Framework Preset**: `Next.js`
   * **Root Directory**: Click Edit, select the **`frontend`** directory, and click Continue.
4. Expand **Environment Variables** and insert the values from the required frontend environment variables table above. Make sure `NEXT_PUBLIC_API_URL` points to your newly deployed Render API domain!
5. Click **Deploy**. Vercel will build, optimize static routes, and host your Next.js App Router application.

---

## 5. Paystack Webhook Configuration
To process deposits correctly when checkout flows complete:
1. Go to your [Paystack Dashboard](https://dashboard.paystack.com/) -> **Settings** -> **API Keys & Webhooks**.
2. Under the **Webhook URL** field, enter your deployed backend webhook endpoint:
   `https://toka-backend.onrender.com/api/transactions/webhook`
3. Click Save. Paystack will now post real-time updates when users deposit ZAR.
