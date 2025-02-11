const User = require('../model/userModel');

// Middleware to check user session
const checkSession = async (req, res, next) => {
    if (req.session?.user) {
        try {
            let user = await User.findOne({ email: req.session.email });
            if (user) {
                next();
            } else {
                req.session.destroy(() => {
                    res.redirect('/user/login');
                });
            }
        } catch (error) {
            console.error("Error checking user session:", error);
            res.redirect('/user/login');
        }
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

// Middleware to check admin session and verify from DB
const checkSessionAdmin = async (req, res, next) => {
    if (req.session?.admin) {
        try {
            let admin = await User.findOne({ email: req.session.AdminEmail, isAdmin: true });
            if (admin) {
                next();
            } else {
                req.session.destroy(() => {
                    res.redirect('/admin/login');
                });
            }
        } catch (error) {
            console.error("Error checking admin session:", error);
            res.redirect('/admin/login');
        }
    } else {
        res.redirect('/admin/login');
    }
};

module.exports = { checkSession, isLogin, checkSessionAdmin, isLoginAdmin };
