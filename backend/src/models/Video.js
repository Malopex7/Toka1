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
  repostsCount: {
    type: Number,
    default: 0
  },
  repostedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
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
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  taggedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'declined'],
      default: 'active'
    },
    taggedAt: {
      type: Date,
      default: Date.now
    }
  }],
  coAuthors: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'removed'],
      default: 'pending'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date
    },
    splitPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    }
  }]
}, {
  timestamps: true
});

// Indexes for high performance queries and feed pagination sorting
videoSchema.index({ createdAt: -1 });
videoSchema.index({ visibility: 1, creatorId: 1, vettingStatus: 1, createdAt: -1 });

const Video = mongoose.model('Video', videoSchema);
export default Video;
