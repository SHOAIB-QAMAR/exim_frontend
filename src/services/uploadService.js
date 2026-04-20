import imageCompression from 'browser-image-compression';
import API_CONFIG from './api.config';

// ─── Accepted types ───────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_DOC_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES, ...ALLOWED_DOC_TYPES];

const MAX_IMAGE_MB = 10;   // original image cap before compression
const MAX_DOC_MB = 20;     // Document cap (no compression)

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
    if (effectiveType === 'application/octet-stream' || !effectiveType) {
        const ext = file.name.split('.').pop().toLowerCase();
        const map = { 
            pdf: 'application/pdf', 
            jpg: 'image/jpeg', 
            jpeg: 'image/jpeg', 
            png: 'image/png', 
            webp: 'image/webp',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            xls: 'application/vnd.ms-excel',
            csv: 'text/csv'
        };
        effectiveType = map[ext] || effectiveType;
    }

    if (!ALLOWED_TYPES.includes(effectiveType)) {
        throw new Error('Unsupported file type. Please upload a PDF, DOCX, XLSX, CSV, JPEG, PNG, or WEBP.');
    }

    const isDoc = ALLOWED_PDF_TYPES.includes(effectiveType) || ALLOWED_DOC_TYPES.includes(effectiveType);
    const maxMB = isDoc ? MAX_DOC_MB : MAX_IMAGE_MB;

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
    const isDoc = ALLOWED_PDF_TYPES.includes(file.type) || ALLOWED_DOC_TYPES.includes(file.type) || ALLOWED_DOC_TYPES.some((type) => file.name.endsWith(type.split('.').pop()));
    if (isDoc) return file; // no compression for documents

    try {
        const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
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
        body: formData,
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
    console.log('[Upload] ← Response');
    console.table(data);

    if (!data.status || !data.url) {
        throw new Error('Upload succeeded but server returned no URL.');
    }

    // Attach a local blob URL so the UI can show a preview immediately.
    // Only useful for images — for documents the UI shows an icon chip instead.
    const actualIsDoc = ALLOWED_DOC_TYPES.includes(file.type) || file.name.match(/\.(docx|doc|xlsx|xls|csv|pdf)$/i);
    const isImage = !actualIsDoc && (data.file_type === 'image' || file.type.startsWith('image/'));
    const previewBlobUrl = isImage ? URL.createObjectURL(file) : null;
    
    // We can infer local file_type properly if backend doesn't detect it perfectly 
    // or we can just rely on the existing backend behavior, mapping documents:
    const finalFileType = actualIsDoc ? (file.name.match(/\.pdf$/i) ? 'pdf' : 'document') : (isImage ? 'image' : data.file_type);

    return {
        url: data.url,
        file_type: finalFileType,             // "image" | "pdf" | "document"
        filename: data.filename,
        page_count: data.page_count,
        truncated: data.truncated,
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

    const isDoc = ALLOWED_PDF_TYPES.includes(file.type) || ALLOWED_DOC_TYPES.includes(file.type) || 
        ((file.type === 'application/octet-stream' || !file.type) && (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv') || file.name.endsWith('.xls')));

    const fileToUpload = isDoc ? file : await compressImage(file);
    return await uploadFileToBackend(fileToUpload);
};

