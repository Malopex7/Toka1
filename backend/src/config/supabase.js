import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase Config] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Supabase Storage may not function properly.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Ensures the public 'videos' bucket exists in Supabase Storage.
 */
export const ensureVideosBucket = async () => {
  if (!supabaseUrl || !supabaseServiceKey) return;

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('[Supabase Storage] Failed to list buckets:', listError.message);
      return;
    }

    const videosBucket = buckets?.find((b) => b.name === 'videos' || b.id === 'videos');
    if (!videosBucket) {
      console.log('[Supabase Storage] "videos" bucket not found. Creating public "videos" bucket...');
      const { error: createError } = await supabase.storage.createBucket('videos', {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024 // 50MB max video upload (Free Tier limit)
      });

      if (createError) {
        console.error('[Supabase Storage] Error creating "videos" bucket:', createError.message);
      } else {
        console.log('[Supabase Storage] Successfully created public "videos" bucket.');
      }
    } else {
      console.log('[Supabase Storage] Public "videos" bucket verified and ready.');
    }
  } catch (err) {
    console.error('[Supabase Storage] Initialization check failed:', err);
  }
};

export default supabase;
