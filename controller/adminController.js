const { message } = require('prompt')
const User = require('../model/userModel')
const bcrypt = require('bcryptjs');
const saltRounds = 10
const Product = require('../model/productModel')
const Category = require('../model/categoryModel')
const loadLogin = (req, res) => {
    res.render('admin/login')
}

const loginAdmin = async (req, res) => {
    let { email, password } = req.body

    let admin = await User.findOne({ email })


    if (!admin) {
        res.render('admin/login', { message: "Invalid Credentials" })
        return false
    }
    if(!admin.isAdmin){
        res.render('admin/login', { message: "You are not an admin" })
        return false
    }

    const isMatch = await bcrypt.compareSync(password, admin.password)

    if (!isMatch) {
        res.render('admin/login', { message: "Password is incorrect" })
    } else {
        req.session.admin = true
        req.session.AdminEmail = email
        res.redirect('/admin/dashboard')
        res.end()
    }

}

const loadDashboard = async (req, res)=>{
    let users = await User.find({isAdmin: false})
    res.render('admin/dashboard', {users, email: req.session.AdminEmail})
    
}

const blockUser = async(req, res)=>{
   
    let userID = req.params.id
    let user = await User.findOne({userId: userID})
    if(user){
        
        if(!user.isBlocked){
            await User.updateOne({userId: userID}, {$set:{isBlocked: true}})
        }
        let users = await User.find({isAdmin:false})
        res.render('admin/dashboard', {users, message: "User successfully blocked"} )
    }
}

const unblockUser = async(req, res)=>{
   
    let userID = req.params.id
    let user = await User.findOne({userId: userID})
    if(user){
        
        if(user.isBlocked){
            await User.updateOne({userId: userID}, {$set:{isBlocked: false}})
        }
        let users = await User.find({isAdmin:false})
        res.render('admin/dashboard', {users, message: "User successfully unblocked"} )
    }
}


const loadProducts = async (req, res)=>{
    let products = await Product.find()
    res.render('admin/listProducts', {products})
}

const loadAddProducts = async (req, res)=>{
    res.render('admin/addProduct')
}

const addProduct = async (req, res) => {
    try {
        let { name, description, price, brand, size, stock, discount, coupon } = req.body;

        // Check if the product already exists
        

        // Map uploaded files to get filenames
        const images = req.files.map(file => file.filename);

        // Create a new product if it doesn't exist
        const newProduct = new Product({
            name,
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
    } catch (error) {
        console.error(error);
        res.render('admin/addProduct', { message: 'Error adding product' });
    }
};


const unlistProduct = async(req, res)=>{
    
    
    let proID = req.params.id
    let product = await Product.findOne({productId: proID})
    if(product){
        console.log(product.isListed);
        
        if(product.isListed){
            await Product.updateOne({productId: proID}, {$set:{isListed:false}})
        }
    }
    let products = await Product.find()
    res.render('admin/listProducts',{products, message:"Product removed from listing"})
}

const listProduct = async(req, res)=>{
    let proID = req.params.id
    let product = await Product.findOne({productId: proID})
    if(product){
        if(!product.isListed){
            await Product.updateOne({productId: proID}, {$set:{isListed:true}})
        }
    }
    let products = await Product.find()
    res.render('admin/listProducts', {products, message:"Product added to listing"})
}

const loadEditProduct = async(req, res)=>{
    let proID = req.params.id
    let product = await Product.findOne({productId: proID})
    res.render('admin/editProduct', {product})
}

const editProduct = async(req, res)=>{
    let proID = req.params.id
    let { name, description, price, brand, size, stock, discount, coupon } = req.body;
    const images = req.files.map(file => file.filename);

    await Product.updateOne({productId: proID}, {$set:{name, description, price, brand, size, stock, discount, coupon }})
    await Product.updateOne({productId: proID}, {$push : {images: {$each: images}}})
    let products = await Product.find()
    res.render('admin/listProducts', {products, message:"Product edited Successfully"})
}

const logoutAdmin = async (req, res) => {
    req.session.destroy();
    res.render('admin/login', { message: "Logged out successfully" })
}

const loadCategory = async(req, res)=>{
    let categories = await Category.find()
    console.log(categories);
    res.render('admin/listCategory' , {categories})
}

const loadAddCategory = async(req, res)=>{
    
    res.render('admin/addCategory')
}

const addCategory = async(req, res)=>{
    
    
    let { category, image } = req.body;
    let CATEGORY = category.toUpperCase(); // Corrected method name
    let categoryExist = await Category.findOne({ category: CATEGORY });
    const imagePath = req.file ? req.file.filename : null;
    
    if(categoryExist ){
        res.render('admin/addCategory',{message: "Category already Exist"})
        return
    }

    let newCategory = new Category({
        category: CATEGORY,
        image: imagePath
    })

    await newCategory.save()
    let categories = await Category.find()
    res.render('admin/listCategory' , {categories})
}

const loadCategoryManagement = async(req, res)=>{
    let categoryId = req.params.id
    let products = await Product.find()
    let categoryName = await Category.find({categoryId}, {category:1, _id: 0})
    let category = categoryName[0].category
    
    res.render('admin/addProductToCategory', {categoryId, products, category})
}

const postProductToCategory = async(req, res)=>{
    let { categoryId, productId } = req.query;

try {
    // Check if the productId already exists in the products array

    // Use $addToSet to ensure the productId is only added if it doesn't already exist
    await Category.updateOne(
        { categoryId },
        { $addToSet: { products: productId } }
    );
    let categories = await Category.find()
    // Redirect to the list category page
    res.render('admin/listCategory', {categories})
} catch (err) {
    console.error(err);
    res.status(500).send('Server error');
}   
}

const deleteCategory = async(req, res)=>{
    let categoryId = req.params.id
    await Category.deleteOne({categoryId})
    let categories = await Category.find()
    // Redirect to the list category page
    res.render('admin/listCategory', {categories, message:"Category deleted Successfully"})
}

module.exports = {loadLogin, loginAdmin, loadDashboard, blockUser, unblockUser, loadProducts, loadAddProducts, addProduct, 
    unlistProduct, listProduct, loadEditProduct, editProduct, logoutAdmin, loadAddCategory, loadCategory, addCategory, 
    loadCategoryManagement, postProductToCategory, deleteCategory}