import { createClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

/**
 * ⚠️ SECURITY WARNING ⚠️
 * Putting Supabase Anon Keys directly in frontend code is generally safe ONLY IF
 * you have proper Row Level Security (RLS) policies set up on your storage buckets!
 * Make sure the bucket only allows authorized uploads.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

// Initialize the Supabase Client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET_NAME || 'chat-images';

/**
 * Validates the file to ensure it is an image and within reasonable limits
 * before attempting compression.
 */
export const validateImage = (file) => {
    // Check file type
    if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file.');
    }
    
    // Check original file size (e.g., limit to 10MB before compression)
    const MAX_ORIGINAL_SIZE_MB = 10;
    if (file.size > MAX_ORIGINAL_SIZE_MB * 1024 * 1024) {
        throw new Error(`File is too large. Please select an image under ${MAX_ORIGINAL_SIZE_MB}MB.`);
    }

    return true;
};

/**
 * Compresses an image using browser-image-compression.
 */
export const compressImage = async (file) => {
    try {
        const options = {
            maxSizeMB: 1, // Compress to max 1MB
            maxWidthOrHeight: 1920, // Max width or height
            useWebWorker: true, // Use multi-threading for faster compression
        };
        
        const compressedFile = await imageCompression(file, options);
        
        return compressedFile;
    } catch {
        throw new Error('Failed to compress image.');
    }
};

/**
 * Uploads a compressed image directly to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export const uploadImageToSupabase = async (file) => {
    try {
        // Generate a unique filename
        const timestamp = Date.now();
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueFileName = `uploads/${timestamp}_${cleanFileName}`;

        // Upload to Supabase Storage
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uniqueFileName, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            });

        if (error) {
            throw new Error(`Supabase Storage Error: ${error.message}`);
        }

        // Retrieve the public URL
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uniqueFileName);

        const publicUrl = publicUrlData.publicUrl;
        
        return publicUrl;
        
    } catch (error) {
        throw new Error(`Failed to upload image. ${error.message}`);
    }
};
