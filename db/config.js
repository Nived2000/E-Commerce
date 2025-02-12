const mongoose = require("mongoose");

const uri = "mongodb://127.0.0.1:27017/ecommerceDB"

const connectDB = async () => {
    try {
        await mongoose.connect(uri, {
        });

        console.log("MongoDB Connected Successfully!");
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        process.exit(1);
    }
};

module.exports = connectDB;
