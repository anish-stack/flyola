const express = require('express');
const { CreateAgent, LoginAgent } = require('./controllers/Login.controller');
const dotenv = require('dotenv');
dotenv.config();
const cookiesParser = require('cookie-parser');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const cluster = require('cluster');
const os = require('os');

// Initialize app and configure port
const PORT = process.env.PORT || 3000;
const app = express();
const authRoutes = require('./routes/Auth.routes');
const FlightsRoutes = require('./routes/flights.routes');

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 100, // Limit each IP to 100 requests per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'You have exceeded the maximum number of requests. Please try again after a minute.'
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookiesParser());
app.use(cors());
app.use(limiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/details', FlightsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'An error occurred.',
        error: err.message
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Exit the process with failure code
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
    // Exit the process with failure code
    process.exit(1);
});

// Cluster setup
if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(`Master ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
    });
} else {
    // Start the server in worker processes
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} started on Port Number ${PORT}`);
    });
}
