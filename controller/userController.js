const { message } = require('prompt')
const User = require('../model/userModel')
const Product = require('../model/productModel')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose');  // Add this line to import mongoose
const crypto = require('crypto')
const Category = require('../model/categoryModel')
const Cart = require('../model/cartModel')
const Order = require('../model/orderModel')
const Wallet = require('../model/walletModel')
const Coupon = require('../model/couponModel')
const Wishlist = require('../model/wishlistModel')
const nodemailer = require('nodemailer')
const saltRounds = 10
const passport = require('passport')
const { log } = require('console')
const Razorpay = require('razorpay');
// In-memory storage for OTP (for demonstration purposes)
let otpStorage = {}

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: "rzp_test_iArv7aHRf3bNlj",
    key_secret: "Tjl4Q6d8S8mDX1IuZe7Faqtx",
});


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
                enteredPassword: password, hideHeader: true, hideFooter: true
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
                message: 'OTP sent successfully!', hideHeader: true, hideFooter: true
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
            return res.render('user/verifyOtp', { email, message: 'OTP request not found or expired', hideHeader: true, hideFooter: true });
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
            res.render('user/verifyOtp', { email, message: 'OTP resent successfully!', hideHeader: true, hideFooter: true });
        });
    } catch (error) {
        console.error(error);
        res.render('user/verifyOtp', { email, message: 'An error occurred while resending OTP.', hideHeader: true, hideFooter: true });
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
            phone, hideHeader: true, hideFooter: true
        });
    }

    // Check if OTP is expired (2 minutes expiration)
    const currentTime = Date.now();
    const otpExpiryTime = 2 * 60 * 1000;

    if (currentTime - storedOtp.timestamp > otpExpiryTime) {
        delete otpStorage[email]; // Remove expired OTP
        return res.render('user/register', { message: "OTP expired, Register user again", hideHeader: true, hideFooter: true });
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
            phone, hideHeader: true, hideFooter: true
        });
    }
};

// Load registration page
const loadRegister = (req, res) => {
    res.render('user/register', { hideHeader: true, hideFooter: true })
}

// Load OTP verification page
const loadOtpPage = (req, res) => {
    const { email } = req.query
    res.render('user/verifyOtp', { email })
}

