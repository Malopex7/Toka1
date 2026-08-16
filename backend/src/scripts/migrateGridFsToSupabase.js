import 'dotenv/config';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import Video from '../models/Video.js';
import { supabase, ensureVideosBucket } from '../config/supabase.js';

async function migrateGridFsToSupabase() {
  console.log('[Migration] Starting GridFS to Supabase Storage migration...');

  try {
    // 1) Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Migration] MongoDB connected.');

    // 2) Ensure Supabase bucket exists
    await ensureVideosBucket();

    // 3) Find all videos stored in GridFS
    const videos = await Video.find({
      videoUrl: { $regex: /\/api\/videos\/stream\// }
    });

    console.log(`[Migration] Found ${videos.length} videos stored in MongoDB GridFS.`);

    if (videos.length === 0) {
      console.log('[Migration] No GridFS videos to migrate. Exiting.');
      process.exit(0);
    }

    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'media' });

    let successCount = 0;
    let failCount = 0;

    for (const video of videos) {
      try {
        const parts = video.videoUrl.split('/api/videos/stream/');
        const filename = parts[parts.length - 1];

        if (!filename) {
          console.warn(`[Migration] Skipping video ${video._id} - invalid filename in URL: ${video.videoUrl}`);
          continue;
        }

        console.log(`[Migration] Fetching "${filename}" from GridFS...`);
        const files = await bucket.find({ filename }).toArray();
        if (!files || files.length === 0) {
          console.warn(`[Migration] File "${filename}" not found in GridFS media bucket.`);
          failCount++;
          continue;
        }

        const fileRecord = files[0];
        const contentType = fileRecord.contentType || 'video/mp4';

        // Read stream into buffer
        const downloadStream = bucket.openDownloadStreamByName(filename);
        const chunks = [];

        await new Promise((resolve, reject) => {
          downloadStream.on('data', (chunk) => chunks.push(chunk));
          downloadStream.on('error', reject);
          downloadStream.on('end', resolve);
        });

        const fileBuffer = Buffer.concat(chunks);
        console.log(`[Migration] Read ${fileBuffer.length} bytes for "${filename}". Uploading to Supabase...`);

        // Upload buffer to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(filename, fileBuffer, {
            contentType,
            upsert: true
          });

        if (uploadError) {
          console.error(`[Migration] Supabase upload failed for "${filename}":`, uploadError.message);
          failCount++;
          continue;
        }

        // Get public CDN URL
        const { data: { publicUrl } } = supabase.storage
          .from('videos')
          .getPublicUrl(filename);

        // Update MongoDB document
        video.videoUrl = publicUrl;
        await video.save();

        console.log(`[Migration] ✅ Video ${video._id} migrated successfully to: ${publicUrl}`);
        successCount++;
      } catch (videoErr) {
        console.error(`[Migration] ❌ Failed to migrate video ${video._id}:`, videoErr.message);
        failCount++;
      }
    }

    console.log(`\n========================================`);
    console.log(`[Migration Summary]`);
    console.log(`Total Videos Checked: ${videos.length}`);
    console.log(`Successfully Migrated: ${successCount}`);
    console.log(`Failed / Skipped:     ${failCount}`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('[Migration Fatal Error]:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Finished. Database disconnected.');
    process.exit(0);
  }
}

migrateGridFsToSupabase();
