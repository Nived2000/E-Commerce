// /config/db.js
const mongoose = require('mongoose');

// MongoDB URI (replace with your database name)
const uri = "mongodb+srv://nivedgeethak:HI42mHZghpNBd5p4@e-commerce-cluster.fr1az.mongodb.net/eCommerceDB"

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