const loadLogin = async (req, res) => {
    res.render('user/login', { hideHeader: true, hideFooter: true })
}
const loginUser = async (req, res) => {
    let { email, password } = req.body;
    let user = await User.findOne({ email });
    let products = await Product.find({ isListed: true });
    let categories = await Category.find();
    let discountedCategories = await Category.find({ categoryDiscount: { $gt: 0 } }).limit(2)

    if (!user) {
        res.render('user/login', {
            message2: "User not Existing!",
            enteredEmail: email,
            hideHeader: true, hideFooter: true // Pass back the email
        });
        return false;
    }

    const isMatch = await bcrypt.compareSync(password, user.password);

    if (!isMatch) {
        res.render('user/login', {
            message2: "Password is Incorrect!",
            enteredEmail: email, // Pass back the email
            hideHeader: true, hideFooter: true
        });
    } else if (user.isBlocked) {
        res.render('user/login', {
            message2: "You are blocked by the admin",
            enteredEmail: email // Pass back the email
            , hideHeader: true, hideFooter: true
        });
    } else {
        req.session.user = true;
        req.session.email = email;

        res.render('user/home', {
            products,
            email: req.session.email,
            user,
            categories, discountedCategories,
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
        let discountedCategories = await Category.find({ categoryDiscount: { $gt: 0 } }).limit(2)


        res.render('user/home', { products, email: req.session.email, user, categories, discountedCategories });
    } catch (error) {
        console.error("Error during Google callback: ", error);
        res.render('user/login', { message2: "Google login failed. Please try again.", hideHeader: true, hideFooter: true });
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

    let discountedCategories = await Category.find({ categoryDiscount: { $gt: 0 } }).limit(2)



    res.render('user/home', {
        products,
        email: req.session.email,
        user,
        categories,
        discountedCategories
    });
};


const logoutUser = (req, res) => {
    if (req.session.user) {
        req.session.destroy()
        res.render('user/login', { message: "logged out Successfully", hideHeader: true, hideFooter: true })
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
    res.render('user/forgotPassword', { hideHeader: true, hideFooter: true })
}

const sendResetMail = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('user/forgotPassword', { message: 'User not found!', hideHeader: true, hideFooter: true });
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
        res.status(500).render('user/forgotPassword', { message: 'An error occurred. Please try again.', hideHeader: true, hideFooter: true });
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
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email: null, hideHeader: true, hideFooter: true });
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

        res.render('user/login', { message: 'Password reset successful! Please log in.', message2: null, user, hideHeader: true, hideFooter: true });
    } catch (error) {
        console.error(error);
        res.render('user/resetPassword', { message: 'An error occurred. Please try again.', email, hideHeader: true, hideFooter: true });
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

    let wallet = await Wallet.findOne({ userId: user.userId })
    let walletAmount = wallet.amountAvailable
    res.render('user/profile', { user, walletAmount })
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
    const addressExists = user.address.some((address) =>
        address.line1 === line1 &&
        address.city === city &&
        address.state === state &&
        address.country === country &&
        address.zipCode === zipCode
    );

    if (addressExists) {
        let orders = await Order.find({})
        let wallet = await Wallet.findOne({ userId: user.userId })
        let walletAmount = wallet.amountAvailable
        return res.render('user/profile', { message: "Address already exists", orders, walletAmount })
    }

    const newAddress = { line1, city, state, country, zipCode };

    user.address.push(newAddress)
    await user.save()
    let wallet = await Wallet.findOne({ userId: user.userId })
    let walletAmount = wallet.amountAvailable
    res.render('user/profile', { message: "Address added successfully ", user, walletAmount })
}

const postProfile = async (req, res) => {
    let { name, email, phone } = req.body
    await User.updateOne({ email: req.session.email }, { $set: { name, email, phone } })
    let user = await User.findOne({ email: req.session.email })
    let wallet = await Wallet.findOne({ userId: user.userId })
    let walletAmount = wallet.amountAvailable
    res.render('user/profile', { message: "User details updated", user, walletAmount })


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
    let wallet = await Wallet.findOne({ userId: user.userId })
    let walletAmount = wallet.amountAvailable

    res.render('user/profile', { message: "User Address updated", user, walletAmount })


}

const loadCart = async (req, res) => {

    try {
        // Fetch user based on session email
        const user = await User.findOne({ email: req.session.email }).lean();
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Fetch cart based on the user's ID
        const cart = await Cart.findOne({ userId: user.userId }).lean();
        if (!cart || !cart.products || cart.products.length === 0) {
            return res.render('user/cart', {
                user,
                products: [],
                message: "Your cart is empty!",
            });
        }

        // Fetch stock for each product in the cart
        const productsWithStock = await Promise.all(
            cart.products.map(async (cartProduct) => {

                const product = await Product.findOne({ name: cartProduct.productName, size: cartProduct.size }).lean();
                return {
                    ...cartProduct, // Cart-specific details (e.g., quantity)
                    availableStock: product ? product.stock : 0, // Available stock from Product
                };
            })
        );
        console.log(productsWithStock);

        // Render the cart page with user and product data
        res.render('user/cart', { user, products: productsWithStock });
    } catch (error) {
        console.error("Error loading cart page:", error);
        res.status(500).send("Internal Server Error");
    }
};



const addToCart = async (req, res) => {
    let { productName, productSize, productQuantity, wishlist } = req.query;

    console.log(productName, productSize, productQuantity, wishlist);

    try {
        if (req.query.wishlist) {
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
            let products = await Product.find({ isListed: true });
            return res.render("user/listProducts", {
                products,
                message: "Added to Cart already, Browse other products :)",
                user
            });
        }

        let product = await Product.findOne({ name: productName });
        console.log(product);
        
        if (!product) {
            let products = await Product.find({ isListed: true });
            return res.render("user/listProducts", {
                products,
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

        let products = await Product.find({ isListed: true });
        return res.render("user/listProducts", {
            products,
            message: "Added to Cart, Browse for more",
            user
        });
    } catch (error) {
        console.error("Error adding to cart:", error);
        return res.status(500).send("An error occurred while adding the product to the cart.");
    }
};


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
    try {
        // Fetch user and cart details
        const user = await User.findOne({ email: req.session.email }).lean();
        if (!user) {
            return res.status(404).send('User not found');
        }

        const address = user.address || null; // Get the address or set to null if none
        const updatedQuantities = JSON.parse(req.body.updatedQuantities);



        const cart = await Cart.findOne({ userId: user.userId }).lean();

        await updatedQuantities.forEach(async (product) => {
            const { id, quantity } = product; // Destructure `id` and `quantity`

            // Find and update the product's quantity in the cart
            await Cart.updateOne(
                { "products._id": id }, // Match the product's `_id`
                { $set: { "products.$.quantity": quantity } } // Update the quantity using the `$` operator
            );
        });

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
        const wallet = await Wallet.findOne({ userId: user.userId })
        // Calculate totals
        const products = cart.products;
        const total = products.reduce((sum, product) => sum + product.price * product.quantity, 0);
        const grandTotal = total + 100; // Adding fixed shipping or additional cost
        let coupons = await Coupon.find({ availableAfter: { $lte: total } })

        // Render the checkout page
        res.render('user/checkout', {
            address,
            user,
            products,
            total,
            grandTotal,
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

        // Ensure the user is logged in and session email is available
        if (!req.session.email) {
            return res.status(401).send("Unauthorized access. Please log in.");
        }

        // Fetch user and cart details
        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(404).send("User not found.");
        }

        const cart = await Cart.findOne({ userId: user.userId });
        if (!cart || !cart.products || cart.products.length === 0) {
            return res.status(400).send("Cart is empty.");
        }

        // Get coupon details if a coupon ID is provided
        const couponId = req.query.couponId;
        let walletAmount = req.query.walletUsage || 0


        let couponDiscount = 0;
        if (couponId) {
            const coupon = await Coupon.findOne({ couponId });
            if (coupon) {
                couponDiscount = coupon.discountAmount || 0;
            } else {
                return res.status(404).send("Invalid coupon ID.");
            }
        }

        // Calculate order amount
        const orderAmount =
            cart.products.reduce((total, product) => total + product.price * product.quantity, 100) - couponDiscount - walletAmount;

        await Wallet.updateOne({ userId: user.userId }, { $inc: { amountAvailable: -walletAmount } })

        // Handle "Cash On Delivery"
        if (paymentMethod === "Cash on Delivery") {
            const order = new Order({
                userId: user.userId,
                address: {
                    name, phone, email,
                    line1, state, city,
                    country, zipCode,
                },
                products: cart.products,
                paymentMethod,
                orderAmount,
                paymentStatus: "Pending",
                walletAmount
            });

            // Save the order to the database
            await order.save();

            // Update product stock
            for (const product of cart.products) {
                const currentProduct = await Product.findOne({ name: product.productName, size: product.size });
                if (currentProduct) {
                    const newStock = currentProduct.stock - product.quantity;
                    if (newStock < 0) {
                        return res.status(400).send(`Insufficient stock for ${product.productName}`);
                    }
                    await Product.updateOne(
                        { name: product.productName, size: product.size },
                        { $set: { stock: newStock } }
                    );
                }
            }

            // Clear the cart
            await Cart.deleteOne({ userId: user.userId });

            return res.render("user/home", {
                message: "Your order has been placed successfully!",
                user,
                hideFooter: true,
            });
        }

        // Handle online payment
        const amountInPaise = Math.round(orderAmount * 100);
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise, // Convert to paise and round off
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                email: user.email,
                phone: user.phone,
            },
        });

        // Save the order details temporarily in the session (for online payment)
        req.session.tempOrder = {
            userId: user.userId,
            address: {
                name, phone, email,
                line1, state, city,
                country, zipCode,
            },
            products: cart.products,
            paymentMethod,
            orderAmount: amountInPaise,
            razorpayOrderId: razorpayOrder.id,
            walletAmount
        };

        res.render("user/payment", {
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            key: process.env.RAZORPAY_KEY_ID,
            user,
            hideFooter: true,
        });
    } catch (error) {
        console.error("Error placing order:", error.message);
        res.status(500).send("Error placing order. Please try again.");
    }
};




const sort = async (req, res) => {
    let { sort } = req.query
    let user = await User.findOne({ email: req.session.email })

    if (sort === 'price_asc') {
        let products = await Product.find({}).sort({ price: 1 });
        res.render('user/listProducts', { products, user })

    } else if (sort === 'price_desc') {
        let products = await Product.find({}).sort({ price: -1 });
        res.render('user/listProducts', { products, user })

    } else if (sort === 'newest') {
        let products = await Product.find({}).sort({ createdAt: -1 });
        res.render('user/listProducts', { products, user })

    } else if (sort === 'popularity') {
        let products = await Product.find({}).sort({ orderCount: -1 });
        res.render('user/listProducts', { products, user })

    } else if (sort === 'stock') {
        let products = await Product.find({ stock: { $gt: 0 } })
        res.render('user/listProducts', { products, user })

    }

}

const cancelOrder = async (req, res) => {
    try {
        let _id = req.params.id;
        const user = await User.findOne({ email: req.session.email });
        let currOrders = await Order.findOne({ _id });
        
        let refundAmount;
        let walletAmount = currOrders.walletAmount;

        if (currOrders.paymentMethod === "Online Payment") {
            refundAmount = currOrders.orderAmount - 100 + walletAmount; // Add walletAmount to refundAmount
        } else if (currOrders.paymentMethod === "Cash on Delivery") {
            refundAmount = walletAmount; // Only refund the walletAmount
        }

        // Restock products
        for (let product of currOrders.products) {
            let currentProduct = await Product.findOne({ name: product.productName, size: product.size });
            let newStock = currentProduct.stock + product.quantity;

            await Product.updateOne(
                { name: product.productName, size: product.size },
                { $set: { stock: newStock } }
            );
        }

        // Update or create wallet
        let walletExist = await Wallet.findOne({ userId: user.userId });
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

        // Update order status
        await Order.updateOne(
            { _id },
            { $set: { deliveryStatus: "Order cancelled" } }
        );

        let orders = await Order.find({}).sort({ createdAt: -1 });
        res.render('user/orders', { orders, message: "Order is cancelled" });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).send("Something went wrong while cancelling the order.");
    }
};


