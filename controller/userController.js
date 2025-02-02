const { message } = require('prompt');
const User = require('../model/userModel');
const Product = require('../model/productModel');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Category = require('../model/categoryModel');
const Cart = require('../model/cartModel');
const Order = require('../model/orderModel');
const Wallet = require('../model/walletModel');
const Coupon = require('../model/couponModel');
const Wishlist = require('../model/wishlistModel');
const Transaction = require('../model/transactionModel');
const nodemailer = require('nodemailer');
const saltRounds = 10;
const passport = require('passport');
const { log } = require('console');
const Razorpay = require('razorpay');
const PDFDocument = require('pdfkit'); // For PDF generation
const path = require('path');
const fs = require('fs');

// In-memory storage for OTP (for demonstration purposes)
let otpStorage = {};

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: "rzp_test_iArv7aHRf3bNlj",
    key_secret: "Tjl4Q6d8S8mDX1IuZe7Faqtx",
});

// Handles user registration, including sending OTP for email verification
const registerUser = async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;

        const user = await User.findOne({ email });
        if (user) {
            return res.render('user/register', {
                message: "User already exists!",
                enteredEmail: email,
                enteredName: name,
                enteredPhone: phone,
                enteredPassword: password,
                hideHeader: true,
                hideFooter: true
            });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        otpStorage[email] = { otp, timestamp: Date.now() };

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD
            },
            tls: {
                rejectUnauthorized: false
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
                message: 'OTP sent successfully!',
                hideHeader: true,
                hideFooter: true
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering user' });
    }
};

// Resends OTP to the user's email
const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!otpStorage[email]) {
            return res.render('user/verifyOtp', { email, message: 'OTP request not found or expired', hideHeader: true, hideFooter: true });
        }

        const newOtp = crypto.randomInt(100000, 999999).toString();
        otpStorage[email] = { otp: newOtp, timestamp: Date.now() };

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
                return res.render('user/verifyOtp', { email, message: 'Error resending OTP. Please try again.', hideHeader: true, hideFooter: true });
            }
            res.render('user/verifyOtp', { email, message: 'OTP resent successfully!', hideHeader: true, hideFooter: true });
        });
    } catch (error) {
        console.error(error);
        res.render('user/verifyOtp', { email, message: 'An error occurred while resending OTP.', hideHeader: true, hideFooter: true });
    }
};

// Verifies the OTP provided by the user and completes registration
const verifyOtp = async (req, res) => {
    const { email, password, phone, name, otp } = req.body;

    const storedOtp = otpStorage[email];

    if (!storedOtp) {
        return res.render('user/verifyOtp', {
            message: "OTP not sent or expired",
            name,
            email,
            password,
            phone,
            hideHeader: true,
            hideFooter: true
        });
    }

    const currentTime = Date.now();
    const otpExpiryTime = 2 * 60 * 1000;

    if (currentTime - storedOtp.timestamp > otpExpiryTime) {
        delete otpStorage[email];
        return res.render('user/register', { message: "OTP expired, Register user again", hideHeader: true, hideFooter: true });
    }

    if (storedOtp.otp === otp) {
        delete otpStorage[email];

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
            phone,
            hideHeader: true,
            hideFooter: true
        });
    }
};

// Loads the user registration page
const loadRegister = (req, res) => {
    res.render('user/register', { hideHeader: true, hideFooter: true });
};

// Loads the OTP verification page
const loadOtpPage = (req, res) => {
    const { email } = req.query;
    res.render('user/verifyOtp', { email, hideHeader: true, hideFooter: true });
};

// Loads the user login page
const loadLogin = async (req, res) => {
    res.render('user/login', { hideHeader: true, hideFooter: true });
};

// Handles user login and session initialization
const loginUser = async (req, res) => {
    let { email, password } = req.body;
    let user = await User.findOne({ email });
    let products = await Product.find({ isListed: true });
    let categories = await Category.find();
    let discountedCategories = await Category.find({ categoryDiscount: { $gt: 0 } }).limit(2);

    if (!user) {
        res.render('user/login', {
            message2: "User not Existing!",
            enteredEmail: email,
            hideHeader: true,
            hideFooter: true
        });
        return false;
    }

    const isMatch = await bcrypt.compareSync(password, user.password);

    if (!isMatch) {
        res.render('user/login', {
            message2: "Password is Incorrect!",
            enteredEmail: email,
            hideHeader: true,
            hideFooter: true
        });
    } else if (user.isBlocked) {
        res.render('user/login', {
            message2: "You are blocked by the admin",
            enteredEmail: email,
            hideHeader: true,
            hideFooter: true
        });
    } else {
        req.session.user = true;
        req.session.email = email;

        res.render('user/home', {
            products,
            email: req.session.email,
            user,
            categories,
            discountedCategories,
        });
    }
};

