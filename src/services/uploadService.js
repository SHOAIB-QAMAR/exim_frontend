// import { createClient } from '@supabase/supabase-js';
// import imageCompression from 'browser-image-compression';

// /**
//  * ⚠️ SECURITY WARNING ⚠️
//  * Putting Supabase Anon Keys directly in frontend code is generally safe ONLY IF
//  * you have proper Row Level Security (RLS) policies set up on your storage buckets!
//  * Make sure the bucket only allows authorized uploads.
//  */

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-project.supabase.co';
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

// // Initialize the Supabase Client
// const supabase = createClient(supabaseUrl, supabaseAnonKey);

// const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET_NAME || 'chat-images';

// /**
//  * Validates the file to ensure it is an image and within reasonable limits
//  * before attempting compression.
//  */
// export const validateImage = (file) => {
//     // Check file type
//     if (!file.type.startsWith('image/')) {
//         throw new Error('Please select a valid image file.');
//     }
    
//     // Check original file size (e.g., limit to 10MB before compression)
//     const MAX_ORIGINAL_SIZE_MB = 10;
//     if (file.size > MAX_ORIGINAL_SIZE_MB * 1024 * 1024) {
//         throw new Error(`File is too large. Please select an image under ${MAX_ORIGINAL_SIZE_MB}MB.`);
//     }

//     return true;
// };

// /**
//  * Compresses an image using browser-image-compression.
//  */
// export const compressImage = async (file) => {
//     try {
//         const options = {
//             maxSizeMB: 1, // Compress to max 1MB
//             maxWidthOrHeight: 1920, // Max width or height
//             useWebWorker: true, // Use multi-threading for faster compression
//         };
        
//         const compressedFile = await imageCompression(file, options);
        
//         return compressedFile;
//     } catch {
//         throw new Error('Failed to compress image.');
//     }
// };

// /**
//  * Uploads a compressed image directly to Supabase Storage.
//  * Returns the public URL of the uploaded image.
//  */
// export const uploadImageToSupabase = async (file) => {
//     try {
//         // Generate a unique filename
//         const timestamp = Date.now();
//         const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
//         const uniqueFileName = `uploads/${timestamp}_${cleanFileName}`;

//         const startTime = performance.now();

//         // Upload to Supabase Storage
//         const { error } = await supabase.storage
//             .from(BUCKET_NAME)
//             .upload(uniqueFileName, file, {
//                 cacheControl: '3600',
//                 upsert: false,
//                 contentType: file.type
//             });

//         const latency = performance.now() - startTime;
        
//         console.groupCollapsed(`📊 [Metrics] Supabase Upload - ${Math.round(latency)}ms`);
//         console.log(`Latency: ${latency.toFixed(2)} ms`);
//         console.log(`File Size: ${(file.size / 1024).toFixed(2)} KB (${file.size} bytes)`);
//         console.groupEnd();

//         if (error) {
//             throw new Error(`Supabase Storage Error: ${error.message}`);
//         }

//         // Retrieve the public URL
//         const { data: publicUrlData } = supabase.storage
//             .from(BUCKET_NAME)
//             .getPublicUrl(uniqueFileName);

//         const publicUrl = publicUrlData.publicUrl;
        
//         return publicUrl;
        
//     } catch (error) {
//         throw new Error(`Failed to upload image. ${error.message}`);
//     }
// };



import imageCompression from 'browser-image-compression';
import API_CONFIG from './api.config';

// ─── Accepted types ───────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_PDF_TYPES   = ['application/pdf'];
const ALLOWED_TYPES       = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES];

const MAX_IMAGE_MB = 10;   // original image cap before compression
const MAX_PDF_MB   = 20;   // PDF cap (no compression)

// ─── Validators ──────────────────────────────────────────────────────────────

/**
 * Validates an image file (type + size).
 * Throws with a user-facing message on failure.
 */
export const validateImage = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error('Please select a valid image file (JPEG, PNG, or WEBP).');
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        throw new Error(`Image is too large. Please select a file under ${MAX_IMAGE_MB}MB.`);
    }
    return true;
};

