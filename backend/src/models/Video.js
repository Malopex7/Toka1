import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Video must belong to a creator']
  },
  videoUrl: {
    type: String,
    required: [true, 'Video must have a URL']
  },
  title: {
    type: String,
    required: [true, 'Video must have a title'],
    trim: true
  },
  tier: {
    type: String,
    enum: ['fan_funded', 'brand_safe'],
    default: 'fan_funded'
  },
  vettingStatus: {
    type: String,
    enum: ['processing', 'ai_review', 'human_review', 'approved', 'rejected'],
    default: 'processing'
  },
  aiConfidenceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  riskFlags: {
    type: [String],
    default: []
  },
  transcript: {
    type: String,
    default: ''
  },
  aiPipelineStatus: {
    type: String,
    enum: ['pending', 'running', 'complete', 'failed'],
    default: 'pending'
  },
  likesCount: {
    type: Number,
    default: 0
  },
  likedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },
  sharesCount: {
    type: Number,
    default: 0
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  sponsorshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SponsorshipRequest'
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const Video = mongoose.model('Video', videoSchema);
export default Video;
