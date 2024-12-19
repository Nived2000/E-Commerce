const mongoose = require('mongoose');
const Product = require('./productModel');  // Make sure to import the Product model

const categorySchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    category: { type: String, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: Product }], // Array of ObjectIds referencing Product
    image: { type: String, required: false },
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
