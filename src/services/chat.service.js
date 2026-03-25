import API_CONFIG from './api.config';

class ChatService {

    /* Fetches a paginated list of the user's historical chat threads.
     * @param {number} skip - The number of records to offset/skip (used for pagination)
     * @param {number} limit - The maximum number of threads to return per request
     * @returns {Promise<Array>} An array of thread objects
     */
    async getAllThreads(skip = 0, limit = 20) {
        const customerStr = localStorage.getItem('customer');
        const customerObj = customerStr ? JSON.parse(customerStr) : {};
        const resultData = customerObj.result || {};
        const custData = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};

        const page = Math.floor(skip / limit) + 1;

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
        const reqSizeBytes = new Blob([reqBodyStr]).size;
        
        const startTime = performance.now();
        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/zipAi/manager`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: reqBodyStr
        });
        const latency = performance.now() - startTime;

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch threads`);
        }

        const resText = await response.text();
        const resSizeBytes = new Blob([resText]).size;
        
        console.groupCollapsed(`📊 [Metrics] API: getAllThreads - ${Math.round(latency)}ms`);
        console.log(`Latency: ${latency.toFixed(2)} ms`);
        console.log(`Req Payload: ${(reqSizeBytes / 1024).toFixed(2)} KB`);
        console.log(`Res Payload: ${(resSizeBytes / 1024).toFixed(2)} KB`);
        console.groupEnd();

        const data = JSON.parse(resText);

        // The API returns nested data. We must ensure we pass an Array down to the components.
        let rawThreads = [];
        if (Array.isArray(data)) {
            rawThreads = data;
        } else if (data && data.all_chat && Array.isArray(data.all_chat)) {
            rawThreads = data.all_chat;
        } else if (data && data.result) {
            if (Array.isArray(data.result)) {
                rawThreads = data.result;
            } else if (Array.isArray(data.result.data)) {
                rawThreads = data.result.data;
            }
        } else if (data && Array.isArray(data.data)) {
            rawThreads = data.data;
        }

        // Map the Zipaworld specific keys to our frontend's expected properties
        const _threads = rawThreads.map(thread => {
            if (thread.threadId && thread.title) return thread;

            return {
                ...thread,
                threadId: thread.session_id || thread._id || thread.threadId,
                sessionId: thread.session_id,
                objectId: thread._id,
                title: thread.query_head || thread.title,
                updatedAt: thread.updatedAt || thread.createdAt || new Date().toISOString()
            };
        });

        // Sort descending by date (latest first)
        const threads = _threads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const currentPage = data.page || page;
        const hasMore = data.totalPages
            ? (currentPage < data.totalPages)
            : (rawThreads.length > 0);

        console.log(`[ChatService] Loaded ${threads.length} threads (page ${currentPage}, hasMore: ${hasMore})`);
        return { threads, hasMore };
    }

    /* Fetches a paginated list of messages for a specific chat thread.
     * @param {string} threadId - The unique identifier of the target thread
     * @param {number} page - The page number to fetch
     * @returns {Promise<Object>} The thread details containing a messages array
     */
    async getThreadMessages(threadId, page = 1) {
        if (!threadId) {
            throw new Error('threadId is required but was not provided');
        }

        const payload = {
            id: threadId,
            page: page
        };

        const reqBodyStr = JSON.stringify(payload);
        const reqSizeBytes = new Blob([reqBodyStr]).size;
        
        const startTime = performance.now();
        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/zipAi/getHistoryChat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: reqBodyStr
        });
        const latency = performance.now() - startTime;

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch thread messages`);
        }

        const resText = await response.text();
        const resSizeBytes = new Blob([resText]).size;
        
        console.groupCollapsed(`📊 [Metrics] API: getThreadMessages - ${Math.round(latency)}ms`);
        console.log(`Latency: ${latency.toFixed(2)} ms`);
        console.log(`Req Payload: ${(reqSizeBytes / 1024).toFixed(2)} KB`);
        console.log(`Res Payload: ${(resSizeBytes / 1024).toFixed(2)} KB`);
        console.groupEnd();

        const data = JSON.parse(resText);

        // Map the API output into the { messages: [] } format the React components expect
        let rawMessages = [];
        if (Array.isArray(data)) rawMessages = data;
        else if (data && Array.isArray(data.result)) rawMessages = data.result;
        else if (data && data.all_chat && Array.isArray(data.all_chat)) rawMessages = data.all_chat;
        else if (data && Array.isArray(data.data)) rawMessages = data.data;

        const mappedData = {
            threadId: threadId,
            hasMore: data.totalPages
                ? ((data.page || page) < data.totalPages)
                : (rawMessages.length > 0),
            messages: rawMessages.map((msg, index) => ({
                ...msg,
                id: msg._id || msg.id || `${threadId}-msg-${index}`,
                role: msg.role === 'customer' ? 'user' : (msg.role || 'assistant'),
                content: msg.text || msg.message || msg.content || '',
                image: msg.image_url || msg.image,
                imageUrl: msg.image_url || msg.imageUrl
            }))
        };

        return mappedData;
    }

    /* Permanently deletes a chat thread and all its associated messages.
     * @param {string} threadId - The unique identifier of the thread to delete
     * @returns {Promise<boolean>} Resolves to true if the deletion was successful
     */
    async deleteThread(threadId) {
        if (!threadId) {
            throw new Error('threadId is required but was not provided');
        }

        const customerStr = localStorage.getItem('customer');
        const customerObj = customerStr ? JSON.parse(customerStr) : {};
        const resultData = customerObj.result || {};
        const custBranchData = resultData.customerBranchData || {};
        const custData = resultData.customerData || {};
        const userId = custBranchData.customerId || custData._id || '';

        const payload = {
            id: threadId,
            user_id: userId
        };

        const response = await fetch(`${API_CONFIG.API_BASE_URL}/api/zipAi/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to delete thread`);
        }

        console.log(`[ChatService] Deleted thread: ${threadId}`);
        return true;
    }

    /* Fetches a LiveKit connection token for voice chat.
     * @param {string} sessionId - The session ID of the active chat
     * @param {string} lang - The selected `user_lang` string for speech-to-text
     * @returns {Promise<string>} The LiveKit connection token
     */
    async getLiveKitToken(sessionId, lang) {
        const customerStr = localStorage.getItem('customer');
        const customerObj = customerStr ? JSON.parse(customerStr) : {};
        const resultData = customerObj.result || {};
        const custData = resultData.customerData || {};
        const custBranchData = resultData.customerBranchData || {};

        const device = navigator.platform.includes('Mac') ? 'macOS' : (navigator.platform.includes('Win') ? 'Windows' : navigator.platform);

        const getLanguageCode = (name) => {
            const map = {
                "English (IN)": "en-IN", "Hindi": "hi-IN", "Marathi": "mr-IN", "Gujarati": "gu-IN",
                "Malayalam": "ml-IN", "Tamil": "ta-IN", "Telugu": "te-IN", "Urdu": "ur-IN",
                "Arabic": "ar-SA", "Chinese": "zh-CN", "Spanish": "es-ES", "French": "fr-FR",
                "German": "de-DE", "Russian": "ru-RU", "Italian": "it-IT", "Indonesian": "id-ID",
                "Korean": "ko-KR", "Hebrew": "he-IL", "Dutch": "nl-NL", "Polish": "pl-PL",
                "Danish": "da-DK", "Swedish": "sv-SE", "Turkish": "tr-TR", "Portuguese": "pt-PT",
                "Czech": "cs-CZ", "Portuguese (BR)": "pt-BR", "Finnish": "fi-FI", "Greek": "el-GR",
                "Hungarian": "hu-HU", "Thai": "th-TH", "Bulgarian": "bg-BG", "Malay": "ms-MY",
                "Slovenian": "sl-SI", "Ukrainian": "uk-UA", "Croatian": "hr-HR", "Romania": "ro-RO",
                "Japanese": "ja-JP"
            };
            return map[name] || "en-IN";
        };

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

        const response = await fetch(`https://newimgchatbotnew1.zipaworld.com/getToken`, {
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
        return data.token;
    }
}

export default new ChatService();