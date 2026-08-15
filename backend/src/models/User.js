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
        return /^[a-zA-Z0-9_]+$/.test(val);
      },
      message: 'Username can only contain letters, numbers, and underscores (_).'
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
  verificationRequestStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none'
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
  },
  taggingPermission: {
    type: String,
    enum: ['allow_all', 'require_approval', 'disabled'],
    default: 'allow_all'
  },
  avatarUrl: {
    type: String,
    default: ''
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
