import { useRef, useCallback } from 'react';
import ChatService from '../../../services/chat.service';
import { uuidv4 } from '../../../utils/uuid.v4.js';
import { validateImage, compressImage, uploadImageToSupabase } from '../../../services/uploadService';

// Encapsulates all chat action handlers: send, retry, delete, feature click, search results, and typing-complete logic.
// @param {Object} params || @param {Object} params.activeSession - Currently visible session object @param {string} params.activeSessionId - ID of the active session @param {Function} params.setActiveSessions - State setter for all sessions @param {Function} params.updateActiveSession - Shorthand to update the active session fields @param {Function} params.sendMessage - WebSocket sendMessage function @param {Object} params.selectedLang - Currently selected language object @param {Function} params.deleteThread - Function to delete a thread from the server @param {Array} params.activeSessions - All active sessions @param {Function} params.handleTabClose - Function to close a tab @param {Function} params.handleNewChat - Function to create a new chat @param {Function} params.closeSearchPanel - Function to close the search panel @param {Function} params.closeMobileSidebar - Function to close mobile sidebar @param {function} params.setFocusTrigger - Function to trigger input focus

export const useChatActions = ({
    activeSession,
    activeSessionId,
    setActiveSessions,
    updateActiveSession,
    sendMessage,
    selectedLang,
    deleteThread,
    activeSessions,
    handleTabClose,
    handleNewChat,
    closeSearchPanel,
    closeMobileSidebar,
    setFocusTrigger
}) => {
    const isSendingRef = useRef(false);

    /**
     * Handles sending a chat message.
     */
    const handleSend = useCallback(async (text, options = {}) => {
        if (isSendingRef.current) return;
        isSendingRef.current = true;

        try {
            if (!text.trim() && !activeSession.selectedFile && !options.imageUrl) { isSendingRef.current = false; return; }

            const timestamp = Date.now();
            let userMsg = { role: 'user', content: text, timestamp };
            let uploadedImageUrl = null;
            let blobUrl = null;

            // Handle image upload if present, or use existing from retry
            if (activeSession.selectedFile && !options.isRetry) {
                blobUrl = URL.createObjectURL(activeSession.selectedFile);
                userMsg.image = blobUrl;

                try {
                    // Set uploading state for the UI
                    setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, isUploading: true } : s));
                    
                    // Validate file
                    validateImage(activeSession.selectedFile);

                    // Compress the image
                    const compressedImage = await compressImage(activeSession.selectedFile);

                    // Upload directly to Supabase
                    const publicUrl = await uploadImageToSupabase(compressedImage);
                    
                    uploadedImageUrl = publicUrl;
                    userMsg.image = uploadedImageUrl; // Replace blob URL with final URL
                    
                    if (blobUrl) URL.revokeObjectURL(blobUrl);
                    blobUrl = null;
                } catch {
                    // Upload failed — abort send so user can retry
                    alert('Image upload failed. Please try again.');
                    setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, isUploading: false } : s));
                    isSendingRef.current = false;
                    return; 
                }
            } else if (options.isRetry && options.imageUrl) {
                uploadedImageUrl = options.imageUrl;
                userMsg.image = uploadedImageUrl;
            }

            // Optimistic UI update
            const newTitle = activeSession.messages.length === 0
                ? text.split(' ').slice(0, 4).join(' ')
                : activeSession.title;

            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, userMsg],
                inputValue: "",
                isThinking: true,
                thinkingSteps: [],
                title: newTitle,
                selectedFile: null,
                isUploading: false // Clear uploading state
            } : s));

            // Prepare and send payload following the backend Socket.IO structure
            const customerStr = localStorage.getItem('customer');
            const customerObj = customerStr ? JSON.parse(customerStr) : {};
            const resultData = customerObj.result || {};
            const custData = resultData.customerData || {};
            const custBranchData = resultData.customerBranchData || {};
            const csBuddyData = resultData.csBuddyData || {};


            const payload = {
                question: text,
                thread_id: "",
                user_id: custBranchData.customerId || custData._id || csBuddyData._id || "",
                customerId: custBranchData.customerId || custData._id || "",
                customerName: csBuddyData.name || custData.customerName || "Unknown",
                customerBranchId: custBranchData._id || "",
                customerBranchName: custBranchData.branchName || "Unknown",
                customerBranchPersonId: resultData.customerBranchPersonId || "",
                customerBranchPersonEmail: csBuddyData.email
                    ? [csBuddyData.email]
                    : (custBranchData.emails || []),
                questionAnswer: uuidv4(),
                session_id: activeSession.sessionId || "",
                language: selectedLang?.language || "en-IN",
            };

            // Attach the S3 image url to the backend processing payload
            if (uploadedImageUrl) {
                payload.image = uploadedImageUrl;
            }

            const sent = sendMessage(activeSessionId, payload);

            if (!sent) {
                setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                    ...s,
                    isThinking: false,
                    messages: [...s.messages, {
                        role: 'assistant',
                        content: "Error: Connection failed. Please try again.",
                        isNew: true,
                        timestamp: Date.now()
                    }]
                } : s));
            }
        } catch (error) {
            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                isThinking: false,
                messages: [...s.messages, {
                    role: 'assistant',
                    content: `Error: Could not send message. ${error.message}`,
                    isNew: true,
                    timestamp: Date.now()
                }]
            } : s));
        } finally {
            isSendingRef.current = false;
        }
    }, [activeSession, activeSessionId, setActiveSessions, sendMessage, selectedLang]);

    // Retry a failed message.

    const handleRetry = useCallback((errorMsgIndex) => {
        const messages = activeSession.messages;
        const userMsg = messages[errorMsgIndex - 1];
        if (!userMsg || userMsg.role !== 'user') return;

        // Remove BOTH the error message and the original user message from the UI
        const cleaned = messages.filter((_, i) => i !== errorMsgIndex && i !== errorMsgIndex - 1);
        updateActiveSession({ messages: cleaned });

        setTimeout(() => handleSend(userMsg.content, { isRetry: true, imageUrl: userMsg.image }), 50);
    }, [activeSession.messages, updateActiveSession, handleSend]);

    // Mark a message's typing animation as complete.

    const handleTypingComplete = useCallback((index) => {
        const newMessages = activeSession.messages.map((msg, i) =>
            i === index ? { ...msg, isNew: false } : msg
        );
        updateActiveSession({ messages: newMessages });
    }, [activeSession.messages, updateActiveSession]);

    // Handle starter/feature click — populate input.

    const handleFeatureClick = useCallback((text) => {
        updateActiveSession({ inputValue: text });
        setFocusTrigger?.(true);
    }, [updateActiveSession, setFocusTrigger]);

    // Handle search result click — populate input and close panels.

    const handleSearchResultClick = useCallback((text) => {
        updateActiveSession({ inputValue: text });
        closeSearchPanel();
        closeMobileSidebar();
        setFocusTrigger?.(true);
    }, [updateActiveSession, closeSearchPanel, closeMobileSidebar, setFocusTrigger]);

    // Handle "start chat" from search — create new chat and populate.

    const handleSearchStartChat = useCallback((text) => {
        handleNewChat();
        setTimeout(() => {
            setActiveSessions(prev => {
                const last = prev[prev.length - 1];
                return prev.map(s => s.id === last.id ? { ...s, inputValue: text } : s);
            });
            setFocusTrigger?.(true);
        }, 50);
        closeSearchPanel();
        closeMobileSidebar();
    }, [handleNewChat, setActiveSessions, setFocusTrigger, closeSearchPanel, closeMobileSidebar]);

    // Delete a chat thread.

    const handleDeleteChat = useCallback(async (threadId) => {
        if (!threadId) return;

        const success = await deleteThread(threadId);
        if (success) {
            const isActive = activeSessions.some(s => s.id === threadId);
            if (isActive) {
                handleTabClose(threadId);
            }
        }
    }, [deleteThread, activeSessions, handleTabClose]);

    return {
        handleSend,
        handleRetry,
        handleTypingComplete,
        handleFeatureClick,
        handleSearchResultClick,
        handleSearchStartChat,
        handleDeleteChat
    };
};
