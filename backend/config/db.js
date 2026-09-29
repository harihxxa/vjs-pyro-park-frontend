const { Pool } = require("pg");
require("dotenv").config({
    path: require("path").resolve(__dirname, "../../.env")
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("❌ DATABASE_URL not found in .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("connect", () => {
    console.log("PostgreSQL database connected ✅");
});

pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error);
});

module.exports = pool;