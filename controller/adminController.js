const { message } = require('prompt')
const User = require('../model/userModel')
const bcrypt = require('bcryptjs');
const saltRounds = 10
const Product = require('../model/productModel')
const Category = require('../model/categoryModel')
const Order = require('../model/orderModel')
const Coupon = require('../model/couponModel');
const { log } = require('handlebars');
const Wallet = require('../model/walletModel');

const loadLogin = (req, res) => {
    res.render('admin/login', {hideHeader: true, hideFooter:true})
}

const loginAdmin = async (req, res) => {
    let { email, password } = req.body

    let admin = await User.findOne({ email })


    if (!admin) {
        res.render('admin/login', { message: "Invalid Credentials", hideHeader: true, hideFooter:true })
        return false
    }
    if (!admin.isAdmin) {
        res.render('admin/login', { message: "You are not an admin", hideHeader: true, hideFooter:true })
        return false
    }

    const isMatch = await bcrypt.compareSync(password, admin.password)

    if (!isMatch) {
        res.render('admin/login', { message: "Password is incorrect", hideHeader: true, hideFooter:true })
    } else {
        req.session.admin = true
        req.session.AdminEmail = email
        res.redirect('/admin/dashboard')
        res.end()
    }

}

const loadDashboard = async (req, res) => {
    let users = await User.find({ isAdmin: false })
    res.render('admin/dashboard', { users, email: req.session.AdminEmail, hideHeader: true, hideFooter:true })

}

const blockUser = async (req, res) => {

    let userID = req.params.id
    let user = await User.findOne({ userId: userID })
    if (user) {

        if (!user.isBlocked) {
            await User.updateOne({ userId: userID }, { $set: { isBlocked: true } })
        }
        let users = await User.find({ isAdmin: false })
        res.render('admin/dashboard', { users, message: "User successfully blocked", hideHeader: true, hideFooter:true })
    }
}

const unblockUser = async (req, res) => {

    let userID = req.params.id
    let user = await User.findOne({ userId: userID })
    if (user) {

        if (user.isBlocked) {
            await User.updateOne({ userId: userID }, { $set: { isBlocked: false } })
        }
        let users = await User.find({ isAdmin: false })
        res.render('admin/dashboard', { users, message: "User successfully unblocked", hideHeader: true, hideFooter:true })
    }
}


const loadProducts = async (req, res) => {
    let products = await Product.find()
    res.render('admin/listProducts', { products, hideHeader: true, hideFooter:true })
}

const loadAddProducts = async (req, res) => {
    res.render('admin/addProduct', {hideHeader: true, hideFooter:true})
}

const addProduct = async (req, res) => {
    try {
        let { name, description, price, brand, size, stock, discount, coupon } = req.body;
        let products = await Product.find()
        // Check if the product already exists
        let NAME = name.toUpperCase()
        let productExist = await Product.findOne({ name: NAME, size })
        if (productExist) {
            res.render('admin/listProducts', { message: "Product already exist", products,hideHeader: true, hideFooter:true });
            return
        } else {
            const images = req.files.map(file => file.filename);

            // Create a new product if it doesn't exist
            const newProduct = new Product({
                name: NAME,
                description,
                price,
                size,
                brand,
                images,
                discount,
                stock,
                coupon
            });


            // Save the new product to the database
            await newProduct.save();

            res.redirect('/admin/products'); // Redirect after adding the product
        }


    } catch (error) {
        console.error(error);
        res.render('admin/addProduct', { message: 'Error adding product', hideHeader: true, hideFooter:true });
    }
};


const unlistProduct = async (req, res) => {


    let proID = req.params.id
    let product = await Product.findOne({ productId: proID })
    if (product) {
        console.log(product.isListed);

        if (product.isListed) {
            await Product.updateOne({ productId: proID }, { $set: { isListed: false } })
        }
    }
    let products = await Product.find()
    res.render('admin/listProducts', { products, message: "Product removed from listing", hideHeader: true, hideFooter:true })
}

const listProduct = async (req, res) => {
    let proID = req.params.id
    let product = await Product.findOne({ productId: proID })
    if (product) {
        if (!product.isListed) {
            await Product.updateOne({ productId: proID }, { $set: { isListed: true } })
        }
    }
    let products = await Product.find()
    res.render('admin/listProducts', { products, message: "Product added to listing", hideHeader: true, hideFooter:true })
}

