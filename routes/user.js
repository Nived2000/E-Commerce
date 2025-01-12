const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');
const auth = require('../middlewares/auth');
const passport = require("passport");

// Route to load the registration page
router.get('/register', auth.isLogin, userController.loadRegister);

// Route to handle user registration and sending OTP
router.post('/register', userController.registerUser);

// Route to load OTP verification page
router.get('/verify-otp', userController.loadOtpPage);

// Route to verify the OTP entered by the user
router.post('/verify-otp', userController.verifyOtp);

// Login and authentication routes
router.get('/login', auth.isLogin, userController.loadLogin);
router.post('/login', userController.loginUser);

// Logout route
router.get('/logout', auth.checkSession, userController.logoutUser);

// Home page
router.get('/home', auth.checkSession, userController.loadHome);

// Product details
router.get('/productDetail/:id', userController.loadProductDetails);

// OAuth Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    userController.googleCallback
);

// Category and profile-related routes
router.get('/category/:id', auth.checkSession, userController.loadCategory);
router.get('/profile', auth.checkSession, userController.loadProfile);
router.get('/editProfile', auth.checkSession, userController.loadEditProfile);
router.post('/postProfile', auth.checkSession, userController.postProfile);

// OTP-related routes
router.post('/resend-otp', userController.resendOtp);

// Forgot password and reset password routes
router.get('/forgot-password', auth.isLogin, userController.loadforgotPassword);
router.post('/forgot-password', userController.sendResetMail);
router.get('/reset-password/:token', userController.loadResetPassword);
router.post('/reset-password', userController.resetPassword);

// Products and cart routes
router.get('/products', auth.checkSession, userController.loadProducts);
router.get('/cart', auth.checkSession, userController.loadCart);
router.get('/addToCart', auth.checkSession, userController.addToCart);
router.get('/delete-product/:id', auth.checkSession, userController.deleteProduct);

// Checkout and order routes
router.post('/checkout', auth.checkSession, userController.loadCheckout);
router.post('/place-order', auth.checkSession, userController.placeOrder);
router.get('/delete-order/:id', auth.checkSession, userController.cancelOrder);
router.get('/orders', auth.checkSession, userController.loadOrders)
router.get('/order-details/:id', auth.checkSession, userController.orderDetails)

// Address-related routes
router.post('/postAddress', auth.checkSession, userController.postAddress);
router.get('/editAddress/:id', auth.checkSession, userController.loadEditAddress);
router.post('/postEditedAddress/:id', auth.checkSession, userController.postEditedAddress);
router.post('/verify-payment', userController.verifyPayment);


// Filter and sort route
router.get('/filter', auth.checkSession, userController.sort);
router.get('/returnProduct/:id', userController.returnProduct)
router.get('/search', userController.searchItem)

module.exports = router;
