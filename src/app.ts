import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/config';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';
import { connectDatabase } from './config/database';
import router from './router/index';
import path from 'path';

const app = express();

// Security middleware
// app.use(helmet());
// app.use(cors({
//   origin: config.cors.origin,
//   credentials: true,
// }));
app.use(cors());



// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging
if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected',
    body: typeof req.body
  });
});

// API Routes
app.use('/api/v1',router); 

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port || 3000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in ${config.env} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