const loadEditProduct = async (req, res) => {
    let proID = req.params.id
    let product = await Product.findOne({ productId: proID })
    res.render('admin/editProduct', { product, hideHeader: true, hideFooter:true })
}

const editProduct = async (req, res) => {
    let proID = req.params.id

    let { name, description, price, brand, size, stock, discount, coupon } = req.body;
    const images = req.files.map(file => file.filename);

    let productExist = await Product.findOne({ name, description, price, brand, size, stock, discount, coupon })

    if (productExist) {
        await Product.deleteOne({ productId: proID })
        let products = await Product.find()
        res.render('admin/listProducts', { products, message: "Product already exist", hideHeader: true, hideFooter:true })
    } else {
        await Product.updateOne({ productId: proID }, { $set: { name, description, price, brand, size, stock, discount, coupon } })
        await Product.updateOne({ productId: proID }, { $push: { images: { $each: images } } })
        let products = await Product.find()
        res.render('admin/listProducts', { products, message: "Product edited Successfully", hideHeader: true, hideFooter:true })
    }


}

const logoutAdmin = async (req, res) => {
    req.session.destroy();
    res.render('admin/login', { message: "Logged out successfully", hideHeader: true , hideFooter:true})
}

const loadCategory = async (req, res) => {
    let categories = await Category.find()
    console.log(categories);
    res.render('admin/listCategory', { categories, hideHeader: true , hideFooter:true})
}

const loadAddCategory = async (req, res) => {

    res.render('admin/addCategory', {hideHeader: true, hideFooter:true})
}

const addCategory = async (req, res) => {


    let { category, image } = req.body;
    let CATEGORY = category.toUpperCase(); // Corrected method name
    let categoryExist = await Category.findOne({ category: CATEGORY });
    const imagePath = req.file ? req.file.filename : null;

    if (categoryExist) {
        res.render('admin/addCategory', { message: "Category already Exist", hideHeader: true, hideFooter:true })
        return
    }

    let newCategory = new Category({
        category: CATEGORY,
        image: imagePath
    })

    await newCategory.save()
    let categories = await Category.find()
    res.render('admin/listCategory', { categories, hideHeader: true, hideFooter:true })
}

const loadCategoryManagement = async (req, res) => {
    let categoryId = req.params.id
    let products = await Product.find()
    let categoryName = await Category.find({ categoryId }, { category: 1, _id: 0 })
    let category = categoryName[0].category

    res.render('admin/addProductToCategory', { categoryId, products, category, hideHeader: true, hideFooter:true })
}

