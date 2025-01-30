const mongoose = require('mongoose');
const Product = require('./productModel'); // Import the Product model
const User = require('./userModel')

const addressSchema = new mongoose.Schema({
  line1: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },  
  line1: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  zipCode: { type: String, required: true },
});

const orderSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User
    products: [
        {
            productName: { type: String, required: true }, // Reference to Product
            price: { type: Number, required: true },
            quantity: { type: Number, required: true, min: 1 }, // Quantity of each product
            size: { type: String, required: true }, // Store the price at the time of adding to cart
            returnStatus: { type: Boolean, default: false },
            adminApproved: { type: Boolean, default: false},
            returnReason: {type: String, default:""}
            
        }
    ],
    address: addressSchema,
    paymentMethod: { type: String, required: true},
    orderAmount: { type: Number, required: true },
    walletAmount: { type: Number, required: true , default: 0},
    couponDiscount: { type: Number, required: true , default: 0},
    deliveryStatus: { type: String, default: "In Transit" },
    createdAt: { type: Date, default: Date.now }, // Timestamp of cart creation
    updatedAt: { type: Date, default: Date.now }, // Timestamp of last cart update
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;