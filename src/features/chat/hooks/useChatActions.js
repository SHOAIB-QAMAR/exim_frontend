import { useRef, useCallback } from 'react';
import { uuidv4 } from '../../../utils/uuid.v4.js';
import { validateImage, compressImage, uploadImageToSupabase } from '../../../services/uploadService';

/**
 * useChatActions Hook
 * 
 * Encapsulates all chat action handlers: sending, and deleting messages, 
 * as well as handling feature clicks and search results.
 * 
 * @param {Object} params
 * @param {Object} params.activeSession - Currently visible session object
 * @param {string} params.activeSessionId - ID of the active session
 * @param {Function} params.setActiveSessions - State setter for all sessions
 * @param {Function} params.updateActiveSession - Shorthand to update fields of the active session
 * @param {Function} params.sendMessage - WebSocket function to transmit outgoing messages
 * @param {Object} params.selectedLang - Currently selected language object for STT/TTS
 * @param {Function} params.deleteThread - Function to delete a thread from the backend
 * @param {Array} params.activeSessions - All currently active/open sessions
 * @param {Function} params.handleTabClose - Callback to close a specific tab
 * @param {Function} params.handleNewChat - Callback to initialize a fresh chat session
 * @param {Function} params.closeSearchPanel - Callback to close the search overlay
 * @param {Function} params.closeMobileSidebar - Callback to hide the mobile sidebar
 * @param {Function} [params.setFocusTrigger] - Optional trigger to focus the input area
 * 
 * @returns {Object} An object containing all stable action handlers
 */
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
     * Handles sending a new chat message.
     * Includes optimistic updates and multi-modal attachment handling.
     * 
     * @param {string} text - Message content
     * @param {Object} [options={}] - Additional options (e.g., isRetry, imageUrl)
     */
    const handleSend = useCallback(async (text, options = {}) => {
        if (isSendingRef.current) return;
        isSendingRef.current = true;

        try {
            // Early return if message is empty and no attachment exists
            if (!text.trim() && !activeSession.selectedFile && !options.imageUrl) {
                isSendingRef.current = false;
                return;
            }

            const timestamp = Date.now();
            let userMsg = { role: 'user', content: text, timestamp };
            let uploadedImageUrl = null;
            let blobUrl = null;

            // Handle image upload if present, or use existing from retry
            if (activeSession.selectedFile && !options.isRetry) {
                if (typeof activeSession.selectedFile === 'string') {
                    // Already uploaded by background process in InputArea
                    uploadedImageUrl = activeSession.selectedFile;
                    userMsg.image = uploadedImageUrl;
                } else {
                    // Fallback: wait for direct upload before sending
                    blobUrl = URL.createObjectURL(activeSession.selectedFile);
                    userMsg.image = blobUrl;

                    try {
                        // Notify UI that upload is in progress
                        setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, isUploading: true } : s));

                        validateImage(activeSession.selectedFile);
                        const compressedImage = await compressImage(activeSession.selectedFile);
                        uploadedImageUrl = await uploadImageToSupabase(compressedImage);

                        userMsg.image = uploadedImageUrl; // Replace blob
                        if (blobUrl) URL.revokeObjectURL(blobUrl);
                        blobUrl = null;
                    } catch (uploadError) {
                        console.error('[useChatActions] Upload failed:', uploadError);
                        alert('Image upload failed. Please try again.');
                        setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, isUploading: false } : s));
                        isSendingRef.current = false;
                        return;
                    }
                }
            } else if (options.isRetry && options.imageUrl) {
                uploadedImageUrl = options.imageUrl;
                userMsg.image = uploadedImageUrl;
            }

            // Optimistic UI update: message appears instantly
            const newTitle = (activeSession.messages.length === 0 && text.trim())
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
                isUploading: false
            } : s));

            // Extract customer metadata for secure backend processing
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
                customerBranchPersonEmail: csBuddyData.email ? [csBuddyData.email] : (custBranchData.emails || []),
                questionAnswer: uuidv4(),
                session_id: activeSession.sessionId || "",
                language: selectedLang?.language || "en-IN",
            };

            if (uploadedImageUrl) {
                payload.image = uploadedImageUrl;
            }

            // Trigger WebSocket transmission
            const sent = sendMessage(activeSessionId, payload);

            if (!sent) {
                // If the socket service reports failure, notify the user
                setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                    ...s,
                    isThinking: false,
                    messages: [...s.messages, {
                        role: 'assistant',
                        content: "Error: Socket connection unavailable. Retrying...",
                        isNew: true,
                        timestamp: Date.now()
                    }]
                } : s));
            }
        } catch (error) {
            console.error('[useChatActions] Send failure:', error);
            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                isThinking: false,
                messages: [...s.messages, {
                    role: 'assistant',
                    content: "Something went wrong. Please try sending again.",
                    isNew: true,
                    timestamp: Date.now()
                }]
            } : s));
        } finally {
            isSendingRef.current = false;
        }
    }, [activeSession, activeSessionId, setActiveSessions, sendMessage, selectedLang]);


    /**
     * Finalizes message formatting once typing animations complete.
     */
    const handleTypingComplete = useCallback((index) => {
        const newMessages = activeSession.messages.map((msg, i) =>
            i === index ? { ...msg, isNew: false } : msg
        );
        updateActiveSession({ messages: newMessages });
    }, [activeSession.messages, updateActiveSession]);

    /**
     * Activates a starter prompt or secondary feature.
     */
    const handleFeatureClick = useCallback((text) => {
        updateActiveSession({ inputValue: text });
        setFocusTrigger?.(true);
    }, [updateActiveSession, setFocusTrigger]);

    /**
     * Direct navigation from a search result item.
     */
    const handleSearchResultClick = useCallback((text) => {
        updateActiveSession({ inputValue: text });
        closeSearchPanel();
        closeMobileSidebar();
        setFocusTrigger?.(true);
    }, [updateActiveSession, closeSearchPanel, closeMobileSidebar, setFocusTrigger]);

    /**
     * Initializes a new session based on a search suggestion.
     */
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

    /**
     * Coordinates chat deletion with server-side removal and local state cleanup.
     */
    const handleDeleteChat = useCallback(async (sessionId) => {
        if (!sessionId) return;

        const success = await deleteThread(sessionId);
        if (success) {
            const isActive = activeSessions.some(s => s.id === sessionId);
            if (isActive) {
                handleTabClose(sessionId);
            }
        }
    }, [deleteThread, activeSessions, handleTabClose]);

    return {
        handleSend,
        handleTypingComplete,
        handleFeatureClick,
        handleSearchResultClick,
        handleSearchStartChat,
        handleDeleteChat
    };
};
