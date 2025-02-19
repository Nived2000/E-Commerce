const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    brand: { type: String, required: true },
    size: { type: String, required: true },
    stock: { type: Number, required: false, default:0 },
    discount: { type: Number, required: false, default:0 },
    images: [{ type: String, required: true }],
    isListed: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    coupon: { type: String, required: false},
    category: { type: String, required: false},
    inCategory: { type: Boolean, required: false, default: false },
    orderCount: { type: Number, required: false, default:0 },
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
