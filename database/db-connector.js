// ./database/db-connector.js

// Get an instance of mysql we can use in the app
var mysql = require('mysql')

// Create a 'connection pool' using the provided credentials
var pool = mysql.createPool({
    connectionLimit : 10,
    host            : '[database_host]',
    user            : '[user_name]',
    password        : '[password]',
    database        : '[database_name]'
})

// Export it for use in our application
module.exports.pool = pool;