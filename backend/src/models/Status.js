import mongoose from 'mongoose';

const stickerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['slang', 'cultural', 'badge', 'qa', 'poll', 'emoji'],
    default: 'slang'
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  subtext: {
    type: String,
    trim: true,
    maxlength: 60
  },
  variant: {
    type: String,
    default: 'flare' // flare, mint, sunset, gold, dark
  },
  posX: {
    type: Number,
    default: 50 // Percentage 0-100
  },
  posY: {
    type: Number,
    default: 50 // Percentage 0-100
  },
  scale: {
    type: Number,
    default: 1
  },
  rotation: {
    type: Number,
    default: 0
  }
}, { _id: false });

const audioSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: String,
    required: true,
    trim: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  previewStart: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 15
  }
}, { _id: false });

const viewerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const reactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emoji: {
    type: String,
    required: true,
    trim: true
  },
  reactedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const replySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const statusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Status must belong to a user'],
    index: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true,
    default: 'text'
  },
  textContent: {
    type: String,
    trim: true,
    maxlength: [400, 'Text content cannot exceed 400 characters']
  },
  textStyle: {
    backgroundGradient: {
      type: String,
      default: 'from-orange-600 via-amber-600 to-rose-700'
    },
    fontFamily: {
      type: String,
      default: 'sans' // sans, serif, mono, display
    },
    textColor: {
      type: String,
      default: '#FAFAFA'
    },
    alignment: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'center'
    }
  },
  mediaUrl: {
    type: String,
    trim: true
  },
  mediaType: {
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    default: 5, // 5s for text/images, up to 30s for video
    min: 3,
    max: 30
  },
  stickers: {
    type: [stickerSchema],
    default: []
  },
  audio: {
    type: audioSchema,
    default: null
  },
  caption: {
    type: String,
    trim: true,
    maxlength: [200, 'Caption cannot exceed 200 characters']
  },
  viewers: {
    type: [viewerSchema],
    default: []
  },
  reactions: {
    type: [reactionSchema],
    default: []
  },
  replies: {
    type: [replySchema],
    default: []
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual count helpers
statusSchema.virtual('viewsCount').get(function() {
  return this.viewers ? this.viewers.length : 0;
});

statusSchema.virtual('reactionsCount').get(function() {
  return this.reactions ? this.reactions.length : 0;
});

statusSchema.virtual('repliesCount').get(function() {
  return this.replies ? this.replies.length : 0;
});

const Status = mongoose.model('Status', statusSchema);
export default Status;
