const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');
const auth = require('../middlewares/auth');
const passport = require("passport");
const { useFormControl } = require('@mui/material');


// Route to load the registration page
router.get('/register', auth.isLogin, userController.loadRegister);

// Route to handle user registration and sending OTP
router.post('/register', userController.registerUser);

// Route to load OTP verification page (optional if you want to use query parameters)
router.get('/verify-otp', userController.loadOtpPage);

// Route to verify the OTP entered by the user
router.post('/verify-otp', userController.verifyOtp);

router.get('/login', auth.isLogin, userController.loadLogin);

router.post('/login', userController.loginUser)

router.get('/home', auth.checkSession, userController.loadHome)

router.get('/logout', auth.checkSession, userController.logoutUser)

router.get('/productDetail/:id', userController.loadProductDetails)

// OAuth Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback Route
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    userController.googleCallback // Handle successful authentication in the controller
);

router.get('/category/:id', auth.checkSession, userController.loadCategory)
router.post('/resend-otp', userController.resendOtp)
router.get('/forgot-password', userController.loadforgotPassword)
router.post('/forgot-password', userController.sendResetMail)
router.get('/reset-password/:token', userController.loadResetPassword)
router.post('/reset-password', userController.resetPassword)
router.get('/products', auth.checkSession, userController.loadProducts)
router.get('/profile', userController.loadProfile)
router.get('/editProfile', userController.loadEditProfile)
router.post('/profile', userController.postAddress)
router.post('/postProfile', userController.postProfile)
router.get('/editAddress/:id', userController.loadEditAddress)
router.post('/postEditedAddress/:id', userController.postEditedAddress)
router.get('/cart', userController.loadCart)
router.get('/addToCart', userController.addToCart)
router.get('/delete-product/:id', userController.deleteProduct)
router.get('/checkout', userController.loadCheckout)
router.post('/place-order', userController.placeOrder)
router.get('/filter', userController.sort)

module.exports = router;
