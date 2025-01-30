const Cart = require("../model/cartModel");
const Wishlist = require("../model/wishlistModel");
const User = require('../model/userModel')

const cartWishlistMiddleware = async (req, res, next) => {
    
    try {
        const email = req.session.email; // Ensure the user is logged in
        const user = await User.findOne({email})
        const userId = user.userId
        if (!userId) {
            res.locals.cartCount = 0;
            res.locals.wishlistCount = 0;
            return next();
        }
        
        let cartCount = 0;
        let wishlistCount = 0;

        // Check if the cart exists and has products
        const cart = await Cart.findOne({ userId });
        if (cart) {
            cartCount = cart.products.length;
        }

        // Check if the wishlist exists and has products
        const wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            wishlistCount = wishlist.products.length;
        }


        // Making cart and wishlist count available in all views
        res.locals.cartCount = cartCount;
        res.locals.wishlistCount = wishlistCount;
    } catch (error) {
        console.error("Error fetching cart/wishlist count:", error);
        res.locals.cartCount = 0;
        res.locals.wishlistCount = 0;
    }
    next();
};

module.exports = cartWishlistMiddleware;
