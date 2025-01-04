const { message } = require('prompt')
const User = require('../model/userModel')
const Product = require('../model/productModel')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose');  // Add this line to import mongoose
const crypto = require('crypto')
const Category = require('../model/categoryModel')
const Cart = require('../model/cartModel')
const Order = require('../model/orderModel')
const nodemailer = require('nodemailer')
const saltRounds = 10
const passport = require('passport')
const { log } = require('console')
// In-memory storage for OTP (for demonstration purposes)
let otpStorage = {}

const registerUser = async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;


        // Check if user already exists
        const user = await User.findOne({ email });
        if (user) {
            return res.render('user/register', {
                message: "User already exists!",
                enteredEmail: email,
                enteredName: name,
                enteredPhone: phone,
                enteredPassword: password, hideHeader: true
            });
        }

        // Generate OTP and store it temporarily
        const otp = crypto.randomInt(100000, 999999).toString();
        otpStorage[email] = { otp, timestamp: Date.now() };

        // Send OTP to the user's email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,  // Use your email from .env
                pass: process.env.PASSWORD // Use your email password from .env
            },
            tls: {
                rejectUnauthorized: false // Disable certificate validation
            }
        });

        const mailOptions = {
            from: 'nivzme@gmail.com',
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email: ", error);
                return res.status(500).json({ message: 'Error sending OTP' });
            }

            res.render('user/verifyOtp', {
                email,
                password,
                phone,
                name,
                message: 'OTP sent successfully!', hideHeader: true
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering user' });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if the email exists in OTP storage
        if (!otpStorage[email]) {
            return res.render('user/verifyOtp', { email, message: 'OTP request not found or expired', hideHeader: true });
        }

        // Generate a new OTP and update OTP storage
        const newOtp = crypto.randomInt(100000, 999999).toString();
        otpStorage[email] = { otp: newOtp, timestamp: Date.now() };

        // Send the new OTP via email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });

        const mailOptions = {
            from: 'nivzme@gmail.com',
            to: email,
            subject: 'Your Resent OTP Code',
            text: `Your new OTP code is: ${newOtp}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error resending OTP: ", error);
                return res.render('user/verifyOtp', { email, message: 'Error resending OTP. Please try again.' });
            }
            res.render('user/verifyOtp', { email, message: 'OTP resent successfully!', hideHeader: true });
        });
    } catch (error) {
        console.error(error);
        res.render('user/verifyOtp', { email, message: 'An error occurred while resending OTP.', hideHeader: true });
    }
};

const verifyOtp = async (req, res) => {
    const { email, password, phone, name, otp } = req.body;

    // Check if OTP exists for the email
    const storedOtp = otpStorage[email];

    if (!storedOtp) {
        return res.render('user/verifyOtp', {
            message: "OTP not sent or expired",
            name,
            email,
            password,
            phone, hideHeader: true
        });
    }

    // Check if OTP is expired (2 minutes expiration)
    const currentTime = Date.now();
    const otpExpiryTime = 2 * 60 * 1000;

    if (currentTime - storedOtp.timestamp > otpExpiryTime) {
        delete otpStorage[email]; // Remove expired OTP
        return res.render('user/register', { message: "OTP expired, Register user again", hideHeader: true });
    }

    // Check if OTP matches
    if (storedOtp.otp === otp) {
        delete otpStorage[email]; // OTP verified, now register the user

        // Hash the password before saving
        const hashedPassword = bcrypt.hashSync(password, saltRounds);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone
        });

        await newUser.save();
        return res.render('user/login', {
            message: "User registered successfully!"
        });
    } else {
        return res.render('user/verifyOtp', {
            message: "Invalid OTP. Please try again.",
            name,
            email,
            password,
            phone, hideHeader: true
        });
    }
};

// Load registration page
const loadRegister = (req, res) => {
    res.render('user/register', { hideHeader: true })
}

// Load OTP verification page
const loadOtpPage = (req, res) => {
    const { email } = req.query
    res.render('user/verifyOtp', { email })
}

const loadLogin = async (req, res) => {
    res.render('user/login', { hideHeader: true })
}
const loginUser = async (req, res) => {
    let { email, password } = req.body;
    let user = await User.findOne({ email });
    let products = await Product.find({ isListed: true });
    let categories = await Category.find();

    if (!user) {
        res.render('user/login', {
            message2: "User not Existing!",
            enteredEmail: email,
            hideHeader: true // Pass back the email
        });
        return false;
    }

    const isMatch = await bcrypt.compareSync(password, user.password);

    if (!isMatch) {
        res.render('user/login', {
            message2: "Password is Incorrect!",
            enteredEmail: email, // Pass back the email
            hideHeader: true
        });
    } else if (user.isBlocked) {
        res.render('user/login', {
            message2: "You are blocked by the admin",
            enteredEmail: email // Pass back the email
            , hideHeader: true
        });
    } else {
        req.session.user = true;
        req.session.email = email;
        res.render('user/home', {
            products,
            email: req.session.email,
            user,
            categories
        });
    }
};


// OAuth Callback for Google Login
const googleCallback = async (req, res) => {
    try {
        // When Google authentication succeeds, req.user contains the authenticated user
        const user = req.user

        req.session.user = true;
        req.session.email = user.email;

        // Optionally, fetch data for rendering the home page
        const products = await Product.find({ isListed: true });
        const categories = await Category.find();

        res.render('user/home', { products, email: req.session.email, user, categories });
    } catch (error) {
        console.error("Error during Google callback: ", error);
        res.render('user/login', { message2: "Google login failed. Please try again.", hideHeader: true });
    }
};

// Initiate Google OAuth
const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

const loadHome = async (req, res) => {


    if (!req.session.user) {
        return res.redirect('/user/login'); // Redirect if no session exists
    }

    const user = await User.findOne({ email: req.session.email });

    if (!user) {
        req.session.destroy(); // Destroy session if user does not exist
        return res.redirect('/user/login');
    }

    if (user.isBlocked) {
        req.session.destroy(); // Destroy session if user is blocked
        return res.redirect('/user/login');
    }

    let products = await Product.find({ isListed: true });
    let categories = await Category.find();

    res.render('user/home', {
        products,
        email: req.session.email,
        user,
        categories
    });
};


const logoutUser = (req, res) => {
    if (req.session.user) {
        req.session.destroy()
        res.render('user/login', { message: "logged out Successfully", hideHeader: true })
    }
}


const loadProductDetails = async (req, res) => {
    let proId = req.params.id;
    let category = await Category.findOne({ products: { $in: [proId] } });
    let product = await Product.findOne({ productId: proId });
    let stock = product.stock
    let discount = product.discount || 0;
    let discountedPrice = product.price - ((discount / 100) * product.price);
    discountedPrice = Math.floor(discountedPrice);

    let allProducts = await Product.find({ name: product.name })

    if (!category) {
        // Handle case where the product is not part of any category
        res.render('user/productDetails', { product, category, discountedPrice, stock });
        return
    }



    if (!product) {
        // Handle case where the product itself does not exist
        return res.status(404).render('error', { message: 'Product not found' });
    }

    if (!product.isListed) {
        return res.redirect('/user/home')
    }

    let categoryId = category.categoryId.toString();
    let categoryItems = await Category.findOne({ categoryId }, { products: 1, _id: 0 });

    if (!categoryItems || !categoryItems.products) {
        // Handle case where no products are associated with the category
        return res.status(404).render('error', { message: 'No products found in the category' });
    }



    const ids = categoryItems.products.map(id => id.toString());
    let products = [];

    for (let id of ids) {
        let productDetails = await Product.findOne({ productId: id });

        if (productDetails && productDetails.productId.toString() !== proId) {
            products.push(productDetails);
        }
    }

    res.render('user/productDetails', { product, category, products, discountedPrice, allProducts, stock });


}


const loadCategory = async (req, res) => {
    const user = await User.findOne({ email: req.session.email });
    if (user.isBlocked) {
        req.session.destroy(); // Destroy session if user is blocked
        return res.redirect('/user/login');
    }
    categoryID = req.params.id
    let category = await Category.findOne({ categoryId: categoryID }, { products: 1, _id: 0 })

    const ids = category.products.map(id => id.toString());
    let products = []
    for (id of ids) {
        let productDetails = await Product.findOne({ productId: id })

        products.push(productDetails)
    }

    res.render('user/category', { products, user })

}

const loadforgotPassword = async (req, res) => {
    res.render('user/forgotPassword', { hideHeader: true })
}

const sendResetMail = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('user/forgotPassword', { message: 'User not found!', hideHeader: true });
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // Token valid for 1 hour

        user.resetToken = resetToken;
        user.resetTokenExpiry = resetTokenExpiry;
        await user.save();

        // Send reset email
        const resetLink = `http://localhost:3001/user/reset-password/${resetToken}`;
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD,
            },
            tls: {
                rejectUnauthorized: false, // Allow self-signed certificates
            },
        });


        const mailOptions = {
            from: 'noreply@yourwebsite.com',
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Click this link to reset your password: ${resetLink}`,
        };

        await transporter.sendMail(mailOptions);

        res.render('user/forgotPassword', { message: 'Password reset email sent!' });
    } catch (error) {
        console.error(error);
        res.status(500).render('user/forgotPassword', { message: 'An error occurred. Please try again.', hideHeader: true });
    }
}

const loadResetPassword = async (req, res) => {
    const { token } = req.params;

    try {
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.render('user/resetPassword', { message: 'Invalid or expired token', email: null });
        }

        res.render('user/resetPassword', { message: null, email: user.email });
    } catch (error) {
        console.error(error);
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email: null, hideHeader: true });
    }
}

const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('user/resetPassword', { message: 'User not found!', email });
        }

        user.password = bcrypt.hashSync(newPassword, 10); // Hash the new password
        user.resetToken = null;
        user.resetTokenExpiry = null;
        await user.save();

        res.render('user/login', { message: 'Password reset successful! Please log in.', message2: null, user, hideHeader: true });
    } catch (error) {
        console.error(error);
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email, hideHeader: true });
    }
}

const loadProducts = async (req, res) => {

    let products = await Product.find({ isListed: true });
    const user = await User.findOne({ email: req.session.email });
    if (user.isBlocked) {
        req.session.destroy(); // Destroy session if user is blocked
        return res.redirect('/user/login');
    }

    res.render('user/listProducts', { products, user })
}

const loadProfile = async (req, res) => {
    let userEmail = req.session.email
    let user = await User.findOne({ email: userEmail })
    let orders = await Order.find({userId: user.userId})
    console.log(orders);
    
    res.render('user/profile', { user, orders })
}

const loadEditProfile = async (req, res) => {
    let userEmail = req.session.email
    let user = await User.findOne({ email: userEmail })
    res.render('user/editProfile', { user })
}

const postAddress = async (req, res) => {
    let userEmail = req.session.email
    const { line1, city, state, country, zipCode } = req.body;
    
    let user = await User.findOne({ email: userEmail })
    let orders = await Order.find({userId: user.userId})
    const addressExists = user.address.some((address) =>
        address.line1 === line1 &&
        address.city === city &&
        address.state === state &&
        address.country === country &&
        address.zipCode === zipCode
    );

    if (addressExists) {
        return res.render('user/profile', { message: "Address already exists" })
    }

    const newAddress = { line1, city, state, country, zipCode };

    user.address.push(newAddress)
    await user.save()

    res.render('user/profile', { message: "Address added successfully ", user, orders })
}

const postProfile = async (req, res) => {
    let { name, email, phone } = req.body
    await User.updateOne({ email: req.session.email }, { $set: { name, email, phone } })
    let user = await User.findOne({ email: req.session.email })
    res.render('user/profile', { message: "User details updated", user })


}

const loadEditAddress = async (req, res) => {
    let addressId = req.params.id
    let addressArray = await User.aggregate([
        { $unwind: "$address" }, // Unwind the 'address' array
        { $match: { "address._id": new mongoose.Types.ObjectId(addressId) } },
        { $project: { address: 1, _id: 0 } } // Correctly instantiate ObjectId
    ]);

    const [{ address }] = addressArray



    res.render('user/editAddress', { address })
}

const postEditedAddress = async (req, res) => {
    let { line1, city, state, country, zipCode } = req.body
    let addressId = req.params.id
    await User.updateOne(
        { "address._id": addressId }, // Find the user where the address._id matches the given addressId
        {
            $set: {
                "address.$.line1": line1,  // Update line1
                "address.$.city": city,    // Update city
                "address.$.state": state,  // Update state
                "address.$.country": country, // Update country
                "address.$.zipCode": zipCode // Update zipCode
            }
        }
    );
    let user = await User.findOne({ email: req.session.email })

    res.render('user/profile', { message: "User Address updated", user })


}

const loadCart = async (req, res) => {

    let user = await User.findOne({ email: req.session.email })
    let cart = await Cart.findOne({ userId: user.userId })
    let products = cart.products


    res.render('user/cart', { user, products })
}

const addToCart = async (req, res) => {
    let { productName, productSize, productQuantity } = req.query

    let user = await User.findOne({ email: req.session.email })
    let userId = user.userId.toString()

    let cart = await Cart.findOne({ userId })

    let newCart = new Cart({
        userId
    })

    if (!cart) {
        await newCart.save()
    }

    let productExist = await Cart.findOne({ userId, "products.productName": productName, "products.size": productSize })
    if (productExist) {
        let products = await Product.find({ isListed: true });
        let user = await User.findOne({ email: req.session.email })
        return res.render('user/listProducts', { products, message: "Added to Cart already, Browse other products :)", user })
    } else {


        let product = await Product.findOne({ name: productName }, { images: 1, price: 1, discount:1 })
        let discount = product.discount || 0;
        let discountedPrice = product.price - ((discount / 100) * product.price);
        discountedPrice = Math.floor(discountedPrice);

        await Cart.updateOne(
            { userId },
            {
                $addToSet: {
                    products: {
                        productName: productName,
                        quantity: productQuantity,
                        size: productSize,
                        image: product.images[0],
                        price: discountedPrice
                    }
                }
            }
        );

        let products = await Product.find({ isListed: true });
        let user = await User.findOne({ email: req.session.email })
        return res.render('user/listProducts', { products, message: "Added to Cart, Browse for more", user })
    }

}

const deleteProduct = async (req, res) => {
    let productId = req.params.id
    let user = await User.findOne({ email: req.session.email })
    let cart = await Cart.findOne({ userId: user.userId })
    const updatedCart = await Cart.findOneAndUpdate(
        { userId: user.userId }, // Match the cart by userId
        { $pull: { products: { _id: productId } } }, // Remove product by its _id
        { new: true } // Return the updated document
    );

    if (updatedCart) {
        res.redirect('/user/cart')
    }

}

const loadCheckout = async (req, res) => {
    let user = await User.findOne({ email: req.session.email })
    let address = user.address[0]

    let cart = await Cart.findOne({ userId: user.userId })
    let products = cart.products
    let total = 0;

    products.forEach(product => {
        total += product.price * product.quantity;
    });

    let grandTotal = total + 100

    res.render('user/checkout', { address, user, products, total, grandTotal })
}

const placeOrder = async(req, res)=>{
    const { name, email, phone, line1, city, state, country, zipCode, paymentMethod } = req.body;
    let user = await User.findOne({email: req.session.email})
    let cart = await Cart.findOne({userId: user.userId})
    console.log(cart.products);
    
    let newOrder = new Order({
        userId: user.userId,
        address:{
            name, phone, email,
            line1, state, city,
            country, zipCode
        },
        products: cart.products,
        paymentMethod
    })

    await newOrder.save()
    cart.products.forEach(async (product)=>{
        let currentProduct = await Product.findOne({name: product.productName, size: product.size})
        let newStock = currentProduct.stock - product.quantity
        
        
        await Product.updateOne({name: product.productName, size: product.size}, {$set: {stock: newStock}})
        await Product.updateOne({name: product.productName, size: product.size}, {$inc: {orderCount: 1}})
    })

    await Cart.updateOne({userId: user.userId}, {$set: {products: []}})
    let categories = await Category.find({})
    res.render('user/home', {message: "Order was placed Successfully", user, categories})
    
}

const sort = async(req, res)=>{
    let {sort} = req.query
    let user = await User.findOne({email: req.session.email})
    
    if(sort === 'price_asc'){
        let products = await Product.find({}).sort({ price: 1 });
        res.render('user/listProducts', {products})

    }else if(sort === 'price_desc'){
        let products = await Product.find({}).sort({ price: -1 });
        res.render('user/listProducts', {products})

    }else if(sort === 'newest'){
        let products = await Product.find({}).sort({ createdAt: -1 });
        res.render('user/listProducts', {products})

    }else if(sort === 'popularity'){
        let products = await Product.find({}).sort({ orderCount: -1 });
        res.render('user/listProducts', {products})

    }
    
}

module.exports = {
    registerUser, loadRegister, verifyOtp, loadOtpPage, loadLogin, loginUser, loadHome, loadforgotPassword, sendResetMail,
    logoutUser, loadProductDetails, googleAuth, googleCallback, loadCategory, resendOtp, loadResetPassword, resetPassword, loadProducts,
    loadProfile, loadEditProfile, postAddress, postProfile, loadEditAddress, postEditedAddress, loadCart, addToCart, deleteProduct, 
    loadCheckout, placeOrder, sort
}
