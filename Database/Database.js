// db.js
const mysql = require('mysql2/promise');
require('dotenv').config()
// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10
});


// Test the connection
pool.getConnection()
    .then(() => console.log("Database connected successfully!"))
    .catch(error => console.error("Error connecting to the database:", error));

// Export the pool for use in other modules
module.exports = pool;
