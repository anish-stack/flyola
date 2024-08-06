const express = require('express');
const { CreateAgent, LoginAgent } = require('./controllers/Login.controller');
const dotenv = require('dotenv');
dotenv.config();
const cookiesParser = require('cookie-parser');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

// Initialize app and configure port
const PORT = process.env.PORT || 3000;
const app = express();
const authRoutes = require('./routes/Auth.routes')
const FlightsRoutes = require('./routes/flights.routes')

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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on Port Number ${PORT}`);
});
