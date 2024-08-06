// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'flyola.in',
    user: 'u271914483_user',
    password: '@v36ujQKL1',
    database: 'u271914483_new_db',
    connectionLimit: 10
});

pool.getConnection()
    .then(() => console.log("Database connected successfully!"))
    .catch(error => console.error("Error connecting to the database:", error));

module.exports = pool;
