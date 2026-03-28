import API_CONFIG from './api.config';
import { getLanguageCode } from '../config/languages';

/**
 * ChatService
 * 
 * Provides methods for interacting with backend, including
 * thread management, message retrieval, and LiveKit token acquisition.
 */
class ChatService {

    /**
     * Fetches a paginated list of the user's historical chat threads.
     * 
     * @param {number} [skip=0] - Offset for pagination.
     * @param {number} [limit=20] - Maximum records per page.
     * @returns {Promise<{ threads: Array, hasMore: boolean }>} Sanitized thread list and pagination status.
     * @throws {Error} If the network request fails or returns an error status.
     */
    async getAllThreads(skip = 0, limit = 20) {
        const customerStr = localStorage.getItem('customer');
        const customerObj = customerStr ? JSON.parse(customerStr) : {};
        const resultData = customerObj.result || {};
        const custData = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};

        const page = Math.floor(skip / limit) + 1;

        // Construct specific payload structure
        const payload = {
            user_id: custBranchData.customerId || custData._id || resultData.csBuddyData?._id,
            page: page,
            customerId: custBranchData.customerId || custData._id,
            customerName: resultData.csBuddyData?.name || custData.customerName || "Unknown",
            customerBranchId: custBranchData._id || resultData.customerBranchData?._id,
            customerBranchName: custBranchData.branchName || "Unknown",
            customerBranchPersonId: resultData.customerBranchPersonId,
            customerBranchPersonEmail: resultData.csBuddyData?.email ? [resultData.csBuddyData.email] : (custBranchData.emails || [])
        };

