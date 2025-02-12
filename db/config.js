const mongoose = require("mongoose");

const uri = process.env.MONGO_URI

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
