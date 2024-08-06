// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'apnipaathshaala.in',
    user: 'u905431022_user',
    password: '2S$c~Msw',
    database: 'u905431022_flyola_test',
    connectionLimit: 10
});

pool.getConnection()
    .then(() => console.log("Database connected successfully!"))
    .catch(error => console.error("Error connecting to the database:", error));

module.exports = pool;
