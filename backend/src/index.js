// src/index.js
import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
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
import statusRoutes from './routes/statusRoutes.js';
import liveRoutes from './routes/liveRoutes.js';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://toka-frontend-ruby.vercel.app',
  rawFrontendUrl.replace(/\/$/, ''),
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.vercel.app') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    return true;
  }
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());

import { ensureVideosBucket } from './config/supabase.js';

// Wrap Express with an HTTP server and attach Socket.io
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Attach io to app.locals so controllers can broadcast
app.locals.io = io;

// Socket.io: live room event handler
io.on('connection', (socket) => {
  // Client joins a LiveKit room channel for real-time events
  socket.on('join_live_room', (roomName) => {
    if (typeof roomName === 'string' && roomName.startsWith('toka-live-')) {
      socket.join(roomName);
    }
  });

  socket.on('leave_live_room', (roomName) => {
    if (typeof roomName === 'string') {
      socket.leave(roomName);
    }
  });

  // Live chat relay — broadcast to all room members
  socket.on('live_chat', (data) => {
    if (!data || typeof data !== 'object') return;
    const { roomName, id, user, message, timestamp } = data;
    if (typeof roomName === 'string' && roomName.startsWith('toka-live-') && message) {
      io.to(roomName).emit('live_chat', {
        id: id || `sock-${Date.now()}`,
        user: user || { username: 'Anonymous' },
        message: typeof message === 'string' ? message : String(message.message || ''),
        timestamp: timestamp || Date.now(),
      });
    }
  });

  // Reaction tap relay — broadcast emoji reaction to all participants in the room
  socket.on('reaction_tap', (data) => {
    if (!data || typeof data !== 'object') return;
    const { roomName, emoji } = data;
    if (typeof roomName === 'string' && roomName.startsWith('toka-live-') && typeof emoji === 'string') {
      // Broadcast to all OTHER members of the room (sender handles their own reaction locally)
      socket.to(roomName).emit('reaction_tap', { emoji });
    }
  });
});

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
app.use('/api', statusRoutes);
app.use('/api', liveRoutes);

// Fallback for unmatched API routes
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(errorHandler);

// Start HTTP server (replaces app.listen to support Socket.io)
const port = process.env.PORT || 5000;
httpServer.listen(port, () => console.log(`Server running on port ${port} (Socket.io enabled)`));