// Handles Google OAuth callback and logs in the user
const googleCallback = async (req, res) => {
    try {
        const user = req.user;

        req.session.user = true;
        req.session.email = user.email;

        const products = await Product.find({ isListed: true });
        const categories = await Category.find();
        let discountedCategories = await Category.find({ categoryDiscount: { $gt: 0 } }).limit(2);

        res.render('user/home', { products, email: req.session.email, user, categories, discountedCategories });
    } catch (error) {
        console.error("Error during Google callback: ", error);
        res.render('user/login', { message2: "Google login failed. Please try again.", hideHeader: true, hideFooter: true });
    }
};

// Initiates Google OAuth authentication
const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

// Loads the user home page after validating the session
const loadHome = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/user/login');
    }

    const user = await User.findOne({ email: req.session.email });

    if (!user) {
        req.session.destroy();
        return res.redirect('/user/login');
    }

    if (user.isBlocked) {
        req.session.destroy();
        return res.redirect('/user/login');
    }

    let products = await Product.find({ isListed: true });
    let categories = await Category.find();
    let discountedCategories = await Category.find({ categoryDiscount: { $gt: 0 } }).limit(2);

    res.render('user/home', {
        products,
        email: req.session.email,
        user,
        categories,
        discountedCategories
    });
};



const logoutUser = (req, res) => {
    // Logs out the user and destroys the session
    if (req.session.user) {
        req.session.destroy();
        res.render('user/login', { message: "logged out Successfully", hideHeader: true, hideFooter: true });
    }
};

