const { message } = require('prompt');
const User = require('../model/userModel');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
const Product = require('../model/productModel');
const Category = require('../model/categoryModel');
const Order = require('../model/orderModel');
const Coupon = require('../model/couponModel');
const { log } = require('handlebars');
const Wallet = require('../model/walletModel');
const Transaction = require('../model/transactionModel');
const PDFDocument = require('pdfkit'); // For PDF generation
const excelJS = require('exceljs'); // For Excel generation
const path = require('path');
const fs = require('fs');

// Renders the login page
const loadLogin = (req, res) => {
    res.render('admin/login', { hideHeader: true, hideFooter: true });
};

// Handles admin login authentication
const loginAdmin = async (req, res) => {
    let { email, password } = req.body;
    let admin = await User.findOne({ email });

    if (!admin) {
        res.render('admin/login', { message: "Invalid Credentials", hideHeader: true, hideFooter: true });
        return false;
    }
    if (!admin.isAdmin) {
        res.render('admin/login', { message: "You are not an admin", hideHeader: true, hideFooter: true });
        return false;
    }

    const isMatch = await bcrypt.compareSync(password, admin.password);

    if (!isMatch) {
        res.render('admin/login', { message: "Password is incorrect", hideHeader: true, hideFooter: true });
    } else {
        req.session.admin = true;
        req.session.AdminEmail = email;
        res.redirect('/admin/dashboard');
        res.end();
    }
};

// Renders the dashboard with the list of users
const loadDashboard = async (req, res) => {
    let users = await User.find({ isAdmin: false });
    res.render('admin/dashboard', { users, email: req.session.AdminEmail, hideHeader: true, hideFooter: true, currentRoute: req.originalUrl });
};

// Blocks a user from accessing the site
const blockUser = async (req, res) => {
    let userID = req.params.id;
    let user = await User.findOne({ userId: userID });
    if (user) {
        if (!user.isBlocked) {
            await User.updateOne({ userId: userID }, { $set: { isBlocked: true } });
        }
        let users = await User.find({ isAdmin: false });
        res.render('admin/dashboard', { users, message: "User successfully blocked", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl });
    }
};

// Unblocks a user from accessing the site
const unblockUser = async (req, res) => {
    let userID = req.params.id;
    let user = await User.findOne({ userId: userID });
    if (user) {
        if (user.isBlocked) {
            await User.updateOne({ userId: userID }, { $set: { isBlocked: false } });
        }
        let users = await User.find({ isAdmin: false });
        res.render('admin/dashboard', { users, message: "User successfully unblocked", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl });
    }
};

// Loads the products page with pagination
const loadProducts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    try {
        const totalProducts = await Product.countDocuments();
        const products = await Product.find().skip(skip).limit(limit);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render('admin/listProducts', {
            products,
            hideHeader: true,
            hideFooter: true,
            currentRoute: req.originalUrl,
            page,
            limit,
            totalPages,
            previousPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
        });
    } catch (error) {
        console.error("Error loading products:", error);
        res.status(500).send("An error occurred while loading products.");
    }
};

// Loads the page for adding a product
const loadAddProducts = async (req, res) => {
    res.render('admin/addProduct', { hideHeader: true, hideFooter: true });
};

// Adds a new product to the database
const addProduct = async (req, res) => {
    try {
        let { name, description, price, brand, size, stock, discount, category } = req.body;
        let products = await Product.find();
        let NAME = name.toUpperCase();
        let productExist = await Product.findOne({ name: NAME, size });

        if (productExist) {
            res.render('admin/listProducts', {
                message: "Product already exists",
                products,
                hideHeader: true,
                hideFooter: true,
                currentRoute: req.originalUrl
            });
            return;
        } else {
            const images = req.files ? req.files.map(file => file.filename) : [];
            const newProduct = new Product({
                name: NAME,
                description,
                price,
                size,
                brand,
                images,
                discount,
                stock,
                category
            });
            await newProduct.save();
            let product = await Product.findOne({ name: NAME, size });
            await Product.updateOne({ productId: product.productId }, { $set: { inCategory: true } });
            await Category.updateOne(
                { category },
                { $addToSet: { products: product.productId } }
            );
            res.redirect('/admin/products');
        }
    } catch (error) {
        console.error(error);
        res.render('admin/addProduct', { message: 'Error adding product', hideHeader: true, hideFooter: true });
    }
};

