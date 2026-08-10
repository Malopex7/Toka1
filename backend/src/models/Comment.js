import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: [true, 'Comment must belong to a video'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Comment must belong to a user']
  },
  text: {
    type: String,
    required: [true, 'Comment content cannot be empty'],
    trim: true,
    maxLength: [500, 'Comment cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
