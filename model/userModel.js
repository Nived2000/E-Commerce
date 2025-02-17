const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  line1: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  zipCode: { type: String, required: true },
});

const userSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, auto: true },
    name: { type: String, required: false, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    address: [addressSchema],
    phone: { type: String, trim: true },
    isAdmin: { type: Boolean, default: false }, // Replaced role with isAdmin
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    isBlocked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    referralCode: {type: String,  unique:true}
  },
  { timestamps: true }
);


userSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();

  if (!this.referralCode) {
    let code;
    let isUnique = false;

    while (!isUnique) {
      code = Math.random().toString(36).substring(2, 10).toUpperCase(); // Random 8-character code
      const existingUser = await mongoose.model('User').findOne({ referralCode: code });
      if (!existingUser) {
        isUnique = true;
      }
    }

    this.referralCode = code;
  }

  next();
});


const User = mongoose.model('User', userSchema);

module.exports = User;