const loadOrders = async (req, res) => {
    let user = await User.findOne({ email: req.session.email })
    let orders = await Order.find({ userId: user.userId }).sort({ createdAt: -1 })

    res.render('user/orders', { orders })


}

const orderDetails = async (req, res) => {
    let orderId = req.params.id
    let order = await Order.findOne({ orderId })
    let products = order.products
    let deliveryStatus = order.deliveryStatus
    res.render('user/orderDetails', { products, deliveryStatus })
}

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).send("Payment verification failed.");
        }

        // Retrieve temporary order details from session
        const tempOrder = req.session.tempOrder;
        let actualAmount = tempOrder.orderAmount / 100
        // Create a new order
        const newOrder = new Order({
            userId: tempOrder.userId,
            address: tempOrder.address,
            products: tempOrder.products,
            paymentMethod: tempOrder.paymentMethod,
            orderAmount: actualAmount,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
        });

        await newOrder.save();

        // Update stock and clear cart
        await Promise.all(
            tempOrder.products.map(async (product) => {
                const currentProduct = await Product.findOne({ name: product.productName, size: product.size });
                await Product.updateOne(
                    { name: product.productName, size: product.size },
                    { $inc: { stock: -product.quantity, orderCount: 1 } }
                );
            })
        );

        await Cart.updateOne({ userId: tempOrder.userId }, { $set: { products: [] } });

        // Clear tempOrder session
        delete req.session.tempOrder;

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
    let id = req.params.id

    await Order.updateOne(
        { "products._id": id }, // Match the Order with the specific product _id
        { $set: { "products.$.returnStatus": true } } // Use the positional operator to update the field within the array
    );

    res.redirect('/user/orders')

}

