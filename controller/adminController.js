const { message } = require('prompt')
const User = require('../model/userModel')
const bcrypt = require('bcryptjs');
const saltRounds = 10
const Product = require('../model/productModel')
const Category = require('../model/categoryModel')
const Order = require('../model/orderModel')
const Coupon = require('../model/couponModel');
const { log } = require('handlebars');
const Wallet = require('../model/walletModel');
const PDFDocument = require('pdfkit'); // For PDF generation
const excelJS = require('exceljs'); // For Excel generation
const path = require('path');
const fs = require('fs')

const loadLogin = (req, res) => {
    res.render('admin/login', {hideHeader: true, hideFooter:true})
}

const loginAdmin = async (req, res) => {
    let { email, password } = req.body

    let admin = await User.findOne({ email })


    if (!admin) {
        res.render('admin/login', { message: "Invalid Credentials", hideHeader: true, hideFooter:true })
        return false
    }
    if (!admin.isAdmin) {
        res.render('admin/login', { message: "You are not an admin", hideHeader: true, hideFooter:true })
        return false
    }

    const isMatch = await bcrypt.compareSync(password, admin.password)

    if (!isMatch) {
        res.render('admin/login', { message: "Password is incorrect", hideHeader: true, hideFooter:true })
    } else {
        req.session.admin = true
        req.session.AdminEmail = email
        res.redirect('/admin/dashboard' )
        res.end()
    }

}

const loadDashboard = async (req, res) => {
    let users = await User.find({ isAdmin: false })
    res.render('admin/dashboard', { users, email: req.session.AdminEmail, hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })

}

