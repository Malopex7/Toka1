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
    required: [true, 'Transaction must have a receiver']
  },
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    // Required only for tips, optional for brand_sponsorship
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
    enum: ['tip', 'brand_sponsorship'],
    required: [true, 'Transaction must have a type']
  }
}, {
  timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
