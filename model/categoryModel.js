const mongoose = require('mongoose');
const Product = require('./productModel'); 

const categorySchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    category: { type: String, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: Product }], 
    image: { type: String, required: false },
    categoryDiscount : { type: Number, default: 0},
    isDeleted: { type: Boolean, default: false } 
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
