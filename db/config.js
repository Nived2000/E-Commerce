// /config/db.js
const mongoose = require('mongoose');

// MongoDB URI (replace with your database name)
const uri = "mongodb://localhost:27017/eCommerceDB"; // Replace 'testDB' with your database name

// Function to connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(uri);
        console.log("eCommerceDB connected!");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1);  // Exit the process with failure
    }
};

module.exports = connectDB;
