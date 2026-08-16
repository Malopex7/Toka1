import mongoose from 'mongoose';

const statusHighlightSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Highlight must belong to a user'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a title for the highlight'],
    trim: true,
    maxlength: [30, 'Highlight title cannot exceed 30 characters']
  },
  coverUrl: {
    type: String,
    trim: true,
    default: ''
  },
  coverType: {
    type: String,
    enum: ['image', 'gradient', 'video'],
    default: 'gradient'
  },
  coverGradient: {
    type: String,
    default: 'from-toka-flare to-amber-600'
  },
  statuses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Status'
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const StatusHighlight = mongoose.model('StatusHighlight', statusHighlightSchema);
export default StatusHighlight;
