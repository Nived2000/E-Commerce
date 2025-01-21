const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    couponId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    couponName : {type: String, required:true},
    availableAfter:{ type: Number, required: true},
    discountAmount:{type: Number, required:false},
    discountPercentage:{type: Number, required:false},
    createdAt: { type: Date, default: Date.now },
    
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
