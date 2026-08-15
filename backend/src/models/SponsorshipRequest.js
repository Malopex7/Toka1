import mongoose from 'mongoose';

const sponsorshipRequestSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: [true, 'Sponsorship must belong to a video'],
    index: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sponsorship must have a requesting creator'],
    index: true
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sponsorship must target a brand'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Sponsorship must have a requested amount (ZAR)'],
    min: [0, 'Amount cannot be negative']
  },
  terms: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn', 'disputed', 'completed'],
    default: 'pending',
    index: true
  },
  escrowStatus: {
    type: String,
    enum: ['none', 'held', 'released', 'refunded', 'locked'],
    default: 'none',
    index: true
  },
  escrowReleaseAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const SponsorshipRequest = mongoose.model('SponsorshipRequest', sponsorshipRequestSchema);
export default SponsorshipRequest;