const searchItem = async (req, res) => {
    try {
        const query = req.query.q; // Get the search query from the URL
        const products = await Product.find({
            name: { $regex: query, $options: 'i' } // Case-insensitive search
        });
        res.render('user/searchedProducts', { products, query }); // Render results
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).send('Internal Server Error');
    }
}

const addToWishlist = async (req, res) => {
    try {
        let productName = req.query.productName
        let productSize = req.query.size
        let id = req.params.id
        let user = await User.findOne({ email: req.session.email });
        let product = await Product.findOne({ name: productName, size: productSize });
        let discount = product.discount
        let discountedPrice = Math.floor(product.price - (discount/100) * product.price)
        if (!product) {
            return res.status(404).send("Product not found");
        }

        let sizesArray = await Product.find({ name: product.name }, { size: 1, _id: 0 });
        const sizes = sizesArray.map(item => item.size);

        let wishlist = await Wishlist.findOne({ userId: user.userId });

        if (!wishlist) {
            // Create a new wishlist for the user
            wishlist = new Wishlist({ userId: user.userId, products: [] });
            await wishlist.save();
        }

        // Check if the product already exists in the user's wishlist
        let productExist = wishlist.products.find(
            item => item.productName === product.name
        );

        if (productExist) {
            // Redirect back if product already exists
            return res.redirect(`/user/productDetail/${id}`);
        } else {
            // Add product to the wishlist
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

const loadWishlist = async(req, res)=>{
    let user = await User.findOne({email: req.session.email})
    let wishlist = await Wishlist.findOne({userId: user.userId})
    let wishlistProducts = wishlist.products
    res.render('user/wishlist', {wishlistProducts})
}

const wishlistRemove = async(req, res)=>{
    let productId = req.params.id
    let user = await User.findOne({ email: req.session.email })
    const updatedlist = await Wishlist.findOneAndUpdate(
        { userId: user.userId }, // Match the cart by userId
        { $pull: { products: { _id: productId } } }, // Remove product by its _id
        { new: true } // Return the updated document
    );

    if (updatedlist) {
        res.redirect('/user/wishlist')
    }
}

module.exports = {
    registerUser, loadRegister, verifyOtp, loadOtpPage, loadLogin, loginUser, loadHome, loadforgotPassword, sendResetMail,
    logoutUser, loadProductDetails, googleAuth, googleCallback, loadCategory, resendOtp, loadResetPassword, resetPassword, loadProducts,
    loadProfile, loadEditProfile, postAddress, postProfile, loadEditAddress, postEditedAddress, loadCart, addToCart, deleteProduct,
    loadCheckout, placeOrder, sort, cancelOrder, loadOrders, orderDetails, verifyPayment, returnProduct, searchItem, addToWishlist,
    loadWishlist, wishlistRemove
}
