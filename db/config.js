const mongoose = require("mongoose");

const uri = "mongodb://13.60.20.41:27017/eCommerceDB"

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
