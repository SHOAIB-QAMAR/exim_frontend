import API_CONFIG from './api.config';
import { getLanguageCode } from '../config/languages';

class ChatService {

    /* Fetches a paginated list of the user's historical chat threads.
     * @param {number} skip - The number of records to offset/skip (used for pagination)
     * @param {number} limit - The maximum number of threads to return per request
     * @returns {Promise<Array>} An array of thread objects
     */
    async getAllThreads(skip = 0, limit = 20) {
        const customerStr    = localStorage.getItem('customer');
        const customerObj    = customerStr ? JSON.parse(customerStr) : {};
        const resultData     = customerObj.result || {};
        const custData       = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};
        const customerId     = custBranchData.customerId || custData._id || '';

        const page = Math.floor(skip / limit) + 1;

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/chat/list`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ customerId, page }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch threads`);

        const data = await response.json();
        // Backend returns: { status, all_chat: [{ _id, query_head, session_id }], count }
        const rawThreads = data.all_chat || [];

        const threads = rawThreads.map(t => ({
            threadId:  t.session_id || t._id,
            objectId:  t._id,
            title:     t.query_head || 'New Chat',
            sessionId: t.session_id || t._id,
            messages:  [],
        }));

        // Backend paginates at CHAT_LIST_PAGE_SIZE (default 20)
        // hasMore = there are more pages beyond this one
        const hasMore = rawThreads.length >= limit;

        return { threads, hasMore };
    }

    /* Fetches a paginated list of messages for a specific chat thread.
     * @param {string} threadId - The unique identifier of the target thread
     * @param {number} page - The page number to fetch
     * @returns {Promise<Object>} The thread details containing a messages array
     */
    async getThreadMessages(threadId, page = 1) {
        if (!threadId) throw new Error('threadId is required but was not provided');

        const startTime = performance.now();

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/chat/detail`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: threadId, page }),
        });

        const latency = performance.now() - startTime;
        console.groupCollapsed(`📊 [Metrics] API: getThreadMessages - ${Math.round(latency)}ms`);
        console.log(`Latency: ${latency.toFixed(2)} ms`);
        console.groupEnd();

        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch thread messages`);

        const data = await response.json();

        // ✅ Backend returns messages in `result`, not `messages`
        const rawMessages = data.result || data.messages || data.all_chat || [];

        // ✅ Backend uses totalPages + page, not total + page_size
        const hasMore = data.totalPages
            ? Number(data.page || 1) < Number(data.totalPages)
            : false;

        return {
            threadId,
            hasMore,
            messages: rawMessages.map((msg, index) => ({
                ...msg,
                id:      msg._id || msg.id || msg.questionAnswer || `${threadId}-msg-${index}`,
                // ✅ Backend uses `text` as the content field — prioritise it
                role:    msg.role === 'customer' ? 'user' : (msg.role || 'assistant'),
                content: msg.text || msg.content || msg.message || '',
                image:   msg.image_url || msg.image || null,
            })),
        };
    }

    /* Permanently deletes a chat thread and all its associated messages.
     * @param {string} threadId - The unique identifier of the thread to delete
     * @returns {Promise<boolean>} Resolves to true if the deletion was successful
     */
    async deleteThread(threadId) {
        if (!threadId) throw new Error('threadId is required but was not provided');

        const customerStr    = localStorage.getItem('customer');
        const customerObj    = customerStr ? JSON.parse(customerStr) : {};
        const resultData     = customerObj.result || {};
        const custData       = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};
        const customerId     = custBranchData.customerId || custData._id || '';

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/chat/${threadId}`, {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ customerId }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to delete thread`);

        console.log(`[ChatService] Deleted thread: ${threadId}`);
        return true;
    }

    /* Fetches a LiveKit connection token for voice chat.
     * @param {string} sessionId - The session ID of the active chat
     * @param {string} lang - The selected `user_lang` string for speech-to-text
     * @returns {Promise<string>} The LiveKit connection token
     */
    async getLiveKitToken__deprecated(sessionId, lang) {
        const customerStr = localStorage.getItem('customer');
        const customerObj = customerStr ? JSON.parse(customerStr) : {};
        const resultData = customerObj.result || {};
        const custData = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};

        const device = navigator.platform.includes('Mac') ? 'macOS' : (navigator.platform.includes('Win') ? 'Windows' : navigator.platform);



        const mappedLangCode = getLanguageCode(lang);

        const payload = {
            thread_id: "",
            session_id: sessionId || "",
            user_id: custBranchData.customerId || custData._id || resultData.csBuddyData?._id || "",
            device: device,
            customerId: custBranchData.customerId || custData._id || "",
            customerName: resultData.csBuddyData?.name || custData.customerName || "Unknown",
            customerBranchId: custBranchData._id || resultData.customerBranchData?._id || "",
            customerBranchName: custBranchData.branchName || "Unknown",
            customerBranchPersonId: resultData.customerBranchPersonId || "",
            customerBranchPersonEmail: resultData.csBuddyData?.email ? [resultData.csBuddyData.email] : (custBranchData.emails || []),
            user_lang: mappedLangCode
        };
        console.log(`customer_id: ${custBranchData.customerId || custData._id || ""}`)
        console.log(`chat_id: ${sessionId || ""}`)
        console.log(`language: ${mappedLangCode}`)

        const rawCustomerId = custBranchData.customerId || custData._id || csBuddyData._id || '';
        const languageCode  = getLanguageCode(lang);

        // ✅ Prefix to match the room name pattern the LiveKit dispatch rule expects
        // Jinja uses: cust_{uuid}_chat_{timestamp}
        // We mirror that exact format here
        const customerId = rawCustomerId.startsWith('cust_')
            ? rawCustomerId
            : `cust_${rawCustomerId}`;

        const chatId = sessionId
            ? (sessionId.startsWith('chat_') ? sessionId : `chat_${sessionId}`)
            : `chat_${Date.now()}`;

        const payloadnew = {
            customer_id: customerId,
            chat_id:     chatId,
            language:    languageCode,
        };
        
        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/voice/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to get LiveKit token`);
        }

        const data = await response.json();
        console.log('[LiveKit Token API] Full Response:', data);
        // Return the full object — InputArea needs token, url, AND room
        // to connect: room.connect(data.url, data.token)
        return {
            token: data.token,
            url:   data.url,
            room:  data.room,
        };
    }
    async getLiveKitToken(sessionId, lang) {
        const customerStr    = localStorage.getItem('customer');
        const customerObj    = customerStr ? JSON.parse(customerStr) : {};
        const resultData     = customerObj.result || {};
        const custData       = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};
        const csBuddyData    = resultData.csBuddyData || {};

        const rawId      = custBranchData.customerId || custData._id || csBuddyData._id || '';
        const languageCode = getLanguageCode(lang);

        // Mirror Jinja template format exactly so the LiveKit dispatch rule matches
        const customerId = rawId.startsWith('cust_') ? rawId : `cust_${rawId}`;
        const chatId     = sessionId
            ? (sessionId.startsWith('chat_') ? sessionId : `chat_${sessionId}`)
            : `chat_${Date.now()}`;

        const payload = {
            customer_id: customerId,   // → cust_633164d22c151b0884b3190b
            chat_id:     chatId,       // → chat_96371140-2a69-11f1-bacf-c73a3959cd59
            language:    languageCode,
        };

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/voice/token`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${response.status}: Failed to get LiveKit token`);
        }

        const data = await response.json();
        console.log('[LiveKit Token API] Full Response:', data);
        return { token: data.token, url: data.url, room: data.room };
    }
}

export default new ChatService();