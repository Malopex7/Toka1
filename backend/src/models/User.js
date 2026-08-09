import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: [true, 'Please provide a Firebase UID'],
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email address'],
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
    minLength: [3, 'Username must be at least 3 characters long'],
    validate: {
      validator: function(val) {
        return !val.includes('@');
      },
      message: 'Username cannot contain the "@" symbol.'
    }
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
  },
  fcmTokens: {
    type: [String],
    default: []
  },
  following: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  followers: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals for checking roles
userSchema.virtual('isBrand').get(function() {
  return this.role === 'brand';
});

userSchema.virtual('isModerator').get(function() {
  return this.role === 'moderator';
});

userSchema.virtual('isCreator').get(function() {
  return this.role === 'creator';
});

userSchema.virtual('isFan').get(function() {
  return this.role === 'fan';
});

const User = mongoose.model('User', userSchema);
export default User;
