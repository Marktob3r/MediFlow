import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const allowedOrigins = [
  'https://medi-flow-jade.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  FRONTEND_URL,
].filter(Boolean);

// Middleware
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true
}));

// Routes
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server only if not running in a Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 MediFlow Backend Server Running`);
    console.log(`-----------------------------------`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔗 Frontend Allowed: ${FRONTEND_URL}`);
    console.log(`✅ Admin Routes mounted at /api/admin\n`);
  });
}

// Export the app for Vercel Serverless
export default app;
