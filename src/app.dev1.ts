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
import https from 'https';
import http from 'http';
import fs from 'fs';
const app = express();

// Security middleware
// app.use(helmet());
// app.use(cors({
//   origin: config.cors.origin,
//   credentials: true,
// }));
app.use(
  cors({
    origin: ["https://app1.kollabro.com", "http://app1.kollabro.com", "http://localhost:8080", "http://localhost:8081", "http://152.53.148.63", "http://152.53.148.63:8888","http://dev1.kollabro.com","https://dev1.kollabro.com","http://test1.kollabro.com","https://test1.kollabro.com"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);



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
app.use('/api/v1', router);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port || 3000;

const startServer = async () => {

  try {

    // try {
    //     console.log(fs.readFileSync("/etc/letsencrypt/live/app1.kollabro.com/privkey.pem"),"privkey.pem")
    //     console.log(fs.readFileSync("/etc/letsencrypt/live/app1.kollabro.com/fullchain.pem"),"fullchain.pem")
    // } catch (error) {
    //   console.log("error here reading file", error)
    // }
    // const options = {
    //   key: fs.readFileSync('/etc/letsencrypt/live/app1.kollabro.com/privkey.pem'),
    //   cert: fs.readFileSync('/etc/letsencrypt/live/app1.kollabro.com/fullchain.pem'),
    // };
    // Connect to database
    await connectDatabase();
    const httpsServer = http.createServer(app);
    // const httpsServer = https.createServer(options, app)
    httpsServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in dev1 mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
