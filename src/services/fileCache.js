/**
 * FileCache - Session-level Blob caching for remote media assets.
 * 
 * Fetches remote URLs once, converts them to local blob: URLs, and serves them instantly on subsequent requests.
 */

const cache = new Map();       // Mapping : remoteUrl -> blobUrl
const inflight = new Map();    // Mapping : remoteUrl -> Promise<blobUrl>

/**
 * Returns a cached blob URL for the given remote URL.
 * On the first call for a URL, fetches it and stores the blob.
 * Concurrent calls for the same URL share a single fetch.
 *
 * @param {string} url - The remote URL to cache
 * @returns {Promise<string>} A local blob: URL
 */
export async function getCachedUrl(url) {
    if (!url) return url;
    // Already a blob or data URL — no caching needed
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;

    // Return from cache if available
    if (cache.has(url)) return cache.get(url);

    // Deduplicate concurrent fetches for the same URL
    if (inflight.has(url)) return inflight.get(url);

    const promise = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            return res.blob();
        })
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            cache.set(url, blobUrl);
            inflight.delete(url);
            return blobUrl;
        })
        .catch(err => {
            console.warn('[FileCache] Failed to cache:', url, err);
            inflight.delete(url);
            return url; // Fallback to original URL
        });

    inflight.set(url, promise);
    return promise;
}

/**
 * Revokes all cached blob URLs and clears the cache.
 */
export function clearCache() {
    cache.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
    cache.clear();
    inflight.clear();
}