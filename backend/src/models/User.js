import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
    minLength: [3, 'Username must be at least 3 characters long']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    select: false
  },
  walletBalance: {
    type: Number,
    required: true,
    default: 0
  },
  role: {
    type: String,
    enum: ['creator', 'brand', 'moderator', 'fan'],
    default: 'fan'
  },
  isBrandSafeVerified: {
    type: Boolean,
    default: false
  },
  strikeCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  // Salt work factor of exactly 10
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare candidate password with database password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
export default User;
