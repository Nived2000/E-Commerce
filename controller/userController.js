const { message } = require('prompt')
const User = require('../model/userModel')
const Product = require('../model/productModel')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const Category = require('../model/categoryModel')
const nodemailer = require('nodemailer')
const saltRounds = 10
const passport = require('passport')
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
                enteredPassword: password 
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
                message: 'OTP sent successfully!' 
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
            return res.render('user/verifyOtp', { email, message: 'OTP request not found or expired' });
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
            res.render('user/verifyOtp', { email, message: 'OTP resent successfully!' });
        });
    } catch (error) {
        console.error(error);
        res.render('user/verifyOtp', { email, message: 'An error occurred while resending OTP.' });
    }
};

const verifyOtp = async (req, res) => {
    const { email, password, phone, name, otp } = req.body
    
    // Check if OTP exists for the email
    const storedOtp = otpStorage[email]

    if (!storedOtp) {
        return res.status(400).json({ message: 'OTP not sent or expired' })
    }

    // Check if OTP is expired (2 minutes expiration)
    const currentTime = Date.now()
    const otpExpiryTime = 2 * 60 * 1000
    if (currentTime - storedOtp.timestamp > otpExpiryTime) {
        delete otpStorage[email]
        return res.status(400).json({ message: 'OTP expired' })
    }

    // Check if OTP matches
    if (storedOtp.otp === otp) {
        delete otpStorage[email] // OTP verified, now register the user

        // Hash the password before saving
        const hashedPassword = await bcrypt.hashSync(req.body.password, saltRounds)

        const newUser = new User({
            name, 
            email,
            password: hashedPassword,
            phone 
        })

        await newUser.save()
        res.render('user/login', { message: "User registered successfully!" })
    } else {
        res.render('user/verifyOtp', {message: "Invalid OTP", name, email, password, phone })
    }
}

// Load registration page
const loadRegister = (req, res) => {
    res.render('user/register')
}

// Load OTP verification page
const loadOtpPage = (req, res) => {
    const { email } = req.query
    res.render('user/verifyOtp', { email })
}

const loadLogin = async (req, res)=>{
    res.render('user/login')
}
const loginUser = async (req, res) => {
    let { email, password } = req.body;
    let user = await User.findOne({ email });
    let products = await Product.find({ isListed: true });
    let categories = await Category.find();

    if (!user) {
        res.render('user/login', { 
            message2: "User not Existing!", 
            enteredEmail: email // Pass back the email
        });
        return false;
    }

    const isMatch = await bcrypt.compareSync(password, user.password);

    if (!isMatch) {
        res.render('user/login', { 
            message2: "Password is Incorrect!", 
            enteredEmail: email // Pass back the email
        });
    } else if (user.isBlocked) {
        res.render('user/login', { 
            message2: "You are blocked by the admin", 
            enteredEmail: email // Pass back the email
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
        res.render('user/login', { message2: "Google login failed. Please try again." });
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
        res.render('user/login', { message: "logged out Successfully" })
    }
}


const loadProductDetails = async(req, res)=>{
    let proId = req.params.id;
    let category = await Category.findOne({ products: { $in: [proId] } });
    let product = await Product.findOne({ productId: proId });
    let discount = product.discount || 0;
    let discountedPrice = product.price - ((discount / 100) * product.price);
    discountedPrice = Math.floor(discountedPrice);

    let allProducts = await Product.find({name: product.name})
    
if (!category) {
    // Handle case where the product is not part of any category
    res.render('user/productDetails', { product, category, discountedPrice });
    return
}



if (!product) {
    // Handle case where the product itself does not exist
    return res.status(404).render('error', { message: 'Product not found' });
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

res.render('user/productDetails', { product, category, products, discountedPrice, allProducts });

    
}

const loadCategory = async(req, res)=>{
    categoryID = req.params.id
    let category = await Category.findOne({categoryId:categoryID}, {products:1, _id:0})
    
    const ids = category.products.map(id => id.toString());
    let products = []
    for( id of ids){
        let productDetails = await Product.findOne({productId: id})
        
        products.push(productDetails)
    }

    res.render('user/category', {products})
    
}

const loadforgotPassword = async (req, res)=>{
    res.render('user/forgotPassword')
}

const sendResetMail = async(req, res)=>{
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('user/forgotPassword', { message: 'User not found!' });
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
        res.status(500).render('user/forgotPassword', { message: 'An error occurred. Please try again.' });
    }
}

const loadResetPassword = async(req, res)=>{
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
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email: null });
    }
}

const resetPassword = async(req, res)=>{
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

        res.render('user/login', { message: 'Password reset successful! Please log in.', message2: null });
    } catch (error) {
        console.error(error);
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email });
    }
}

const loadProducts = async(req, res)=>{

    let products = await Product.find({ isListed: true });

    res.render('user/listProducts', {products})
}

module.exports = { registerUser, loadRegister, verifyOtp, loadOtpPage, loadLogin, loginUser, loadHome, loadforgotPassword, sendResetMail, logoutUser,loadProductDetails, googleAuth, googleCallback, loadCategory, resendOtp, loadResetPassword, resetPassword, loadProducts }
