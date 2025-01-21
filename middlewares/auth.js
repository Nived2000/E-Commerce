const User = require('../model/userModel');

// Middleware to check user session
const checkSession = (req, res, next) => {
    if (req.session?.user) { // Ensure `req.session` exists
        next();
    } else {
        res.redirect('/user/login');
    }
};

// Middleware to check if user is already logged in
const isLogin = (req, res, next) => {
    if (req.session?.user) {
        res.redirect('/user/home');
    } else {
        next();
    }
};

// Middleware to check if admin is already logged in
const isLoginAdmin = (req, res, next) => {
    if (req.session?.admin) {
        res.redirect('/admin/dashboard');
    } else {
        next();
    }
};

// Middleware to check admin session
const checkSessionAdmin = (req, res, next) => {
    if (req.session?.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};


module.exports = {checkSession, isLogin, checkSessionAdmin, isLoginAdmin}