const postProductToCategory = async (req, res) => {
    let { categoryId, productId } = req.query;
    let products = await Product.find()
    let product = await Product.findOne({ productId })
    try {
        // Check if the productId already exists in the products array
        
        if (product.inCategory) {
            return res.render('admin/addProductToCategory', { message: "Product already in another category", products, hideHeader: true, hideFooter:true })
        } else {
            await Product.updateOne({productId}, {$set: {inCategory: true}})
            await Category.updateOne(
                { categoryId },
                { $addToSet: { products: productId } }
            );
            let categories = await Category.find()
            // Redirect to the list category page
            res.render('admin/listCategory', { categories, hideHeader: true, hideFooter:true })
        }
        // Use $addToSet to ensure the productId is only added if it doesn't already exist

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}

const deleteCategory = async (req, res) => {
    let categoryId = req.params.id
    await Category.deleteOne({ categoryId })
    let categories = await Category.find()
    // Redirect to the list category page
    res.render('admin/listCategory', { categories, message: "Category deleted Successfully", hideHeader: true, hideFooter:true })
}

const listOrders = async(req, res)=>{
    let orders = await Order.find({}).sort({createdAt:-1})
    res.render('admin/listOrders', {orders, hideHeader: true, hideFooter:true})
}

const deliveryMark = async(req, res)=>{
    let orderId = req.params.id

    await Order.updateOne({orderId}, {$set:{deliveryStatus: "Delivered"}})
    let orders = await Order.find({}).sort({createdAt:-1})
    res.render('admin/listOrders', {orders, message:"Order Status updated!", hideHeader: true, hideFooter:true})
}

const notdeliveredMark = async(req, res)=>{
    let orderId = req.params.id

    await Order.updateOne({orderId}, {$set:{deliveryStatus: "In Transit"}})
    let orders = await Order.find({}).sort({createdAt:-1})
    res.render('admin/listOrders', {orders, message:"Order Status updated!", hideHeader: true, hideFooter:true})
}

const adminCancel = async(req, res)=>{
    let orderId = req.params.id
    

    
    let currOrders = await Order.findOne({orderId})
    
    currOrders.products.forEach(async (product)=>{
        let currentProduct = await Product.findOne({name: product.productName, size: product.size})
        let newStock = currentProduct.stock + product.quantity
        
        
        await Product.updateOne({name: product.productName, size: product.size}, {$set: {stock: newStock}})
    })
    await Order.updateOne({orderId}, {$set: {deliveryStatus:"Order Cancelled"}})

    let orders = await Order.find({})
    res.render('admin/listOrders', { orders, message:"Order is cancelled", hideHeader: true, hideFooter:true})
}

const loadAddCoupon = async(req, res)=>{
    res.render('admin/addCoupon', {hideHeader: true, hideFooter:true})
}

const postCoupon = async(req, res)=>{
    let {coupon, discount, availableAfter} = req.body

    
    const newCoupon = new Coupon({
        couponName: coupon,
        discountAmount: discount,
        availableAfter
    })
    
    await newCoupon.save();

    res.render('admin/addCoupon', {hideHeader: true, hideFooter:true, message:"Coupon added successfully"})
}

const loadReturns = async(req, res)=>{
    let returns = await Order.aggregate([
        { $unwind: "$products" }, // Unwind the `products` array
        { $match: { "products.returnStatus": true } }, // Filter where returnStatus is true
        { $project: { 
            _id: 1, 
            userId: 1, 
            orderId: 1,

            "products.productName": 1, 
            "products.price": 1, 
            "products.quantity": 1, 
            "products.returnStatus": 1,
            "products.adminApproved": 1,
            "products._id":1,
            createdAt: 1
        }} // Project only required fields
    ]);
    
    
    res.render('admin/listReturns', {returns, hideHeader: true, hideFooter:true})
}

const markReturn = async (req, res) => {
    let id = req.query.id;
    let user = await Order.findOne({"products._id": id})
    let price = req.query.price
    let quantity = req.query.quantity

    let refund = price * quantity
      
    await Order.updateOne(
        { "products._id": id }, // Match the Order with the specific product _id
        { $set: { "products.$.adminApproved": true } } // Use the positional operator to update the field within the array
    );

    await Wallet.updateOne({userId: user.userId}, {$inc:{amountAvailable: refund}})
    
    
    res.redirect('/admin/adminReturn');
};

const loadEditCategory = async(req, res)=>{
    let catId = req.params.id
    let category = await Category.findOne({ categoryId: catId })
    res.render('admin/editCategory', { category, hideHeader: true, hideFooter:true })
}

const postDiscount = async(req, res)=>{
    let {discount} = req.body
    let id = req.params.id
    let category = await Category.findOne({categoryId: id})
    category.products.forEach(async (id)=>{
        let existingDiscount = category.categoryDiscount
        let newDiscount = discount - existingDiscount
        await Product.updateOne({productId:id}, {$inc: {discount: newDiscount}})
    })

    await Category.updateOne({categoryId: id}, {$set: {categoryDiscount: discount}})
    let categories = await Category.find({})
    res.render('admin/listCategory', {categories, message:"Discount added!", hideHeader: true, hideFooter:true })
}

module.exports = {
    loadLogin, loginAdmin, loadDashboard, blockUser, unblockUser, loadProducts, loadAddProducts, addProduct,
    unlistProduct, listProduct, loadEditProduct, editProduct, logoutAdmin, loadAddCategory, loadCategory, addCategory,
    loadCategoryManagement, postProductToCategory, deleteCategory, listOrders, deliveryMark, notdeliveredMark, adminCancel, loadAddCoupon,
    postCoupon, loadReturns, markReturn, loadEditCategory, postDiscount

}