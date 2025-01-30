const mongoose = require('mongoose');
const User = require('./userModel')

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User
    transactions: [
        {
            amount: { type: Number, required: true },
            type: { type: String, required: true, enum: ['credit', 'debit'] }, // Enforce valid types
            createdAt: { type: Date, default: Date.now }, // Timestamp
        }
    ]
});


const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
