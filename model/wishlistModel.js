const mongoose = require('mongoose');
const Product = require('./productModel'); // Import the Product model
const User = require('./userModel')

const wishlistSchema = new mongoose.Schema({
    wishlistId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User
    products: [
        {
            productName: { type: String, required: true }, // Reference to Product
            price: { type: Number, required: true },
            size: { type: String, required: true }, // Store the price at the time of adding to cart
            stockAvailable: { type: Number, required: true },
            image: { type: String, required: true },
            
        }
    ],
    createdAt: { type: Date, default: Date.now }, // Timestamp of cart creation
    updatedAt: { type: Date, default: Date.now }, // Timestamp of last cart update
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;
