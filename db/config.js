// /config/db.js
const mongoose = require('mongoose');

// MongoDB URI (replace with your database name)
const uri = process.env.MONGO_URI; // Fetch from environment variable


const connectDB = async () => {
    try {
        await mongoose.connect(uri);
        console.log("eCommerceDB connected!");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    }
};

module.exports = connectDB;