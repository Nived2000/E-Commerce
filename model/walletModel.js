const mongoose = require('mongoose');
const User = require('./userModel');  // Make sure to import the Product model

const walletSchema = new mongoose.Schema({
    walletId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User
    amountAvailable: { type: Number, default: 0 }
});

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