        const reqBodyStr = JSON.stringify(payload);
        const startTime = performance.now();

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/zipAi/manager`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: reqBodyStr
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch threads`);
        }

        const resText = await response.text();

        // Environment-aware metrics logging
        if (import.meta.env.DEV) {
            const latency = performance.now() - startTime;
            const resSizeBytes = new Blob([resText]).size;
            const reqSizeBytes = new Blob([reqBodyStr]).size;
            console.groupCollapsed(`📊 [Metrics] API: getAllThreads - ${Math.round(latency)}ms`);
            console.log(`Latency: ${latency.toFixed(2)} ms`);
            console.log(`Req Size: ${(reqSizeBytes / 1024).toFixed(2)} KB`);
            console.log(`Res Size: ${(resSizeBytes / 1024).toFixed(2)} KB`);
            console.groupEnd();
        }

        const data = JSON.parse(resText);

        // NORMALIZE: ZipAI returns threads in several different nested structures depending on the environment
        let rawThreads = [];
        if (Array.isArray(data)) {
            rawThreads = data;
        } else if (data?.all_chat && Array.isArray(data.all_chat)) {
            rawThreads = data.all_chat;
        } else if (data?.result) {
            if (Array.isArray(data.result)) {
                rawThreads = data.result;
            } else if (Array.isArray(data.result.data)) {
                rawThreads = data.result.data;
            }
        } else if (data?.data && Array.isArray(data.data)) {
            rawThreads = data.data;
        }

        // MAP: Convert specific backend keys to standard frontend properties
        const threads = rawThreads.map(thread => ({
            ...thread,
            sessionId: thread.session_id || thread._id, // Use session_id if it exists
            objectId: thread._id,                      // Always the MongoDB ID
            title: thread.query_head || thread.title || "Untitled Conversation",
            updatedAt: thread.updatedAt || thread.createdAt || new Date().toISOString()
        })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const currentPage = data.page || page;
        const hasMore = data.totalPages ? (currentPage < data.totalPages) : (rawThreads.length > 0);

        return { threads, hasMore };
    }

    /**
     * Fetches a paginated list of messages for a specific chat thread.
     * 
     * @param {string} objectId - The database identifier (_id) of the thread.
     * @param {number} [page=1] - The page number to fetch.
     * @returns {Promise<Object>} The thread object containing a sanitized messages array.
     */
    async getThreadMessages(objectId, page = 1) {
        if (!objectId) throw new Error('objectId is required for message history');

        const payload = { id: objectId, page: page };
        const reqBodyStr = JSON.stringify(payload);
        const startTime = performance.now();

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/zipAi/getHistoryChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: reqBodyStr
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch thread messages`);
        }

        const resText = await response.text();

        if (import.meta.env.DEV) {
            const latency = performance.now() - startTime;
            console.groupCollapsed(`📊 [Metrics] API: getThreadMessages - ${Math.round(latency)}ms`);
            console.log(`Latency: ${latency.toFixed(2)} ms`);
            console.groupEnd();
        }

        const data = JSON.parse(resText);

        // Normalize various API response shapes into a single array
        let rawMessages = [];
        if (Array.isArray(data)) rawMessages = data;
        else if (data?.result && Array.isArray(data.result)) rawMessages = data.result;
        else if (data?.all_chat && Array.isArray(data.all_chat)) rawMessages = data.all_chat;
        else if (data?.data && Array.isArray(data.data)) rawMessages = data.data;

        return {
            objectId: objectId,
            hasMore: data.totalPages ? ((data.page || page) < data.totalPages) : (rawMessages.length > 0),
            messages: rawMessages.map((msg, index) => ({
                ...msg,
                id: msg._id || msg.id || `${objectId}-msg-${index}`,
                role: msg.role === 'customer' ? 'user' : (msg.role || 'assistant'),
                content: msg.text || msg.message || msg.content || '',
                image: msg.image_url || msg.image,
                imageUrl: msg.image_url || msg.imageUrl
            }))
        };
    }

    /**
     * Permanently deletes a chat thread.
     * 
     * @param {string} objectId - The unique database identifier (_id) of the thread.
     * @returns {Promise<boolean>} True if the deletion was confirmed by the server.
     */
    async deleteThread(objectId) {
        if (!objectId) throw new Error('objectId is required for deletion');

        const customerStr = localStorage.getItem('customer');
        const customerObj = customerStr ? JSON.parse(customerStr) : {};
        const resultData = customerObj.result || {};
        const userId = resultData.customerBranchData?.customerId || resultData.customerData?._id || '';

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/zipAi/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: objectId, user_id: userId })
        });

        if (!response.ok) {
            throw new Error(`Deletion failed (HTTP ${response.status})`);
        }

        return true;
    }

    /**
     * Acquires a LiveKit token for real-time voice and streaming capabilities.
     * 
     * @param {string} sessionId - The current active session ID.
     * @param {string} lang - The display name of the selected language (e.g., 'English').
     * @returns {Promise<string>} The JWT token required to join a LiveKit room.
     */
    async getLiveKitToken(sessionId, lang) {
        const customerStr = localStorage.getItem('customer');
        const customerObj = customerStr ? JSON.parse(customerStr) : {};
        const resultData = customerObj.result || {};
        const custData = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};

        // Detect OS for backend logging purposes
        const device = navigator.platform.includes('Mac') ? 'macOS' : (navigator.platform.includes('Win') ? 'Windows' : navigator.platform);
        const mappedLangCode = getLanguageCode(lang);

        const payload = {
            thread_id: "",
            session_id: sessionId || "",
            user_id: custBranchData.customerId || custData._id || resultData.csBuddyData?._id || "",
            device,
            customerId: custBranchData.customerId || custData._id || "",
            customerName: resultData.csBuddyData?.name || custData.customerName || "Unknown",
            customerBranchId: custBranchData._id || resultData.customerBranchData?._id || "",
            customerBranchName: custBranchData.branchName || "Unknown",
            customerBranchPersonId: resultData.customerBranchPersonId || "",
            customerBranchPersonEmail: resultData.csBuddyData?.email ? [resultData.csBuddyData.email] : (custBranchData.emails || []),
            user_lang: mappedLangCode
        };

        const response = await fetch(`https://newimgchatbotnew1.zipaworld.com/getToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Token API failed (HTTP ${response.status})`);
        }

        const data = await response.json();
        return data.token;
    }
}

export default new ChatService();