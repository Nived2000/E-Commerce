const mongoose = require('mongoose');
const Product = require('./productModel'); // Import the Product model
const User = require('./userModel')

const cartSchema = new mongoose.Schema({
    cartId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User
    products: [
        {
            productName: { type: String, required: true }, // Reference to Product
            price: { type: Number, required: true },
            quantity: { type: Number, required: true, min: 1 }, // Quantity of each product
            size: { type: String, required: true }, // Store the price at the time of adding to cart
            image: { type: String, required: true },
            
        }
    ],
    createdAt: { type: Date, default: Date.now }, // Timestamp of cart creation
    updatedAt: { type: Date, default: Date.now }, // Timestamp of last cart update
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
