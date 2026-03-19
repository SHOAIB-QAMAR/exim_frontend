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

        const response = await fetch(`https://finance.devapi.zipaworld.com/api/zipAi/manager`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch threads`);
        }

        const data = await response.json();

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
        const threads = rawThreads.map(thread => {
            if (thread.threadId && thread.title) return thread;

            return {
                ...thread,
                threadId: thread.session_id || thread._id || thread.threadId,
                sessionId: thread.session_id,
                title: thread.query_head || thread.title,
                updatedAt: thread.updatedAt || new Date().toISOString()
            };
        });

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

        const response = await fetch(`https://finance.devapi.zipaworld.com/api/zipAi/getHistoryChat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch thread messages`);
        }

        const data = await response.json();

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

        const response = await fetch(`https://finance.devapi.zipaworld.com/api/zipAi/delete`, {
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

}

export default new ChatService();