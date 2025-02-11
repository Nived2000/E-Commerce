const express = require('express');
const router = express.Router();
const adminController = require('../controller/adminController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Admin Login Routes
router.get('/login', auth.isLoginAdmin, adminController.loadLogin);
router.post('/login', adminController.loginAdmin);

// Admin Dashboard
router.get('/dashboard', auth.checkSessionAdmin, adminController.loadDashboard);

// User Management
router.get('/blockUser/:id', auth.checkSessionAdmin, adminController.blockUser);
router.get('/unblockUser/:id', auth.checkSessionAdmin, adminController.unblockUser);

// Product Management
router.get('/products', auth.checkSessionAdmin, adminController.loadProducts);
router.get('/addProducts', auth.checkSessionAdmin, adminController.loadAddProducts);
router.post('/addProducts', auth.checkSessionAdmin, upload.upload, adminController.addProduct);
router.get('/unlistProduct/:id', auth.checkSessionAdmin, adminController.unlistProduct);
router.get('/listProduct/:id', auth.checkSessionAdmin, adminController.listProduct);
router.get('/editProduct/:id', auth.checkSessionAdmin, adminController.loadEditProduct);
router.post('/editProduct/:id', auth.checkSessionAdmin, upload.upload, adminController.editProduct);

// Admin Logout
router.get('/logout', auth.checkSessionAdmin, adminController.logoutAdmin);

// Category Management
router.get('/category', auth.checkSessionAdmin, adminController.loadCategory);
router.get('/addCategory', auth.checkSessionAdmin, adminController.loadAddCategory);
router.post('/addCategory', auth.checkSessionAdmin, upload.uploadSingle, adminController.addCategory);
router.get('/addProductToCategory/:id', auth.checkSessionAdmin, adminController.loadCategoryManagement);
router.get('/addCategoryDicount/:id', auth.checkSessionAdmin, adminController.loadEditCategory)
router.get('/postProductToCategory', auth.checkSessionAdmin, adminController.postProductToCategory);
router.get('/deleteCategory/:id', auth.checkSessionAdmin, adminController.deleteCategory);
router.post('/postDiscount/:id', auth.checkSessionAdmin, adminController.postDiscount )

// Order Management
router.get('/order', auth.checkSessionAdmin, adminController.listOrders);
router.get('/mark-as-delivered/:id', auth.checkSessionAdmin, adminController.deliveryMark);
router.get('/mark-as-not-delivered/:id', auth.checkSessionAdmin, adminController.notdeliveredMark);
router.get('/admin-order-cancel/:id', adminController.adminCancel)

router.get('/addCoupon', auth.checkSessionAdmin,adminController.loadAddCoupon)
router.post('/addCoupon', adminController.postCoupon)
router.get('/adminReturn', auth.checkSessionAdmin,adminController.loadReturns)
router.get('/return-confirm', auth.checkSessionAdmin,adminController.markReturn)
router.get('/salesReport', auth.checkSessionAdmin, adminController.loadSales)
router.get('/downloadReport/:format', adminController.downloadReport);
router.get('/loadCoupons', auth.checkSessionAdmin, adminController.loadCoupons)
router.get('/remove-coupon/:id', auth.checkSessionAdmin, adminController.removeCoupon)

router.get('/banner', auth.checkSessionAdmin, adminController.loadAddBanner)
router.post('/addBanner', auth.checkSessionAdmin, upload.uploadSingle, adminController.addBanner)

module.exports = router;