const blockUser = async (req, res) => {

    let userID = req.params.id
    let user = await User.findOne({ userId: userID })
    if (user) {

        if (!user.isBlocked) {
            await User.updateOne({ userId: userID }, { $set: { isBlocked: true } })
        }
        let users = await User.find({ isAdmin: false })
        res.render('admin/dashboard', { users, message: "User successfully blocked", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
    }
}

const unblockUser = async (req, res) => {

    let userID = req.params.id
    let user = await User.findOne({ userId: userID })
    if (user) {

        if (user.isBlocked) {
            await User.updateOne({ userId: userID }, { $set: { isBlocked: false } })
        }
        let users = await User.find({ isAdmin: false })
        res.render('admin/dashboard', { users, message: "User successfully unblocked", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
    }
}


const loadProducts = async (req, res) => {
    // Default values for pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;

    // Calculate the number of products to skip (for pagination)
    const skip = (page - 1) * limit;

    try {
        // Get the total count of products
        const totalProducts = await Product.countDocuments();

        // Fetch paginated products
        const products = await Product.find()
            .skip(skip)
            .limit(limit);

        // Calculate total number of pages
        const totalPages = Math.ceil(totalProducts / limit);

        // Send the response with pagination details
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

const loadAddProducts = async (req, res) => {
    res.render('admin/addProduct', {hideHeader: true, hideFooter:true})
}

const addProduct = async (req, res) => {
    try {
        // Destructure fields from the request body
        let { name, description, price, brand, size, stock, discount, category } = req.body;
        let products = await Product.find();

        // Check if the product already exists
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
            // Handle image files if provided
            const images = req.files ? req.files.map(file => file.filename) : [];

            // Create a new product if it doesn't exist
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

            // Save the new product to the database
            await newProduct.save();

            // After saving, find the newly created product
            let product = await Product.findOne({ name: NAME, size });

            // Update the product's 'inCategory' field
            await Product.updateOne({ productId: product.productId }, { $set: { inCategory: true } });

            // Update the category with the new product
            await Category.updateOne(
                { category },
                { $addToSet: { products: product.productId } } // Ensure the productId is correctly referenced
            );

            res.redirect('/admin/products'); // Redirect after adding the product
        }
    } catch (error) {
        console.error(error);
        res.render('admin/addProduct', { 
            message: 'Error adding product', 
            hideHeader: true, 
            hideFooter: true 
        });
    }
};



const unlistProduct = async (req, res) => {


    let proID = req.params.id
    let product = await Product.findOne({ productId: proID })
    if (product) {
        console.log(product.isListed);

        if (product.isListed) {
            await Product.updateOne({ productId: proID }, { $set: { isListed: false } })
        }
    }
    let products = await Product.find()
    res.render('admin/listProducts', { products, message: "Product removed from listing", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
}

const listProduct = async (req, res) => {
    let proID = req.params.id
    let product = await Product.findOne({ productId: proID })
    if (product) {
        if (!product.isListed) {
            await Product.updateOne({ productId: proID }, { $set: { isListed: true } })
        }
    }
    let products = await Product.find()
    res.render('admin/listProducts', { products, message: "Product added to listing", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
}

const loadEditProduct = async (req, res) => {
    let proID = req.params.id
    let product = await Product.findOne({ productId: proID })
    res.render('admin/editProduct', { product, hideHeader: true, hideFooter:true})
}

const editProduct = async (req, res) => {
    try {
        const proID = req.params.id;

        // Destructure fields from the request body
        const { name, description, price, brand, size, stock, discount, category } = req.body;
        const images = req.files ? req.files.map(file => file.filename) : [];

        // Find the product by ID
        let existingProduct = await Product.findOne({ productId: proID });

        if (!existingProduct) {
            return res.status(404).send("Product not found");
        }

        // Check if any fields have changed (excluding images for now)
        const changesMade = 
            existingProduct.name !== name ||
            existingProduct.description !== description ||
            existingProduct.price !== price ||
            existingProduct.brand !== brand ||
            existingProduct.size !== size ||
            existingProduct.stock !== stock ||
            existingProduct.discount !== discount ||
            existingProduct.category !== category;

        // If changes are detected, update the product
        if (changesMade) {
            // Handle category change logic
            if (existingProduct.category !== category) {
                // Remove the product from the old category
                await Category.updateOne(
                    { category: existingProduct.category },
                    { $pull: { products: existingProduct.productId } }
                );

                // Add the product to the new category
                await Category.updateOne(
                    { category },
                    { $addToSet: { products: existingProduct.productId } }
                );
            }

            // Update the product details
            await Product.updateOne(
                { productId: proID },
                {
                    $set: { name, description, price, brand, size, stock, discount, category },
                }
            );

            // Push new images if provided
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



const logoutAdmin = async (req, res) => {
    req.session.destroy();
    res.render('admin/login', { message: "Logged out successfully", hideHeader: true , hideFooter:true})
}

const loadCategory = async (req, res) => {
    let categories = await Category.find()
    console.log(categories);
    res.render('admin/listCategory', { categories, hideHeader: true , hideFooter:true, currentRoute: req.originalUrl})
}

const loadAddCategory = async (req, res) => {

    res.render('admin/addCategory', {hideHeader: true, hideFooter:true})
}

const addCategory = async (req, res) => {


    let { category, image } = req.body;
    let CATEGORY = category.toUpperCase(); // Corrected method name
    let categoryExist = await Category.findOne({ category: CATEGORY });
    const imagePath = req.file ? req.file.filename : null;

    if (categoryExist) {
        res.render('admin/addCategory', { message: "Category already Exist", hideHeader: true, hideFooter:true })
        return
    }

    let newCategory = new Category({
        category: CATEGORY,
        image: imagePath
    })

    await newCategory.save()
    let categories = await Category.find()
    res.render('admin/listCategory', { categories, hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
}

const loadCategoryManagement = async (req, res) => {
    let categoryId = req.params.id
    let products = await Product.find()
    let categoryName = await Category.find({ categoryId }, { category: 1, _id: 0 })
    let category = categoryName[0].category

    res.render('admin/addProductToCategory', { categoryId, products, category, hideHeader: true, hideFooter:true })
}

const postProductToCategory = async (req, res) => {
    let { categoryId, productId } = req.query;
    let products = await Product.find()
    let product = await Product.findOne({ productId })
    try {
        // Check if the productId already exists in the products array
        
        if (product.inCategory) {
            return res.render('admin/addProductToCategory', { message: "Product already in another category", products, hideHeader: true, hideFooter:true })
        } else {
            await Product.updateOne({productId}, {$set: {inCategory: true}})
            await Category.updateOne(
                { categoryId },
                { $addToSet: { products: productId } }
            );
            let categories = await Category.find()
            // Redirect to the list category page
            res.render('admin/listCategory', { categories, hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
        }
        // Use $addToSet to ensure the productId is only added if it doesn't already exist

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}

const deleteCategory = async (req, res) => {
    let categoryId = req.params.id
    await Category.deleteOne({ categoryId })
    let categories = await Category.find()
    // Redirect to the list category page
    res.render('admin/listCategory', { categories, message: "Category deleted Successfully", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
}

const listOrders = async (req, res) => {
    // Default values for pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;

    // Calculate the number of orders to skip (for pagination)
    const skip = (page - 1) * limit;

    try {
        // Get the total count of orders
        const totalOrders = await Order.countDocuments();

        // Fetch paginated orders
        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Calculate total number of pages
        const totalPages = Math.ceil(totalOrders / limit);

        // Send the response with pagination details
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


const deliveryMark = async(req, res)=>{
    let orderId = req.params.id

    await Order.updateOne({orderId}, {$set:{deliveryStatus: "Delivered"}})
    let orders = await Order.find({}).sort({createdAt:-1})
    res.render('admin/listOrders', {orders, message:"Order Status updated!", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl})
}

const notdeliveredMark = async(req, res)=>{
    let orderId = req.params.id

    await Order.updateOne({orderId}, {$set:{deliveryStatus: "In Transit"}})
    let orders = await Order.find({}).sort({createdAt:-1})
    res.render('admin/listOrders', {orders, message:"Order Status updated!", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl})
}

const adminCancel = async(req, res)=>{
    let orderId = req.params.id
    

    
    let currOrders = await Order.findOne({orderId})
    
    currOrders.products.forEach(async (product)=>{
        let currentProduct = await Product.findOne({name: product.productName, size: product.size})
        let newStock = currentProduct.stock + product.quantity
        
        
        await Product.updateOne({name: product.productName, size: product.size}, {$set: {stock: newStock}})
    })
    await Order.updateOne({orderId}, {$set: {deliveryStatus:"Order Cancelled"}})

    let orders = await Order.find({})
    res.render('admin/listOrders', { orders, message:"Order is cancelled", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl})
}

const loadAddCoupon = async(req, res)=>{
    res.render('admin/addCoupon', {hideHeader: true, hideFooter:true})
}


const postCoupon = async (req, res) => {
    try {
        let { coupon, discount, availableAfter, percentage } = req.body;

        // Create the new coupon object with percentage included
        const newCoupon = new Coupon({
            couponName: coupon,
            discountAmount: discount,
            availableAfter,
            discountPercentage: percentage || 0,  // Add percentage if provided, else default to 0
        });

        // Save the new coupon to the database
        await newCoupon.save();

        // Return success message
        res.render('admin/addCoupon', { 
            hideHeader: true, 
            hideFooter: true, 
            message: "Coupon added successfully" 
        });
    } catch (error) {
        console.error(error);
        res.render('admin/addCoupon', { 
            hideHeader: true, 
            hideFooter: true, 
            message: "An error occurred while adding the coupon. Please try again." 
        });
    }
};


const loadReturns = async(req, res)=>{
    let returns = await Order.aggregate([
        { $unwind: "$products" }, // Unwind the `products` array
        { $match: { "products.returnStatus": true } }, // Filter where returnStatus is true
        { $project: { 
            _id: 1, 
            userId: 1, 
            orderId: 1,

            "products.productName": 1, 
            "products.price": 1, 
            "products.quantity": 1, 
            "products.returnStatus": 1,
            "products.adminApproved": 1,
            "products._id":1,
            "products.returnReason": 1,
            createdAt: 1
        }} // Project only required fields
    ]);
    
    
    res.render('admin/listReturns', {returns, hideHeader: true, hideFooter:true})
}

const markReturn = async (req, res) => {
    let id = req.query.id;
    let user = await Order.findOne({ "products._id": id });
    let price = req.query.price;
    let quantity = req.query.quantity;

    let refund = price * quantity;

    // Update the order status with admin approval
    await Order.updateOne(
        { "products._id": id }, // Match the Order with the specific product _id
        { $set: { "products.$.adminApproved": true } } // Use the positional operator to update the field within the array
    );

    // Check if the user already has a wallet
    let wallet = await Wallet.findOne({ userId: user.userId });

    // If wallet doesn't exist, create a new wallet for the user
    if (!wallet) {
        wallet = new Wallet({
            userId: user.userId,
            amountAvailable: 0, // Set the initial wallet balance to 0
        });
        await wallet.save(); // Save the newly created wallet
    }

    // Update the wallet with the refund amount
    await Wallet.updateOne(
        { userId: user.userId },
        { $inc: { amountAvailable: refund } }
    );

    res.redirect('/admin/adminReturn');
};


const loadEditCategory = async(req, res)=>{
    let catId = req.params.id
    let category = await Category.findOne({ categoryId: catId })
    res.render('admin/editCategory', { category, hideHeader: true, hideFooter:true })
}

const postDiscount = async(req, res)=>{
    let {discount} = req.body
    let id = req.params.id
    let category = await Category.findOne({categoryId: id})
    category.products.forEach(async (id)=>{
        let existingDiscount = category.categoryDiscount
        let newDiscount = discount - existingDiscount
        await Product.updateOne({productId:id}, {$inc: {discount: newDiscount}})
    })

    await Category.updateOne({categoryId: id}, {$set: {categoryDiscount: discount}})
    let categories = await Category.find({})
    res.render('admin/listCategory', {categories, message:"Discount added!", hideHeader: true, hideFooter:true, currentRoute: req.originalUrl })
}

const loadSales = async (req, res) => {
    let startDate = req.query.startDate;
    let endDate = req.query.endDate;

    let filter = req.query.filter; // Filter for predefined ranges like 1 day, 1 week, 1 month

    if(startDate && endDate){
        filter = null
    }
  
    let currentDate = new Date();
  
    // Check for filter and set date range accordingly
    if (filter) {
      filter = parseInt(filter); // Convert filter to an integer
  
      if (filter === 1) {
        // 1 Day
        startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0); // Start of today
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999); // End of today
      } else if (filter === 7) {
        // 1 Week
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 7); // 7 days ago
        startDate.setHours(0, 0, 0, 0); // Start of 7 days ago
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999); // End of today
      } else if (filter === 30) {
        // 1 Month
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 30); // 30 days ago
        startDate.setHours(0, 0, 0, 0); // Start of 30 days ago
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999); // End of today
      } else {
        return res.status(400).send('Invalid filter value');
      }
    }
  
    // If startDate and endDate are provided in the request, use them
    if (startDate && endDate) {
      try {
        // Fetch orders within the specified range
        const orders = await Order.find({
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          }
        });
  
        let totalSales = 0;
        let totalRevenue = 0;
        let totalOrders = orders.length; // Total number of orders
  
        // Calculate totals
        for (const order of orders) {
            for (const product of order.products) {
              const originalProduct = await Product.findOne({
                name: product.productName,
                size: product.size
              });
              const originalPrice = originalProduct.price || 0;
              totalSales += originalPrice * (product.quantity || 0);
            }
    
            // Calculate total revenue
            totalRevenue += order.orderAmount || 0;
          }
  
        // Calculate total discount
        const totalDiscount = totalSales - totalRevenue;
  
        // Render the sales report page
        return res.render('admin/salesReport', {
          hideHeader: true,
          hideFooter: true,
          totalDiscount,
          totalOrders,
          totalSales,
          totalRevenue,
          orders
        });
      } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).send('Error generating sales report');
      }
    }
  
    // If no startDate and endDate, or filter was not provided, render the page with no data
    res.render('admin/salesReport', {
      hideHeader: true,
      hideFooter: true,
      message: "Enter a date range"
    });
  };

  const downloadReport = async (req, res) => {
    const { format } = req.params;
    const { startDate, endDate } = req.query;

    try {
        // Validate dates
        if (!startDate || !endDate) {
            return res.status(400).send('Start date and end date are required');
        }

        // Fetch sales data from the database
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
          
           // Add Title
           doc.fontSize(10).text('Sales Report', { align: 'center' });
  doc.moveDown(1);

  const headerHeight = 18;

  // Add Table Header with background color
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
  // Draw row border and add data
  orders.forEach((order, index) => {
    const yPosition = doc.y + 3;
    const rowHeight = 18;

    // Draw row border
    doc.rect(50, yPosition, 50, rowHeight).stroke();
    doc.rect(120, yPosition, 150, rowHeight).stroke();
    doc.rect(270, yPosition, 100, rowHeight).stroke();
    doc.rect(380, yPosition, 100, rowHeight).stroke();
    doc.rect(490, yPosition, 100, rowHeight).stroke();

    // Add data to each column
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
          
                // Clean up file after download
                fs.unlink(filePath, (err) => {
                  if (err) console.error('Error cleaning up PDF file:', err);
                });
              });
            });
        }
        
        else if (format === 'excel') {
            // Generate Excel
            const workbook = new excelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Add Header Row
            worksheet.columns = [
                { header: 'Sl. No', key: 'sl_no', width: 10 },
                { header: 'Order ID', key: 'orderId', width: 30 },
                { header: 'Date (dd-mm-yyyy)', key: 'date', width: 20 },
                { header: 'Customer ID', key: 'userId', width: 20 },
                { header: 'Total Amount (₹)', key: 'totalAmount', width: 20 },
            ];

            // Add Data Rows
            orders.forEach((order, index) => {
                worksheet.addRow({
                    sl_no: index + 1,
                    orderId: order._id,
                    date: new Date(order.createdAt).toLocaleDateString('en-GB'),
                    userId: order.userId,
                    totalAmount: order.orderAmount,
                });
            });

            // Adjust Styling
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true };
            });

            const filePath = path.join(reportsDir, 'salesReport.xlsx');
            await workbook.xlsx.writeFile(filePath);

            // Set headers for download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="SalesReport.xlsx"');
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error('Error downloading Excel:', err);
                    return res.status(500).send('Error downloading file');
                }

                // Redirect after download
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
  

module.exports = {
    loadLogin, loginAdmin, loadDashboard, blockUser, unblockUser, loadProducts, loadAddProducts, addProduct,
    unlistProduct, listProduct, loadEditProduct, editProduct, logoutAdmin, loadAddCategory, loadCategory, addCategory,
    loadCategoryManagement, postProductToCategory, deleteCategory, listOrders, deliveryMark, notdeliveredMark, adminCancel, loadAddCoupon,
    postCoupon, loadReturns, markReturn, loadEditCategory, postDiscount, loadSales, downloadReport

}