// Removes a product from the listing
const unlistProduct = async (req, res) => {
    let proID = req.params.id;
    let product = await Product.findOne({ productId: proID });
    if (product) {
        if (product.isListed) {
            await Product.updateOne({ productId: proID }, { $set: { isListed: false } });
        }
    }
    let products = await Product.find();
    res.render('admin/listProducts', { products, message: "Product removed from listing", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl });
};

// Adds a product to the listing
const listProduct = async (req, res) => {
    let proID = req.params.id;
    let product = await Product.findOne({ productId: proID });
    if (product) {
        if (!product.isListed) {
            await Product.updateOne({ productId: proID }, { $set: { isListed: true } });
        }
    }
    let products = await Product.find();
    res.render('admin/listProducts', { products, message: "Product added to listing", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl });
};

// Loads the page for editing a product
const loadEditProduct = async (req, res) => {
    let proID = req.params.id;
    let product = await Product.findOne({ productId: proID });
    res.render('admin/editProduct', { product, hideHeader: true, hideFooter: true });
};

// Edits an existing product in the database
const editProduct = async (req, res) => {
    try {
        const proID = req.params.id;
        const { name, description, price, brand, size, stock, discount, category } = req.body;
        const images = req.files ? req.files.map(file => file.filename) : [];
        let existingProduct = await Product.findOne({ productId: proID });

        if (!existingProduct) {
            return res.status(404).send("Product not found");
        }

        const changesMade =
            existingProduct.name !== name ||
            existingProduct.description !== description ||
            existingProduct.price !== price ||
            existingProduct.brand !== brand ||
            existingProduct.size !== size ||
            existingProduct.stock !== stock ||
            existingProduct.discount !== discount ||
            existingProduct.category !== category;

        if (changesMade) {
            if (existingProduct.category !== category) {
                await Category.updateOne(
                    { category: existingProduct.category },
                    { $pull: { products: existingProduct.productId } }
                );
                await Category.updateOne(
                    { category },
                    { $addToSet: { products: existingProduct.productId } }
                );
            }

            await Product.updateOne(
                { productId: proID },
                { $set: { name, description, price, brand, size, stock, discount, category } },
            );

            if (images.length > 0) {
                await Product.updateOne(
                    { productId: proID },
                    { $push: { images: { $each: images } } }
                );
            }

            let products = await Product.find();
            res.render('admin/listProducts', {
                products,
                message: "Product edited successfully",
                hideHeader: true,
                hideFooter: true,
                currentRoute: req.originalUrl,
            });
        } else {
            let products = await Product.find();
            res.render('admin/listProducts', {
                products,
                message: "No changes were made to the product",
                hideHeader: true,
                hideFooter: true,
                currentRoute: req.originalUrl,
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
};


// Logs out the admin by destroying the session and redirects to the login page with a success message
const logoutAdmin = async (req, res) => {
    req.session.destroy();
    res.render('admin/login', { message: "Logged out successfully", hideHeader: true, hideFooter: true })
}

// Loads all categories from the database and renders the list of categories page
const loadCategory = async (req, res) => {
    let categories = await Category.find()
    console.log(categories);
    res.render('admin/listCategory', { categories, hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
}

// Loads the Add Category page for the admin
const loadAddCategory = async (req, res) => {
    res.render('admin/addCategory', { hideHeader: true, hideFooter: true })
}

// Adds a new category to the database after validating if it already exists
const addCategory = async (req, res) => {
    let { category, image } = req.body;
    let CATEGORY = category.toUpperCase(); // Corrected method name
    let categoryExist = await Category.findOne({ category: CATEGORY });
    const imagePath = req.file ? req.file.filename : null;

    if (categoryExist) {
        res.render('admin/addCategory', { message: "Category already Exist", hideHeader: true, hideFooter: true })
        return
    }

    let newCategory = new Category({
        category: CATEGORY,
        image: imagePath
    })

    await newCategory.save()
    let categories = await Category.find()
    res.render('admin/listCategory', { categories, hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
}

// Loads the page to manage products under a specific category
const loadCategoryManagement = async (req, res) => {
    let categoryId = req.params.id
    let products = await Product.find()
    let categoryName = await Category.find({ categoryId }, { category: 1, _id: 0 })
    let category = categoryName[0].category

    res.render('admin/addProductToCategory', { categoryId, products, category, hideHeader: true, hideFooter: true })
}

// Associates a product with a category and updates the product and category accordingly
const postProductToCategory = async (req, res) => {
    let { categoryId, productId } = req.query;
    let products = await Product.find()
    let product = await Product.findOne({ productId })
    try {
        if (product.inCategory) {
            return res.render('admin/addProductToCategory', { message: "Product already in another category", products, hideHeader: true, hideFooter: true })
        } else {
            await Product.updateOne({ productId }, { $set: { inCategory: true } })
            await Category.updateOne(
                { categoryId },
                { $addToSet: { products: productId } }
            );
            let categories = await Category.find()
            res.render('admin/listCategory', { categories, hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}

// Deletes a category and updates the list of categories
const deleteCategory = async (req, res) => {
    let categoryId = req.params.id
    await Category.deleteOne({ categoryId })
    let categories = await Category.find()
    res.render('admin/listCategory', { categories, message: "Category deleted Successfully", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
}

// Lists orders with pagination and renders the orders page
const listOrders = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    try {
        const totalOrders = await Order.countDocuments();
        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalOrders / limit);
        for (let product of orders) {
            let userId = product.userId;
            let user = await User.findOne({ userId });
            let userEmail = user ? user.email : ''; // Ensure user exists before accessing email

            // Add userEmail to the product object
            product.userEmail = userEmail;
        }
        res.render('admin/listOrders', {
            orders,
            hideHeader: true,
            hideFooter: true,
            currentRoute: req.originalUrl,
            page,
            limit,
            totalPages,
            previousPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
        });
    } catch (error) {
        console.error("Error loading orders:", error);
        res.status(500).send("An error occurred while loading orders.");
    }
};

// Marks an order as delivered and updates the status
const deliveryMark = async (req, res) => {
    let orderId = req.params.id
    await Order.updateOne({ orderId }, { $set: { deliveryStatus: "Delivered" } })
    let orders = await Order.find({}).sort({ createdAt: -1 })
    for (let product of orders) {
        let userId = product.userId;
        let user = await User.findOne({ userId });
        let userEmail = user ? user.email : ''; // Ensure user exists before accessing email

        // Add userEmail to the product object
        product.userEmail = userEmail;
    }
    res.render('admin/listOrders', { orders, message: "Order Status updated!", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
}

// Marks an order as in transit and updates the status
const notdeliveredMark = async (req, res) => {
    let orderId = req.params.id
    await Order.updateOne({ orderId }, { $set: { deliveryStatus: "In Transit" } })
    let orders = await Order.find({}).sort({ createdAt: -1 })
    for (let product of orders) {
        let userId = product.userId;
        let user = await User.findOne({ userId });
        let userEmail = user ? user.email : ''; // Ensure user exists before accessing email

        // Add userEmail to the product object
        product.userEmail = userEmail;
    }
    res.render('admin/listOrders', { orders, message: "Order Status updated!", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
}

// Cancels an order and updates the stock of products in the order
const adminCancel = async (req, res) => {
    let orderId = req.params.id
    let currOrders = await Order.findOne({ orderId })

    currOrders.products.forEach(async (product) => {
        let currentProduct = await Product.findOne({ name: product.productName, size: product.size })
        let newStock = currentProduct.stock + product.quantity
        await Product.updateOne({ name: product.productName, size: product.size }, { $set: { stock: newStock } })
    })
    await Order.updateOne({ orderId }, { $set: { deliveryStatus: "Order Cancelled" } })
    let orders = await Order.find({})
    res.render('admin/listOrders', { orders, message: "Order is cancelled", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
}

// Loads the Add Coupon page for the admin
const loadAddCoupon = async (req, res) => {
    res.render('admin/addCoupon', { hideHeader: true, hideFooter: true })
}

// Adds a new coupon after validating if it already exists and renders the list of coupons with pagination
const postCoupon = async (req, res) => {
    try {
        let { coupon, discount, availableAfter, percentage, page = 1, limit = 5 } = req.body;
        const couponName = coupon.toUpperCase();

        const existingCoupon = await Coupon.findOne({ couponName });
        if (existingCoupon) {
            return res.render('admin/addCoupon', {
                hideHeader: true,
                hideFooter: true,
                message: "Coupon already exists. Please use a different name.",
            });
        }

        const newCoupon = new Coupon({
            couponName,
            discountAmount: discount,
            availableAfter,
            discountPercentage: percentage || 0,
        });

        await newCoupon.save();

        page = parseInt(page);
        limit = parseInt(limit);
        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupon.find()
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('admin/listCoupons', {
            hideHeader: true,
            hideFooter: true,
            message: "Coupon added successfully",
            coupons,
            page,
            totalPages,
            limit,
            previousPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
        });
    } catch (error) {
        console.error(error);
        res.render('admin/addCoupon', {
            hideHeader: true,
            hideFooter: true,
            message: "An error occurred while adding the coupon. Please try again.",
        });
    }
};


const loadReturns = async (req, res) => {
    // Fetches and renders the list of returnable orders with details
    let returns = await Order.aggregate([
        { $unwind: "$products" },
        { $match: { "products.returnStatus": true } },
        {
            $project: {
                _id: 1,
                userId: 1,
                orderId: 1,
                "products.productName": 1,
                "products.price": 1,
                "products.quantity": 1,
                "products.returnStatus": 1,
                "products.adminApproved": 1,
                "products._id": 1,
                "products.returnReason": 1,
                createdAt: 1
            }
        },
        { $sort: { createdAt: -1 } }
    ]);



    // Iterate over each return to fetch user details and add userEmail to the return object
    for (let product of returns) {
        let userId = product.userId;
        let user = await User.findOne({ userId });
        let userEmail = user ? user.email : ''; // Ensure user exists before accessing email

        // Add userEmail to the product object
        product.userEmail = userEmail;
    }

    res.render('admin/listReturns', { returns, hideHeader: true, hideFooter: true })
}

const markReturn = async (req, res) => {
    // Handles the approval of a product return and refunds the amount to the user's wallet
    try {
        let id = req.query.id;
        let price = parseFloat(req.query.price);
        let quantity = parseInt(req.query.quantity, 10);
        let refundAmount = price * quantity;

        let user = await Order.findOne({ "products._id": id });

        if (!user) {
            return res.status(404).send("Order not found");
        }

        await Order.updateOne(
            { "products._id": id },
            { $set: { "products.$.adminApproved": true } }
        );

        let wallet = await Wallet.findOne({ userId: user.userId });

        if (!wallet) {
            wallet = new Wallet({
                userId: user.userId,
                amountAvailable: 0,
            });
            await wallet.save();
        }

        await Wallet.updateOne(
            { userId: user.userId },
            { $inc: { amountAvailable: refundAmount } }
        );

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
                            description: `Refund for product with ID: ${id}`,
                            createdAt: new Date(),
                        },
                    },
                }
            );
        }

        res.redirect('/admin/adminReturn');
    } catch (error) {
        console.error("Error in processing return:", error);
        res.status(500).send("An error occurred while processing the return");
    }
};

const loadEditCategory = async (req, res) => {
    // Loads the category data for editing
    let catId = req.params.id
    let category = await Category.findOne({ categoryId: catId })
    res.render('admin/editCategory', { category, hideHeader: true, hideFooter: true })
}

const postDiscount = async (req, res) => {
    // Updates the discount for products in a category
    let { discount } = req.body
    let id = req.params.id
    let category = await Category.findOne({ categoryId: id })
    category.products.forEach(async (id) => {
        let existingDiscount = category.categoryDiscount
        let newDiscount = discount - existingDiscount
        await Product.updateOne({ productId: id }, { $inc: { discount: newDiscount } })
    })

    await Category.updateOne({ categoryId: id }, { $set: { categoryDiscount: discount } })
    let categories = await Category.find({})
    res.render('admin/listCategory', { categories, message: "Discount added!", hideHeader: true, hideFooter: true, currentRoute: req.originalUrl })
}

const loadSales = async (req, res) => {
    // Fetches and renders sales data based on the specified date range or filter
    let startDate = req.query.startDate || "2025-01-20";
    let endDate = req.query.endDate || "2025-01-31";
    let chartFilter = req.query.chartFilter || "daily";

    var data = [];
    var labels = []

    if (chartFilter === "daily") {
        let today = new Date();
        let startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);

        for (let day = startDate; day <= today; day.setDate(day.getDate() + 1)) {
            let orderCount = await Order.find({
                createdAt: {
                    $gte: day.setHours(0, 0, 0, 0),
                    $lt: new Date(day).setHours(23, 59, 59, 999)
                }
            }).countDocuments();


            data.push(orderCount);
            labels.push(day.toLocaleDateString());
        }

    } else if (chartFilter === "weekly") {
        let today = new Date();
        let startDate = new Date(today);
        startDate.setDate(today.getDate() - 56); // 8 weeks back

        let week = 1; // Initialize week counter

        for (let weekStart = new Date(startDate); weekStart <= today; weekStart.setDate(weekStart.getDate() + 7)) {
            let weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            let orderCount = await Order.find({
                createdAt: {
                    $gte: weekStart.setHours(0, 0, 0, 0),
                    $lt: weekEnd.setHours(23, 59, 59, 999)
                }
            }).countDocuments();

            data.push(orderCount);
            labels.push(`Week ${week}`);  // Add the week number (e.g., "Week 1", "Week 2")

            week++;  // Increment the week counter
        }
    }


    // Monthly filter (Last 6 months)
    else if (chartFilter === "monthly") {
        let today = new Date();
        let startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 5); // Last 6 months

        for (let monthStart = new Date(startDate); monthStart <= today; monthStart.setMonth(monthStart.getMonth() + 1)) {
            let monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0); // Last day of the month

            let orderCount = await Order.find({
                createdAt: {
                    $gte: monthStart.setHours(0, 0, 0, 0),
                    $lt: monthEnd.setHours(23, 59, 59, 999)
                }
            }).countDocuments();

            data.push(orderCount);
            labels.push(`${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}`);
        }
    }

    let topProducts = await Product.find({}).sort({ orderCount: -1 }).limit(7)
    

    let topCategory = new Set();
    let topBrands = new Set();

    for (let x of topProducts) {
        topCategory.add(x.category);
        topBrands.add(x.brand);
    }

    let topCategoryArray = Array.from(topCategory);
    let topBrandsArray = Array.from(topBrands);
    console.log(topProducts, topBrandsArray, topCategoryArray);


    let filter = req.query.filter;

    if (startDate && endDate) {
        filter = null
    }

    let currentDate = new Date();

    if (filter) {
        filter = parseInt(filter);

        if (filter === 1) {
            startDate = new Date(currentDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(currentDate);
            endDate.setHours(23, 59, 59, 999);
        } else if (filter === 7) {
            startDate = new Date(currentDate);
            startDate.setDate(currentDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(currentDate);
            endDate.setHours(23, 59, 59, 999);
        } else if (filter === 30) {
            startDate = new Date(currentDate);
            startDate.setDate(currentDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(currentDate);
            endDate.setHours(23, 59, 59, 999);
        } else {
            return res.status(400).send('Invalid filter value');
        }
    }

    if (startDate && endDate) {
        try {
            const orders = await Order.find({
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                }
            }).sort({ createdAt: -1 });

            let totalSales = 0;
            let totalRevenue = 0;
            let totalOrders = orders.length;

            for (const order of orders) {
                for (const product of order.products) {
                    const originalProduct = await Product.findOne({
                        name: product.productName,
                        size: product.size
                    });
                    const originalPrice = originalProduct.price || 0;
                    totalSales += originalPrice * (product.quantity || 0);
                }

                totalRevenue += order.orderAmount || 0;
            }

            const totalDiscount = totalSales - totalRevenue;


            return res.render('admin/salesReport', {
                hideHeader: true,
                hideFooter: true,
                totalDiscount,
                totalOrders,
                totalSales,
                totalRevenue,
                orders,
                startDate,
                endDate,
                data: JSON.stringify(data), // Pass the data array as a JSON string
                labels: JSON.stringify(labels),
                topBrandsArray,
                topCategoryArray,
                topProducts
            });
        } catch (error) {
            console.error('Error fetching orders:', error);
            return res.status(500).send('Error generating sales report');
        }
    }
    // If no data, render with a message
    res.render('admin/salesReport', {
        hideHeader: true,
        hideFooter: true,
        message: "Enter a date range",
        topBrandsArray,
        topCategoryArray,
        topProducts
    });
};



const downloadReport = async (req, res) => {
    // Generates and downloads a sales report in PDF or Excel format based on the request parameters
    const { format } = req.params;
    const { startDate, endDate } = req.query;

    try {
        if (!startDate || !endDate) {
            return res.status(400).send('Start date and end date are required');
        }

        const orders = await Order.find({
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
        });

        const reportsDir = path.join(__dirname, '..', 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 30 });
            const filePath = path.join(reportsDir, 'salesReport.pdf');
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            doc.fontSize(10).text('Sales Report', { align: 'center' });
            doc.moveDown(1);

            const headerHeight = 18;

            doc.rect(50, doc.y, 50, headerHeight).fill('#3D464D');
            doc.rect(100, doc.y, 150, headerHeight).fill('#3D464D');
            doc.rect(250, doc.y, 100, headerHeight).fill('#3D464D');
            doc.rect(350, doc.y, 150, headerHeight).fill('#3D464D');
            doc.rect(500, doc.y, 100, headerHeight).fill('#3D464D');

            doc.fontSize(8).fillColor('white')
                .text('Sl. No', 55, 60, { width: 50, align: 'center' })
                .text('Order ID', 105, 60, { width: 150, align: 'center' })
                .text('Date (dd-mm-yyyy)', 255, 60, { width: 100, align: 'center' })
                .text('Customer ID', 355, 60, { width: 150, align: 'center' })
                .text('Total Amount (₹)', 505, 60, { width: 100, align: 'center' });

            doc.moveDown(1);
            orders.forEach((order, index) => {
                const yPosition = doc.y + 3;
                const rowHeight = 18;

                doc.rect(50, yPosition, 50, rowHeight).stroke();
                doc.rect(120, yPosition, 150, rowHeight).stroke();
                doc.rect(270, yPosition, 100, rowHeight).stroke();
                doc.rect(380, yPosition, 100, rowHeight).stroke();
                doc.rect(490, yPosition, 100, rowHeight).stroke();

                doc.fontSize(8).fillColor('black')
                    .text(index + 1, 50, yPosition + 5, { width: 50, align: 'center' })
                    .text(order._id, 120, yPosition + 5, { width: 150, align: 'center' })
                    .text(new Date(order.createdAt).toLocaleDateString('en-GB'), 270, yPosition + 5, { width: 100, align: 'center' })
                    .text(order.userId, 380, yPosition + 5, { width: 100, align: 'center' })
                    .text(order.orderAmount, 490, yPosition + 5, { width: 100, align: 'center' });

                doc.moveDown(1);
            });

            doc.end();

            stream.on('finish', () => {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename="SalesReport.pdf"');
                res.sendFile(filePath, (err) => {
                    if (err) {
                        console.error('Error downloading PDF:', err);
                        return res.status(500).send('Error downloading file');
                    }

                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error cleaning up PDF file:', err);
                    });
                });
            });
        }

        else if (format === 'excel') {
            const workbook = new excelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { header: 'Sl. No', key: 'sl_no', width: 10 },
                { header: 'Order ID', key: 'orderId', width: 30 },
                { header: 'Date (dd-mm-yyyy)', key: 'date', width: 20 },
                { header: 'Customer ID', key: 'userId', width: 20 },
                { header: 'Total Amount (₹)', key: 'totalAmount', width: 20 },
            ];

            orders.forEach((order, index) => {
                worksheet.addRow({
                    sl_no: index + 1,
                    orderId: order._id,
                    date: new Date(order.createdAt).toLocaleDateString('en-GB'),
                    userId: order.userId,
                    totalAmount: order.orderAmount,
                });
            });

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true };
            });

            const filePath = path.join(reportsDir, 'salesReport.xlsx');
            await workbook.xlsx.writeFile(filePath);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="SalesReport.xlsx"');
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error('Error downloading Excel:', err);
                    return res.status(500).send('Error downloading file');
                }

                res.render('admin/salesReport');
            });
        } else {
            return res.status(400).send('Invalid format');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).send('Internal Server Error');
    }
};

const loadCoupons = async (req, res) => {
    // Loads a paginated list of coupons for display in the admin panel
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments();
        const coupons = await Coupon.find({}).skip(skip).limit(limit);

        const totalPages = Math.ceil(totalCoupons / limit);

        res.render('admin/listCoupons', {
            coupons,
            page,
            totalPages,
            limit,
            previousPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
            hideHeader: true,
            hideFooter: true
        });
    } catch (error) {
        console.error("Error loading coupons:", error);
        res.status(500).send("An error occurred while loading coupons.");
    }
};

const removeCoupon = async (req, res) => {
    // Removes a coupon by ID and updates the coupon list with pagination
    try {
        const id = req.params.id;

        await Coupon.deleteOne({ _id: id });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments();
        const coupons = await Coupon.find({}).skip(skip).limit(limit);

        const totalPages = Math.ceil(totalCoupons / limit);

        res.render('admin/listCoupons', {
            coupons,
            page,
            totalPages,
            limit,
            previousPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
            message: "Coupon removed successfully",
        });

    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(500).send("An error occurred while removing the coupon.");
    }
};

module.exports = {
    loadLogin, loginAdmin, loadDashboard, blockUser, unblockUser, loadProducts, loadAddProducts, addProduct,
    unlistProduct, listProduct, loadEditProduct, editProduct, logoutAdmin, loadAddCategory, loadCategory, addCategory,
    loadCategoryManagement, postProductToCategory, deleteCategory, listOrders, deliveryMark, notdeliveredMark, adminCancel, loadAddCoupon,
    postCoupon, loadReturns, markReturn, loadEditCategory, postDiscount, loadSales, downloadReport, loadCoupons, removeCoupon
}
