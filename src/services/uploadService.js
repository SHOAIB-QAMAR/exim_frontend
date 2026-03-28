import { createClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

/**
 * Supabase Upload Service
 * 
 * Handles client-side image validation, compression, and direct secure upload 
 * to Supabase Storage buckets.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

// Initialize the Supabase Client singleton
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET_NAME || 'chat-images';

/**
 * Validates a file to ensure it's a supported image type and under the size limit.
 * 
 * @param {File} file - The file object to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export const validateImage = (file) => {
    if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file (JPG, PNG, WebP).');
    }
    
    // Check original file size (limit to 10MB before compression for performance)
    const MAX_ORIGINAL_SIZE_MB = 10;
    if (file.size > MAX_ORIGINAL_SIZE_MB * 1024 * 1024) {
        throw new Error(`The image is too large. Please select a file under ${MAX_ORIGINAL_SIZE_MB}MB.`);
    }

    return true;
};

/**
 * Compresses an image file for efficient network transmission.
 * 
 * @param {File} file - The original image file
 * @returns {Promise<File|Blob>} The compressed file
 */
export const compressImage = async (file) => {
    try {
        const options = {
            maxSizeMB: 1,           // Targeted output size limit
            maxWidthOrHeight: 1920, // Downscale large images
            useWebWorker: true,      // Offload processing from main thread
        };
        
        return await imageCompression(file, options);
    } catch (error) {
        if (import.meta.env.DEV) console.error('[UploadService] Compression Error:', error);
        throw new Error('Failed to compress the image for upload.');
    }
};

/**
 * Uploads a file directly to Supabase Storage and retrieves its public access URL.
 * 
 * @param {File|Blob} file - The file to upload
 * @returns {Promise<string>} The public URL of the uploaded asset
 * @throws {Error} On network or authentication errors
 */
export const uploadImageToSupabase = async (file) => {
    try {
        // Sanitize filename and prepend timestamp for uniqueness
        const timestamp = Date.now();
        const cleanFileName = (file.name || 'blob').replace(/[^a-zA-Z0-9.]/g, '_');
        const uniquePath = `uploads/${timestamp}_${cleanFileName}`;

        const startTime = performance.now();

        // Perform the upload
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uniquePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            });

        if (uploadError) {
            throw new Error(uploadError.message);
        }

        // Environment-aware performance metrics
        if (import.meta.env.DEV) {
            const latency = performance.now() - startTime;
            console.groupCollapsed(`📊 [Metrics] Supabase Upload: ${Math.round(latency)}ms`);
            console.log(`Duration: ${latency.toFixed(2)}ms`);
            console.log(`Size: ${(file.size / 1024).toFixed(2)} KB`);
            console.groupEnd();
        }

        // Retrieve and return the public URL
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uniquePath);

        return publicUrlData.publicUrl;
        
    } catch (error) {
        if (import.meta.env.DEV) console.error('[UploadService] Upload Task Failed:', error);
        throw new Error(`Image upload failed: ${error.message}`);
    }
};
