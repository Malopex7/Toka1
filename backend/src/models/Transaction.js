import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Transaction must have a sender']
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type !== 'deposit';
    }
  },
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    // Required only for video tips; optional for live tips, sponsorships, deposits, entries
    required: function() {
      return this.type === 'tip';
    }
  },
  amount: {
    type: Number,
    required: [true, 'Transaction must have an amount'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'ZAR'
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['tip', 'brand_sponsorship', 'deposit', 'live_tip', 'live_entry'],
    required: [true, 'Transaction must have a type']
  },
  liveStreamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveStream',
    default: null
  },
  reference: {
    type: String,
    unique: true,
    sparse: true
  },
  splitDetails: {
    isSplit: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ['primary_author', 'co_author']
    },
    splitRatio: {
      type: String
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
