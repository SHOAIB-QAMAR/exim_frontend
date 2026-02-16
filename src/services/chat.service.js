import API_CONFIG from './api.config';

// ChatService Handles all API calls for chat functionality.
// Enhanced with comprehensive error handling for deployment debugging.

class ChatService {
    
    _logError(method, operation, error, context = {}) {
        const errorInfo = {
            file: 'chat.service.js',
            class: 'ChatService',
            method,
            operation,
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        };
        console.error(`[ChatService.${method}] Error during ${operation}:`, errorInfo);
    }

    async getAllThreads() {
        const method = 'getAllThreads';
        try {
            console.log(`[ChatService.${method}] Starting to fetch all threads`);

            // const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.THREAD}`);
            const response = await fetch(`http://98.70.52.193:8000/new/api/chats/customer_52a629d0-0cf7-4cb9-9564-4cd382c7d7bc`);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'Unable to read error body');
                const error = new Error(`HTTP ${response.status}: Failed to fetch threads`);
                this._logError(method, 'fetch API call', error, {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody,
                    url: `${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.THREAD}`
                });
                throw error;
            }

            const data = await response.json();
            console.log(`[ChatService.${method}] Successfully fetched ${data?.length || 0} threads`);

            return data;
        } catch (error) {
            this._logError(method, 'getAllThreads', error, {
                url: `${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.THREAD}`
            });
            throw error;
        }
    }

    async getThreadMessages(threadId) {
        const method = 'getThreadMessages';
        try {
            if (!threadId) {
                const error = new Error('threadId is required but was not provided');
                this._logError(method, 'parameter validation', error, { threadId });
                throw error;
            }

            console.log(`[ChatService.${method}] Fetching messages for thread: ${threadId}`);

            // const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.THREAD}/${threadId}`);
            const response = await fetch(`http://98.70.52.193:8000/new/api/chat/customer_52a629d0-0cf7-4cb9-9564-4cd382c7d7bc/${threadId}/history/`);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'Unable to read error body');
                const error = new Error(`HTTP ${response.status}: Failed to fetch thread messages`);
                this._logError(method, 'fetch thread messages', error, {
                    threadId,
                    status: response.status,
                    statusText: response.statusText,
                    errorBody,
                    url: `${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.THREAD}/${threadId}`
                });
                throw error;
            }

            const messages = await response.json();
            console.log(`[ChatService.${method}] Successfully fetched ${messages?.length || 0} messages for thread: ${threadId}`);
            return messages;
        } catch (error) {
            this._logError(method, 'getThreadMessages', error, { threadId });
            throw error;
        }
    }

    async deleteThread(threadId) {
        const method = 'deleteThread';
        try {
            if (!threadId) {
                const error = new Error('threadId is required but was not provided');
                this._logError(method, 'parameter validation', error, { threadId });
                throw error;
            }

            console.log(`[ChatService.${method}] Deleting thread: ${threadId}`);

            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.THREAD}/${threadId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'Unable to read error body');
                const error = new Error(`HTTP ${response.status}: Failed to delete thread`);
                this._logError(method, 'delete API call', error, {
                    threadId,
                    status: response.status,
                    statusText: response.statusText,
                    errorBody
                });
                throw error;
            }

            console.log(`[ChatService.${method}] Successfully deleted thread: ${threadId}`);
            return true;
        } catch (error) {
            this._logError(method, 'deleteThread', error, { threadId });
            throw error;
        }
    }

    async uploadImage(file) {
        const method = 'uploadImage';
        try {
            if (!file) {
                const error = new Error('File is required but was not provided');
                this._logError(method, 'parameter validation', error, { file });
                throw error;
            }

            console.log(`[ChatService.${method}] Starting image upload - Name: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.UPLOAD}`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                let errorDetail = 'Failed to upload image';
                try {
                    const errorJson = await response.json();
                    errorDetail = errorJson.detail || errorDetail;
                } catch {
                    // JSON parse failed, use default error message
                }
                const error = new Error(`HTTP ${response.status}: ${errorDetail}`);
                this._logError(method, 'upload API call', error, {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    status: response.status,
                    statusText: response.statusText
                });
                throw error;
            }

            const result = await response.json();
            console.log(`[ChatService.${method}] Successfully uploaded image: ${result.url}`);
            return result;
        } catch (error) {
            this._logError(method, 'uploadImage', error, {
                fileName: file?.name,
                fileSize: file?.size,
                fileType: file?.type
            });
            throw error;
        }
    }
}

export default new ChatService();