const loadProductDetails = async (req, res) => {
    // Loads and displays details of a specific product
    let proId = req.params.id;
    let category = await Category.findOne({ products: { $in: [proId] } });
    let product = await Product.findOne({ productId: proId });
    let stock = product.stock;
    let discount = product.discount || 0;
    let discountedPrice = product.price - ((discount / 100) * product.price);
    discountedPrice = Math.floor(discountedPrice);

    let allProducts = await Product.find({ name: product.name });

    if (!category) {
        res.render('user/productDetails', { product, category, discountedPrice, stock });
        return;
    }

    if (!product) {
        return res.status(404).render('error', { message: 'Product not found' });
    }

    if (!product.isListed) {
        return res.redirect('/user/home');
    }

    let categoryId = category.categoryId.toString();
    let categoryItems = await Category.findOne({ categoryId }, { products: 1, _id: 0 });

    if (!categoryItems || !categoryItems.products) {
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
};

const loadCategory = async (req, res) => {
    // Loads and displays products in a specific category
    const user = await User.findOne({ email: req.session.email });
    if (user.isBlocked) {
        req.session.destroy();
        return res.redirect('/user/login');
    }
    categoryID = req.params.id;
    let category = await Category.findOne({ categoryId: categoryID }, { products: 1, _id: 0 });

    const ids = category.products.map(id => id.toString());
    let products = [];
    for (id of ids) {
        let productDetails = await Product.findOne({ productId: id });
        products.push(productDetails);
    }

    res.render('user/category', { products, user });
};

const loadforgotPassword = async (req, res) => {
    // Renders the forgot password page
    res.render('user/forgotPassword', { hideHeader: true, hideFooter: true });
};

const sendResetMail = async (req, res) => {
    // Sends a password reset email to the user
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('user/forgotPassword', { message: 'User not found!', hideHeader: true, hideFooter: true });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000;

        user.resetToken = resetToken;
        user.resetTokenExpiry = resetTokenExpiry;
        await user.save();

        const resetLink = `http://localhost:3001/user/reset-password/${resetToken}`;
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
            from: 'noreply@yourwebsite.com',
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Click this link to reset your password: ${resetLink}`,
        };

        await transporter.sendMail(mailOptions);

        res.render('user/forgotPassword', { message: 'Password reset email sent!' });
    } catch (error) {
        console.error(error);
        res.status(500).render('user/forgotPassword', { message: 'An error occurred. Please try again.', hideHeader: true, hideFooter: true });
    }
};

const loadResetPassword = async (req, res) => {
    // Loads the reset password page with a valid token
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
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email: null, hideHeader: true, hideFooter: true });
    }
};

const resetPassword = async (req, res) => {
    // Resets the user's password
    const { email, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('user/resetPassword', { message: 'User not found!', email });
        }

        user.password = bcrypt.hashSync(newPassword, 10);
        user.resetToken = null;
        user.resetTokenExpiry = null;
        await user.save();

        res.render('user/login', { message: 'Password reset successful! Please log in.', message2: null, user, hideHeader: true, hideFooter: true });
    } catch (error) {
        console.error(error);
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email, hideHeader: true, hideFooter: true });
    }
};

const loadProducts = async (req, res) => {
    // Loads and displays paginated products
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const skip = (page - 1) * limit;

        const products = await Product.find({ isListed: true })
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments({ isListed: true });

        const user = await User.findOne({ email: req.session.email });

        if (user.isBlocked) {
            req.session.destroy();
            return res.redirect('/user/login');
        }

        res.render('user/listProducts', {
            products,
            user,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
        });
    } catch (error) {
        console.error('Error loading products:', error);
        res.status(500).send('Internal Server Error');
    }
};

const loadProfile = async (req, res) => {
    // Loads the user profile with wallet and transaction details
    let userEmail = req.session.email;
    let user = await User.findOne({ email: userEmail });

    let wallet = await Wallet.findOne({ userId: user.userId });
    let walletAmount = wallet ? wallet.amountAvailable : 0;
    let transaction = await Transaction.findOne({ userId: user.userId });

    let transactions = [];
    if (transaction) {
        transactions = transaction.transactions.sort((a, b) => b.createdAt - a.createdAt);
    }

    res.render('user/profile', { user, walletAmount, transactions });
};


const loadEditProfile = async (req, res) => {
    // Loads the edit profile page for the user
    let userEmail = req.session.email;
    let user = await User.findOne({ email: userEmail });
    res.render('user/editProfile', { user });
};

const postAddress = async (req, res) => {
    // Adds a new address to the user's profile
    let userEmail = req.session.email;
    const { line1, city, state, country, zipCode } = req.body;

    let user = await User.findOne({ email: userEmail });
    const addressExists = user.address.some((address) =>
        address.line1 === line1 &&
        address.city === city &&
        address.state === state &&
        address.country === country &&
        address.zipCode === zipCode
    );

    if (addressExists) {
        let orders = await Order.find({});
        let wallet = await Wallet.findOne({ userId: user.userId });
        let walletAmount = wallet.amountAvailable;
        let transaction = await Transaction.findOne({ userId: user.userId });
        let transactions = [];
        if (transaction) {
            transactions = transaction.transactions.sort((a, b) => b.createdAt - a.createdAt);
        }
        return res.render('user/profile', { message: "Address already exists", orders, walletAmount, transactions });
    }

    const newAddress = { line1, city, state, country, zipCode };

    user.address.push(newAddress);
    await user.save();
    let wallet = await Wallet.findOne({ userId: user.userId });
    let walletAmount = wallet ? wallet.amountAvailable : 0;
    let transaction = await Transaction.findOne({ userId: user.userId });
    let transactions = [];
        if (transaction) {
            transactions = transaction.transactions.sort((a, b) => b.createdAt - a.createdAt);
        }
    res.render('user/profile', { message: "Address added successfully", user, walletAmount, transactions });
};

const postProfile = async (req, res) => {
    // Updates the user's profile details
    let { name, email, phone } = req.body;
    await User.updateOne({ email: req.session.email }, { $set: { name, email, phone } });
    let user = await User.findOne({ email: req.session.email });
    let wallet = await Wallet.findOne({ userId: user.userId });
    let walletAmount = wallet.amountAvailable;
    let transaction = await Transaction.findOne({ userId: user.userId });
    let transactions = [];
        if (transaction) {
            transactions = transaction.transactions.sort((a, b) => b.createdAt - a.createdAt);
        }
    res.render('user/profile', { message: "User details updated", user, walletAmount, transactions });
};


// Loads the Edit Address page with the details of the specified address
const loadEditAddress = async (req, res) => {
    let addressId = req.params.id;
    let addressArray = await User.aggregate([
        { $unwind: "$address" }, // Unwind the 'address' array
        { $match: { "address._id": new mongoose.Types.ObjectId(addressId) } },
        { $project: { address: 1, _id: 0 } }
    ]);

    const [{ address }] = addressArray;

    res.render('user/editAddress', { address });
};

// Updates the specified address and reloads the user profile page
const postEditedAddress = async (req, res) => {
    let { line1, city, state, country, zipCode } = req.body;
    let addressId = req.params.id;
    await User.updateOne(
        { "address._id": addressId },
        {
            $set: {
                "address.$.line1": line1,
                "address.$.city": city,
                "address.$.state": state,
                "address.$.country": country,
                "address.$.zipCode": zipCode
            }
        }
    );
    let user = await User.findOne({ email: req.session.email });
    let wallet = await Wallet.findOne({ userId: user.userId });
    let walletAmount = wallet.amountAvailable;
    let transaction = await Transaction.findOne({ userId: user.userId });
    let transactions = [];
        if (transaction) {
            transactions = transaction.transactions.sort((a, b) => b.createdAt - a.createdAt);
        }

    res.render('user/profile', { message: "User Address updated", user, walletAmount, transactions });
};

// Loads the user's cart and displays available products with stock details
const loadCart = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.session.email }).lean();
        if (!user) {
            return res.status(404).send('User not found');
        }

        const cart = await Cart.findOne({ userId: user.userId }).lean();
        if (!cart || !cart.products || cart.products.length === 0) {
            return res.render('user/cart', {
                user,
                products: [],
                message: "Your cart is empty!",
                hideDelivery: true
            });
        }

        const productsWithStock = await Promise.all(
            cart.products.map(async (cartProduct) => {
                const product = await Product.findOne({ name: cartProduct.productName, size: cartProduct.size }).lean();

                if (product && product.isListed === false) {
                    return null;
                }

                return {
                    ...cartProduct,
                    availableStock: product ? product.stock : 0,
                };
            })
        );

        const filteredProducts = productsWithStock.filter(product => product !== null);

        if (filteredProducts.length === 0) {
            return res.render('user/cart', {
                user,
                products: [],
                message: "Your cart is empty!",
            });
        }

        res.render('user/cart', { user, products: filteredProducts });

    } catch (error) {
        console.error("Error loading cart page:", error);
        res.status(500).send("Internal Server Error");
    }
};

// Adds a product to the user's cart and optionally removes it from the wishlist
const addToCart = async (req, res) => {
    let { productName, productSize, productQuantity, wishlist, page = 1, limit = 4 } = req.query;

    try {
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        if (wishlist) {
            await Wishlist.updateOne(
                { "products.productName": productName, "products.size": productSize },
                { $pull: { products: { productName: productName, size: productSize } } }
            );
        }

        let user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(400).send("User not found.");
        }
        let userId = user.userId.toString();

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            let newCart = new Cart({ userId });
            await newCart.save();
        }

        let productExist = await Cart.findOne({
            userId,
            "products.productName": productName,
            "products.size": productSize
        });

        if (productExist) {
            let totalProducts = await Product.countDocuments({ isListed: true });
            let products = await Product.find({ isListed: true })
                .skip((page - 1) * limit)
                .limit(limit);

            return res.render("user/listProducts", {
                products,
                totalPages: Math.ceil(totalProducts / limit),
                currentPage: page,
                message: "Added to Cart already, Browse other products :)",
                user
            });
        }

        let product = await Product.findOne({ name: productName });
        if (!product) {
            let totalProducts = await Product.countDocuments({ isListed: true });
            let products = await Product.find({ isListed: true })
                .skip((page - 1) * limit)
                .limit(limit);

            return res.render("user/listProducts", {
                products,
                totalPages: Math.ceil(totalProducts / limit),
                currentPage: page,
                message: "Product not found. Please check and try again.",
                user
            });
        }

        let discount = product.discount || 0;
        let discountedPrice = product.price - (discount / 100) * product.price;
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

        let totalProducts = await Product.countDocuments({ isListed: true });
        let products = await Product.find({ isListed: true })
            .skip((page - 1) * limit)
            .limit(limit);

        return res.render("user/listProducts", {
            products,
            totalPages: Math.ceil(totalProducts / limit),
            currentPage: page,
            message: "Added to Cart, Browse for more",
            user
        });
    } catch (error) {
        console.error("Error adding to cart:", error);
        return res.status(500).send("An error occurred while adding the product to the cart.");
    }
};

// Deletes a product from the user's cart by its ID
const deleteProduct = async (req, res) => {
    let productId = req.params.id;
    let user = await User.findOne({ email: req.session.email });
    let cart = await Cart.findOne({ userId: user.userId });
    const updatedCart = await Cart.findOneAndUpdate(
        { userId: user.userId },
        { $pull: { products: { _id: productId } } },
        { new: true }
    );

    if (updatedCart) {
        res.redirect('/user/cart');
    }
};


const loadCheckout = async (req, res) => {
    // Load the checkout page by fetching user, cart details, updating quantities, and applying filters/coupons
    try {
        const user = await User.findOne({ email: req.session.email }).lean();
        if (!user) return res.status(404).send('User not found');

        const address = user.address || null;
        const updatedQuantities = JSON.parse(req.body.updatedQuantities);
        const cart = await Cart.findOne({ userId: user.userId }).lean();

        await Promise.all(updatedQuantities.map(async ({ id, quantity }) => {
            await Cart.updateOne(
                { "products._id": id },
                { $set: { "products.$.quantity": quantity } }
            );
        }));

        if (!cart || !cart.products || cart.products.length === 0) {
            return res.render('user/checkout', {
                address,
                user,
                products: [],
                total: 0,
                grandTotal: 0,
                message: "Your cart is empty!",
            });
        }

        const productsWithStock = await Promise.all(
            cart.products.map(async (cartProduct) => {
                const product = await Product.findOne({ name: cartProduct.productName, size: cartProduct.size }).lean();
                if (product && product.isListed === false) return null;
                return cartProduct;
            })
        );

        const filteredProducts = productsWithStock.filter(product => product !== null);

        if (filteredProducts.length === 0) {
            return res.render('user/checkout', {
                address,
                user,
                products: [],
                total: 0,
                grandTotal: 0,
                message: "Your cart is empty!",
            });
        }

        const wallet = await Wallet.findOne({ userId: user.userId });
        const total = filteredProducts.reduce((sum, product) => sum + product.price * product.quantity, 0);
        let grandTotal = total + 100;

        let hundredDaysAgo = new Date();
        hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
        let coupons = await Coupon.find({
            availableAfter: { $lte: total },
            createdAt: { $gte: hundredDaysAgo }
        });

        let appliedCoupon = null;
        if (req.body.coupon) {
            appliedCoupon = coupons.find(coupon => coupon.couponName === req.body.coupon);
        }

        if (appliedCoupon) {
            if (appliedCoupon.discountAmount) grandTotal -= appliedCoupon.discountAmount;
            if (appliedCoupon.percentage) grandTotal -= (total * (appliedCoupon.percentage / 100));
        }

        res.render('user/checkout', {
            address,
            user,
            products: filteredProducts,
            total,
            grandTotal: grandTotal < 0 ? 0 : grandTotal,
            coupons,
            wallet
        });
    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.status(500).send("Internal Server Error");
    }
};

const placeOrder = async (req, res) => {
    try {
        const { name, email, phone, line1, city, state, country, zipCode, paymentMethod } = req.body;
        if (!req.session.email) return res.status(401).send("Unauthorized access. Please log in.");

        const user = await User.findOne({ email: req.session.email });
        if (!user) return res.status(404).send("User not found.");

        const cart = await Cart.findOne({ userId: user.userId });
        if (!cart || !cart.products || cart.products.length === 0) return res.status(400).send("Cart is empty.");

        const productsWithStock = await Promise.all(
            cart.products.map(async (cartProduct) => {
                const product = await Product.findOne({ name: cartProduct.productName, size: cartProduct.size }).lean();
                if (product && product.isListed === false) return null;
                return cartProduct;
            })
        );

        const filteredProducts = productsWithStock.filter(product => product !== null);
        if (filteredProducts.length === 0) return res.redirect('/user/cart');

        const couponName = req.query.couponCode;
        let walletAmount = req.query.walletUsage || 0;
        var couponDiscount = 0;

        var totalPrice = filteredProducts.reduce((sum, product) => sum + product.price * product.quantity, 100);

        if (couponName) {
            const coupon = await Coupon.findOne({ couponName });
            if (coupon) {
                if (coupon.discountAmount) {
                    couponDiscount = coupon.discountAmount || 0
                } else if (coupon.discountPercentage) {
                    couponDiscount = Math.ceil((coupon.discountPercentage / 100) * totalPrice) || 0
                }
            }
        }


        const orderAmount = filteredProducts.reduce((total, product) => total + product.price * product.quantity, 100) - couponDiscount - walletAmount;
        
        if (paymentMethod === "Cash on Delivery") {
            const order = new Order({
                userId: user.userId,
                address: { name, phone, email, line1, state, city, country, zipCode },
                products: filteredProducts,
                paymentMethod,
                orderAmount,
                paymentStatus: "Pending",
                walletAmount,
                couponDiscount
            });

            await order.save();

            
            for (const product of filteredProducts) {
                const currentProduct = await Product.findOne({ name: product.productName, size: product.size });
                if (currentProduct) {
                    const newStock = currentProduct.stock - product.quantity;
                    if (newStock < 0) return res.render('user/home', { message: `Insufficient stock for an item` });

                    await Product.updateOne({ name: product.productName, size: product.size }, { $set: { stock: newStock } });
                }
            }

            if (walletAmount > 0) {
                await Wallet.updateOne({ userId: user.userId }, { $inc: { amountAvailable: -walletAmount } });

                let transactionExist = await Transaction.findOne({ userId: user.userId });
                if (!transactionExist) {
                    let newTransaction = new Transaction({
                        userId: user.userId,
                        transactions: [{ amount: walletAmount, type: "debit", createdAt: new Date() }],
                    });
                    await newTransaction.save();
                } else {
                    await Transaction.updateOne(
                        { userId: user.userId },
                        { $push: { transactions: { amount: walletAmount, type: "debit", createdAt: new Date() } } }
                    );
                }
            }

            await Cart.deleteOne({ userId: user.userId });

            return res.render("user/home", {
                message: "Your order has been placed successfully!",
                user,
                hideFooter: true,
            });
        }else if (paymentMethod === "Online Payment") {
            const amountInPaise = Math.round(orderAmount * 100);
            const razorpayOrder = await razorpay.orders.create({
                amount: amountInPaise,
                currency: "INR",
                receipt: `receipt_${Date.now()}`,
                notes: { email: user.email, phone: user.phone },
            });
        
            // Save order in the database with status "Payment Pending"
            const order = new Order({
                userId: user.userId,
                address: { name, phone, email, line1, state, city, country, zipCode },
                products: filteredProducts,
                paymentMethod,
                orderAmount,
                paymentStatus: "Pending", // Initially set to "Payment Pending"
                razorpayOrderId: razorpayOrder.id,
                walletAmount,
                couponDiscount,
                deliveryStatus: "Nil"
            });
        
            await order.save();
        
            res.render("user/payment", {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                key: process.env.RAZORPAY_KEY_ID,
                user,
                hideFooter: true,
            });
        }
        

    } catch (error) {
        console.error("Error placing order:", error.message);
        res.status(500).send("Error placing order. Please try again.");
    }
};


// Function to sort, filter, and paginate products based on user input
const sortAndFilter = async (req, res) => {
    try {
        let { sort, category, page, limit } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 4;
        const skip = (page - 1) * limit;

        let sortStage = {};
        if (sort === 'price_asc') {
            sortStage.price = 1;
        } else if (sort === 'price_desc') {
            sortStage.price = -1;
        } else if (sort === 'newest') {
            sortStage.createdAt = -1;
        } else if (sort === 'popularity') {
            sortStage.orderCount = -1;
        }

        const filterStage = {};
        if (category) {
            filterStage.category = { $in: category };
        }

        const products = await Product.find(filterStage)
            .sort(sortStage)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(filterStage);

        res.render('user/listProducts', {
            products,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
        });
    } catch (error) {
        console.error('Error in sort and filter:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Function to cancel an order and process the refund, restocking, and updating the wallet
const cancelOrder = async (req, res) => {
    try {
        const _id = req.params.id;
        const user = await User.findOne({ email: req.session.email });
        const currOrders = await Order.findOne({ _id });

        if (!currOrders) {
            return res.status(404).send("Order not found.");
        }

        let refundAmount;
        const walletAmount = currOrders.walletAmount;

        if (currOrders.paymentMethod === "Online Payment") {
            refundAmount = currOrders.orderAmount - 100 + walletAmount;
        } else if (currOrders.paymentMethod === "Cash on Delivery") {
            refundAmount = walletAmount;
        } else {
            refundAmount = 0;
        }

        for (const product of currOrders.products) {
            const currentProduct = await Product.findOne({ name: product.productName, size: product.size });

            if (!currentProduct) {
                console.error(`Product not found: ${product.productName}, Size: ${product.size}`);
                continue;
            }

            const newStock = currentProduct.stock + product.quantity;

            await Product.updateOne(
                { name: product.productName, size: product.size },
                { $set: { stock: newStock } }
            );
        }

        const walletExist = await Wallet.findOne({ userId: user.userId });
        if (walletExist) {
            await Wallet.updateOne(
                { userId: user.userId },
                { $inc: { amountAvailable: refundAmount } }
            );
        } else {
            const newWallet = new Wallet({
                userId: user.userId,
                amountAvailable: refundAmount,
            });
            await newWallet.save();
        }

        const transactionExist = await Transaction.findOne({ userId: user.userId });
        if (!transactionExist) {
            const newTransaction = new Transaction({
                userId: user.userId,
                transactions: [],
            });
            await newTransaction.save();
        }

        if (refundAmount > 0) {
            await Transaction.updateOne(
                { userId: user.userId },
                {
                    $push: {
                        transactions: {
                            amount: refundAmount,
                            type: "credit",
                            createdAt: new Date(),
                        },
                    },
                }
            );
        }

        await Order.updateOne(
            { _id },
            { $set: { deliveryStatus: "Order cancelled" } }
        );

        const orders = await Order.find({ userId: user.userId }).sort({ createdAt: -1 });

        res.render('user/orders', { orders, message: "Order is cancelled" });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).send("Something went wrong while cancelling the order.");
    }
};

// Function to load and paginate user orders
const loadOrders = async (req, res) => {
    try {
        let user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(404).send("User not found.");
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId: user.userId });

        let orders = await Order.find({ userId: user.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        let message = orders.length === 0 ? "No orders found. Start shopping to place your first order!" : null;

        const totalPages = Math.ceil(totalOrders / limit);
        const previousPage = page > 1 ? page - 1 : null;
        const nextPage = page < totalPages ? page + 1 : null;

        res.render('user/orders', {
            orders,
            message,
            page,
            limit,
            totalPages,
            previousPage,
            nextPage
        });
    } catch (error) {
        console.error("Error loading orders:", error);
        res.status(500).send("An error occurred while loading orders.");
    }
};

// Function to load and display detailed order information
const orderDetails = async (req, res) => {
    let orderId = req.params.id;
    let order = await Order.findOne({ orderId });

    if (!order) {
        return res.status(404).send("Order not found");
    }

    let products = order.products;
    let deliveryStatus = order.deliveryStatus;

    let daysAfterOrdered = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60 * 24);

    let returnPossible = daysAfterOrdered <= 5;

    res.render('user/orderDetails', { products, deliveryStatus, returnPossible, order });
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        // Fetch the existing order with "Payment Pending" status
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });

        if (!order) {
            return res.status(400).send("Order not found. Please try again.");
        }

        // Verify the payment signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).send("Payment verification failed.");
        }

        // Update order status to "Completed" and add Razorpay payment ID
        await Order.updateOne(
            { razorpayOrderId: razorpay_order_id },
            { 
                $set: { 
                    paymentStatus: "Paid", 
                    deliveryStatus: "In Transit"
                } 
            }
        );

        // Deduct stock for purchased products
        await Promise.all(
            order.products.map(async (product) => {
                await Product.updateOne(
                    { name: product.productName, size: product.size },
                    { $inc: { stock: -product.quantity, orderCount: 1 } }
                );
            })
        );

        // Clear the user's cart
        await Cart.updateOne({ userId: order.userId }, { $set: { products: [] } });

        res.render('user/home', {
            message: "Order was placed successfully",
            user: await User.findOne({ email: req.session.email }),
            categories: await Category.find({}),
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).send("Payment verification failed. Please contact support.");
    }
};




const returnProduct = async (req, res) => {
    // Handles product returns by updating the return status and reason in the order.
    let id = req.params.id
    let returnReason = req.query.reason
    await Order.updateOne(
        { "products._id": id },
        { $set: { "products.$.returnStatus": true, "products.$.returnReason": returnReason } }
    );
    res.redirect('/user/orders')
}

const searchItem = async (req, res) => {
    // Searches for products based on the query parameter and renders the results.
    try {
        const query = req.query.q;
        const products = await Product.find({
            name: { $regex: query, $options: 'i' }
        });
        res.render('user/searchedProducts', { products, query });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).send('Internal Server Error');
    }
}

const addToWishlist = async (req, res) => {
    // Adds a product to the user's wishlist if it doesn't already exist.
    try {
        let productName = req.query.productName
        let productSize = req.query.size
        let id = req.params.id
        let user = await User.findOne({ email: req.session.email });
        let product = await Product.findOne({ name: productName, size: productSize });
        let discount = product.discount
        let discountedPrice = Math.floor(product.price - (discount / 100) * product.price)
        if (!product) {
            return res.status(404).send("Product not found");
        }
        let sizesArray = await Product.find({ name: product.name }, { size: 1, _id: 0 });
        const sizes = sizesArray.map(item => item.size);
        let wishlist = await Wishlist.findOne({ userId: user.userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId: user.userId, products: [] });
            await wishlist.save();
        }
        let productExist = wishlist.products.find(
            item => item.productName === product.name
        );
        if (productExist) {
            return res.redirect(`/user/productDetail/${id}`);
        } else {
            wishlist.products.push({
                productName: product.name,
                size: product.size,
                stockAvailable: product.stock,
                price: discountedPrice,
                image: product.images[0]
            });
            await wishlist.save();
        }
        res.redirect(`/user/productDetail/${id}`);
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).send("An error occurred while adding to the wishlist.");
    }
};

const loadWishlist = async (req, res) => {
    // Loads the user's wishlist with pagination and handles empty wishlist scenario.
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const skip = (page - 1) * limit;
        const products = await Product.find({ isListed: true })
            .skip(skip)
            .limit(limit);
        const user = await User.findOne({ email: req.session.email });
        const totalProducts = await Product.countDocuments({ isListed: true });
        if (!user) {
            return res.status(404).send("User not found.");
        }
        const wishlist = await Wishlist.findOne({ userId: user.userId });
        if (!wishlist) {
            return res.render('user/listProducts', {
                products,
                user,
                currentPage: page,
                totalPages: Math.ceil(totalProducts / limit),
                message: "Add something to wishlist first"
            });
        }
        const wishlistProducts = wishlist.products;
        if (wishlistProducts.length === 0) {
            return res.render('user/wishlist', {
                wishlistProducts,
                message: "Your wishlist is empty!",
                swal: true,
            });
        }
        res.render('user/wishlist', { wishlistProducts });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.status(500).send("Internal Server Error");
    }
};

const wishlistRemove = async (req, res) => {
    // Removes a product from the user's wishlist based on the product ID.
    let productId = req.params.id
    let user = await User.findOne({ email: req.session.email })
    const updatedlist = await Wishlist.findOneAndUpdate(
        { userId: user.userId },
        { $pull: { products: { _id: productId } } },
        { new: true }
    );
    if (updatedlist) {
        res.redirect('/user/wishlist')
    }
}

const retryPayment = async (req, res) => {
    try {
        const orderId = req.params.id;

        let order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).send("Order not found.");
        }

        if (order.paymentStatus !== "Pending" || order.paymentMethod !== "Online Payment") {
            return res.status(400).send("This order is not eligible for retry.");
        }

        const options = {
            amount: order.orderAmount * 100, 
            currency: "INR",
            receipt: order._id.toString(),
            payment_capture: 1, 
        };

      
        const razorpayOrder = await razorpay.orders.create(options);

        await Order.updateOne(
            { orderId },
            { $set: { razorpayOrderId: razorpayOrder.id } }
        );

       
        res.render("user/payment", {
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount, 
            key: process.env.RAZORPAY_KEY_ID,
            user: req.user, 
            hideFooter: true,
        });
    } catch (error) {
        console.error("Error while retrying payment:", error);
        res.status(500).send("Something went wrong while retrying payment.");
    }
};

const downloadInvoice = async (req, res) => {
    try {
        let orderId = req.params.id;
        
      
        const order = await Order.findOne({orderId});
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        let userId = order.userId
        let user = await User.findOne({userId})

        const doc = new PDFDocument({ margin: 50 });
        const filePath = path.join(__dirname, `invoice_${orderId}.pdf`);
        const stream = fs.createWriteStream(filePath);
        
        doc.pipe(stream);

        // **Header Section**
        doc.fontSize(24).fillColor('#333').text('Invoice', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).fillColor('#666').text('Company Name: ,MULTI SHOP', { align: 'center' });
        doc.moveDown(2);

        // **Customer & Order Details**
        doc.fontSize(14).fillColor('#000').text('Order Details', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`Order ID: ${order._id}`);
        doc.text(`Customer Name: ${user.name}`);
        doc.text(`Email: ${user.email}`);
        doc.text(`Phone: ${user.phone}`);
        doc.text(`Shipping Address: ${order.address.line1}, ${order.address.city}, ${order.address.state}, ${order.address.country} - ${order.address.zipCode}`);
        doc.moveDown();

        // **Product Table Header**
        doc.fontSize(14).fillColor('#000').text('Products', { underline: true });
        doc.moveDown();
        doc.fontSize(12).fillColor('#444');
        
        doc.text('-----------------------------------------------------------');
        doc.text(`Item         | Size   | Quantity  | Price (₹)`);
        doc.text('-----------------------------------------------------------');

        // **Product List in Table Format**
        order.products.forEach((product, index) => {
            doc.text(
                `${index + 1}. ${product.productName} | ${product.size} | ${product.quantity} | ₹${product.price}`,
                { indent: 10 }
            );
        });

        doc.text('-----------------------------------------------------------');
        doc.moveDown(2);

        // **Payment & Delivery Details**
        doc.fontSize(14).fillColor('#000').text('Payment Details', { underline: true });
        doc.moveDown();
        doc.fontSize(12).fillColor('#444');
        doc.text(`Total Amount: ₹${order.orderAmount}`, { bold: true });
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Payment Status: ${order.paymentStatus}`);
        doc.text(`Delivery Status: ${order.deliveryStatus}`);
        doc.moveDown(2);

        // **Thank You Note**
        doc.fontSize(14).fillColor('#000').text('Thank you for shopping with us!', { align: 'center' });
        doc.fontSize(12).fillColor('#555').text('For any queries, contact support@yourstore.com', { align: 'center' });

        doc.end();

        stream.on('finish', () => {
            res.download(filePath, `invoice_${orderId}.pdf`, (err) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ message: 'Error downloading invoice' });
                }
                fs.unlinkSync(filePath); 
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


module.exports = {
    registerUser, loadRegister, verifyOtp, loadOtpPage, loadLogin, loginUser, loadHome, loadforgotPassword, sendResetMail,
    logoutUser, loadProductDetails, googleAuth, googleCallback, loadCategory, resendOtp, loadResetPassword, resetPassword, loadProducts,
    loadProfile, loadEditProfile, postAddress, postProfile, loadEditAddress, postEditedAddress, loadCart, addToCart, deleteProduct,
    loadCheckout, placeOrder, sortAndFilter, cancelOrder, loadOrders, orderDetails, verifyPayment, returnProduct, searchItem, addToWishlist,
    loadWishlist, wishlistRemove, retryPayment, downloadInvoice
}
