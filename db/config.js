// /config/db.js
const mongoose = require("mongoose");

const uri = process.env.MONGO_URI; // Fetch from environment variable

const connectDB = async () => {
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 50000, // 50s server selection timeout
            socketTimeoutMS: 45000, // 45s socket timeout
            
        });

        console.log("✅ MongoDB Connected Successfully!");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
        process.exit(1);
    }
};



module.exports = connectDB;
