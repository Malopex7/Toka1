// src/index.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { GridFSBucket } from 'mongodb';

// Import Mongoose Models
import User from './models/User.js';
import Video from './models/Video.js';
import Transaction from './models/Transaction.js';

import './config/firebase.js';
import { errorHandler, AppError } from './middlewares/error.js';
import { protect, requireBrand } from './middlewares/auth.js';
import videoRoutes from './routes/videoRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import userRoutes from './routes/userRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import sponsorshipRoutes from './routes/sponsorshipRoutes.js';
const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigin = rawFrontendUrl.endsWith('/') ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

import { ensureVideosBucket } from './config/supabase.js';

// Connect to MongoDB (use MONGO_URI from .env)
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    // Set up GridFS bucket
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    console.log('GridFS bucket ready');
    // Ensure Supabase public 'videos' bucket exists
    ensureVideosBucket();
  })
  .catch(err => console.error(err));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working' });
});

// Auth Test routes
app.get('/api/test/auth', protect, (req, res) => {
  res.json({ message: 'Authenticated successfully', user: req.user });
});

app.get('/api/test/brand', protect, requireBrand, (req, res) => {
  res.json({ message: 'Authorized as brand successfully', user: req.user });
});

app.use('/api', videoRoutes);
app.use('/api', transactionRoutes);
app.use('/api', userRoutes);
app.use('/api', commentRoutes);
app.use('/api', notificationRoutes);
app.use('/api', sponsorshipRoutes);

// Fallback for unmatched API routes
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(errorHandler);

// Start server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));

