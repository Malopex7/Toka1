import mongoose from 'mongoose';

const liveStreamSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'LiveStream must have a host'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'LiveStream must have a title'],
    trim: true,
    maxLength: [120, 'Title cannot exceed 120 characters']
  },
  status: {
    type: String,
    enum: ['live', 'ended'],
    default: 'live',
    index: true
  },
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  privateMode: {
    type: String,
    enum: ['entry_fee', 'subscription', 'tip_invite', null],
    default: null
  },
  entryFeeZAR: {
    type: Number,
    default: 0,
    min: [0, 'Entry fee cannot be negative']
  },
  subscriberPriceZAR: {
    type: Number,
    default: 0,
    min: [0, 'Subscriber price cannot be negative']
  },
  tipInviteMinZAR: {
    type: Number,
    default: 0,
    min: [0, 'Tip invite minimum cannot be negative']
  },
  participants: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  cohosts: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  invitedCohosts: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  unlockedViewers: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  viewerCount: {
    type: Number,
    default: 0,
    min: 0
  },
  livekitRoomName: {
    type: String,
    required: true,
    unique: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index for active stream feed queries
liveStreamSchema.index({ status: 1, startedAt: -1 });

const LiveStream = mongoose.model('LiveStream', liveStreamSchema);
export default LiveStream;
