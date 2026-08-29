import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import carRoutes from './routes/cars.js';
import bookingRoutes from './routes/bookings.js';
import imagekitRoutes from './routes/imagekit.js';
import userRoutes from './routes/users.js';
import consignmentRoutes from './routes/consignments.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();

// Render sits behind a reverse proxy — without this, express-rate-limit
// would see every request as coming from the same IP.
app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://rent-a-ride-albay.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/imagekit', imagekitRoutes);
app.use('/api/users', userRoutes);
app.use('/api/consignments', consignmentRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: '🚗 Car Rental API is running!' });
});

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  family: 4
})
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT, () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.error('❌ MongoDB error:', err));