/**
 * Validates any supported file (image or PDF).
 * Throws with a user-facing message on failure.
 */
export const validateFile = (file) => {
    // Normalise octet-stream by extension
    let effectiveType = file.type;
    if (effectiveType === 'application/octet-stream') {
        const ext = file.name.split('.').pop().toLowerCase();
        const map = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        effectiveType = map[ext] || effectiveType;
    }

    if (!ALLOWED_TYPES.includes(effectiveType)) {
        throw new Error('Unsupported file type. Please upload a PDF, JPEG, PNG, or WEBP.');
    }

    const isPdf  = ALLOWED_PDF_TYPES.includes(effectiveType);
    const maxMB  = isPdf ? MAX_PDF_MB : MAX_IMAGE_MB;

    if (file.size > maxMB * 1024 * 1024) {
        throw new Error(`File is too large. Maximum size is ${maxMB}MB.`);
    }

    return true;
};

// ─── Image compression ────────────────────────────────────────────────────────

/**
 * Compresses an image client-side before upload.
 * PDFs are passed through unchanged.
 */
export const compressImage = async (file) => {
    const isPdf = ALLOWED_PDF_TYPES.includes(file.type);
    if (isPdf) return file; // no compression for PDFs

    try {
        const compressed = await imageCompression(file, {
            maxSizeMB:        1,
            maxWidthOrHeight: 1920,
            useWebWorker:     true,
        });
        return compressed;
    } catch {
        throw new Error('Failed to compress image. Please try again.');
    }
};

// ─── Core upload function ─────────────────────────────────────────────────────

/**
 * Uploads a file (image or PDF) to the backend /api/upload endpoint.
 *
 * The backend returns:
 *   { status, url, file_type, filename, page_count, truncated }
 *
 * This object is stored in `selectedFile` in session state and is later
 * assembled into the `files: [...]` array in the gpt_query Socket.IO payload.
 *
 * @param {File} file - Raw File object (already compressed if image)
 * @returns {Promise<{ url, file_type, filename, page_count, truncated, previewBlobUrl }>}
 */
export const uploadFileToBackend = async (file) => {
    const startTime = performance.now();

    const formData = new FormData();
    formData.append('file', file, file.name || 'upload');

    const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/upload`, {
        method: 'POST',
        body:   formData,
        // Note: Do NOT set Content-Type manually — browser sets multipart boundary automatically
    });

    const latency = performance.now() - startTime;
    console.groupCollapsed(`📊 [Metrics] Backend Upload - ${Math.round(latency)}ms`);
    console.log(`Latency:   ${latency.toFixed(2)} ms`);
    console.log(`File Size: ${(file.size / 1024).toFixed(2)} KB`);
    console.log(`File Type: ${file.type}`);
    console.groupEnd();

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (HTTP ${response.status})`);
    }

    const data = await response.json();

    if (!data.status || !data.url) {
        throw new Error('Upload succeeded but server returned no URL.');
    }

    // Attach a local blob URL so the UI can show a preview immediately.
    // Only useful for images — for PDFs the UI shows an icon chip instead.
    const isImage = data.file_type === 'image';
    const previewBlobUrl = isImage ? URL.createObjectURL(file) : null;

    return {
        url:           data.url,
        file_type:     data.file_type,       // "image" | "pdf"
        filename:      data.filename,
        page_count:    data.page_count,
        truncated:     data.truncated,
        previewBlobUrl,                       // local blob — for display only, never sent to backend
    };
};

// ─── Convenience wrapper used by InputArea ────────────────────────────────────

/**
 * Full pipeline: validate → compress (images only) → upload.
 * Returns the upload result object ready to store as `selectedFile`.
 *
 * @param {File} file
 * @returns {Promise<UploadResult>}
 */
export const processAndUploadFile = async (file) => {
    validateFile(file);

    const isPdf = ALLOWED_PDF_TYPES.includes(file.type) ||
                  (file.type === 'application/octet-stream' && file.name.endsWith('.pdf'));

    const fileToUpload = isPdf ? file : await compressImage(file);
    return await uploadFileToBackend(fileToUpload);
};
