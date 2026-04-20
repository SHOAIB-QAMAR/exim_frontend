import { useRef, useCallback } from 'react';

import { useUI } from '../../../providers/UIContext';
import { getLanguageCode } from '../../../config/languages';


/**
 * Internally used UUID v4 generator.
 */
const uuidv4 = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

/**
 * useChatActions Hook
 *
 * Encapsulates all chat action handlers: sending, retrying, and deleting messages,
 * as well as handling feature clicks and search results.
 *
 * @param {Object} params
 * @param {Object} params.activeSession - Currently visible session object
 * @param {string} params.activeSessionId - ID of the active session
 * @param {Function} params.setActiveSessions - State setter for all sessions
 * @param {Function} params.updateActiveSession - Shorthand to update fields of the active session
 * @param {Function} params.sendMessage - WebSocket function to transmit outgoing messages
 * @param {Object} params.selectedLang - Currently selected language object for STT/TTS
 * @param {Function} params.deleteSession - Function to delete a session from the backend
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
    deleteSession,
    activeSessions,
    handleTabClose,
    handleNewChat,
    closeSearchPanel,
    closeMobileSidebar,
    setFocusTrigger
}) => {

    // Prevent a single message from being sent multiple times
    const isSendingRef = useRef(false);

    const { showNotification } = useUI();

    /**
     * Builds the files array for the gpt_query payload from multiple upload results.
     * 
     * @param {Array} uploadResults - Array of UploadResult objects
     * @returns {Array|null}
     */
    const buildFilesPayload = (uploadResults) => {
        if (!uploadResults || uploadResults.length === 0) return null;
        return uploadResults.map(res => ({
            url: res.url,
            file_type: res.file_type,
            filename: res.filename,
            page_count: res.page_count,
            truncated: res.truncated,
        }));
    };

    /**
     * Handles sending a new chat message.
     * Includes optimistic updates and multi-modal attachment handling.
     *
     * selectedFiles shape coming from InputArea:
     *   []                    — nothing attached
     *   Array of UploadResult objects — pre-uploaded by InputArea:
     *     { url, file_type, filename, page_count, truncated, previewBlobUrl }
     *
     * @param {string} text - Message content
     * @param {Object} [options={}] - Additional options (e.g., isRetry, fileResults)
     */
    const handleSend = useCallback(async (text, options = {}) => {
        if (isSendingRef.current) return;

        // ── Early Offline Guard ───────────────────────────────────────────
        if (!navigator.onLine) {
            showNotification('No internet', 3000);
            return;
        }

        isSendingRef.current = true;

        try {
            const hasFiles = (activeSession.selectedFiles && activeSession.selectedFiles.length > 0) ||
                (options.fileResults && options.fileResults.length > 0);

            if (!text.trim() && !hasFiles) {
                isSendingRef.current = false;
                return;
            }

            const timestamp = Date.now();
            let userMsg = { role: 'user', content: text, timestamp };
            let uploadResults = [];

            // ── Determine upload results ───────────────────────────────────────
            if (options.isRetry && options.fileResults) {
                uploadResults = options.fileResults;
            } else if (activeSession.selectedFiles && activeSession.selectedFiles.length > 0) {
                // In the logic where InputArea handles uploads, we just take them
                uploadResults = activeSession.selectedFiles;
            }

            // ── Prepare User Message Display (Images only) ──────────────────────
            // For UI simplicity, if there are multiple images, we'll store them in an array
            // or just the first one for the legacy 'image' field if needed.
            const images = uploadResults.filter(r => r.file_type === 'image');
            if (images.length > 0) {
                userMsg.image = images[0].previewBlobUrl || images[0].url;
                // Store all image URLs for multi-image rendering in ChatMessages if handled
                userMsg.images = images.map(img => img.previewBlobUrl || img.url);
            }

            // PDFs are now entirely handled in the payload/files array, but we can store 
            // metadata in userMsg for history/UI rendering.
            const pdfs = uploadResults.filter(r => r.file_type === 'pdf' || r.file_type === 'document');
            if (pdfs.length > 0) {
                userMsg.pdfs = pdfs.map(p => ({ url: p.url, name: p.filename, ...p }));
            }

            // ── Optimistic UI update ──────────────────────────────────────────
            const newTitle = (activeSession.messages.length === 0 && text.trim())
                ? text.split(' ').slice(0, 4).join(' ')
                : activeSession.title;

            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, userMsg],
                inputValue: '',
                isThinking: true,
                thinkingSteps: [],
                title: newTitle,
                selectedFiles: [], // Clear selection
                isUploading: false,
            } : s));

            // ── Build gpt_query payload ───────────────────────────────────────
            const customerStr = localStorage.getItem('customer');
            const customerObj = customerStr ? JSON.parse(customerStr) : {};
            const resultData = customerObj.result || {};
            const custData = resultData.customerData || {};
            const custBranchData = resultData.customerBranchData || {};
            const csBuddyData = resultData.csBuddyData || {};

            const payload = {
                question: text,
                thread_id: '',
                user_id: custBranchData.customerId || custData._id || csBuddyData._id || '',
                customerId: custBranchData.customerId || custData._id || '',
                customerName: csBuddyData.name || custData.customerName || 'Unknown',
                customerBranchId: custBranchData._id || '',
                customerBranchName: custBranchData.branchName || 'Unknown',
                customerBranchPersonId: resultData.customerBranchPersonId || '',
                customerBranchPersonEmail: csBuddyData.email
                    ? [csBuddyData.email]
                    : (custBranchData.emails || []),
                questionAnswer: uuidv4(),
                session_id: activeSession.sessionId || activeSession.id,
                language: getLanguageCode(selectedLang?.name || 'English (IN)'),
            };

            const filesPayload = buildFilesPayload(uploadResults);
            if (filesPayload) {
                payload.files = filesPayload;
            }

            // ── Send ─────────────────────────────────────────────────────────
            const sent = sendMessage(activeSessionId, payload);

            if (!sent) {
                setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                    ...s,
                    isThinking: false,
                    messages: [...s.messages, {
                        role: 'assistant',
                        content: 'Error: Connection failed. Please try again.',
                        isNew: true,
                        timestamp: Date.now(),
                    }],
                } : s));
            }

        } catch (error) {
            console.error('[useChatActions] handleSend error:', error);
            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                isThinking: false,
                messages: [...s.messages, {
                    role: 'assistant',
                    content: `Error: Could not send message. ${error.message || ''}`,
                    isNew: true,
                    timestamp: Date.now(),
                }],
            } : s));
        } finally {
            isSendingRef.current = false;
        }
    }, [activeSession, activeSessionId, setActiveSessions, sendMessage, selectedLang, showNotification]);

    /**
     * Retries the last user message.
     */
    const handleRetry = useCallback((text, fileResult = null) => {
        handleSend(text, { isRetry: true, fileResult });
    }, [handleSend]);


    // ── Typing complete ───────────────────────────────────────────────────────
    /**
     * CHANGED: Old version updated individual message isNew flags via updateActiveSession.
     *          New version sets isThinking: false + clears thinkingSteps at the session level,
     *          and triggers input focus.
     */
    const handleTypingComplete = useCallback((sessionId) => {
        setActiveSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, isThinking: false, thinkingSteps: [] } : s
        ));
        if (setFocusTrigger) setFocusTrigger(true);
    }, [setActiveSessions, setFocusTrigger]);


    // ── Feature / starter click ───────────────────────────────────────────────
    /**
     * Activates a starter prompt or secondary feature.
     */
    const handleFeatureClick = useCallback((text) => {
        updateActiveSession({ inputValue: text });
        setFocusTrigger?.(true);
    }, [updateActiveSession, setFocusTrigger]);


    // ── Search result click ───────────────────────────────────────────────────
    /**
     * Direct navigation from a search result item.
     */
    const handleSearchResultClick = useCallback((text) => {
        updateActiveSession({ inputValue: text });
        closeSearchPanel();
        closeMobileSidebar();
        setFocusTrigger?.(true);
    }, [updateActiveSession, closeSearchPanel, closeMobileSidebar, setFocusTrigger]);


    // ── Delete session ────────────────────────────────────────────────────────
    /**
     * Coordinates session deletion with server-side removal and local state cleanup.
     */
    const handleDeleteSession = useCallback(async (sessionId) => {
        if (!sessionId) return;

        const success = await deleteSession(sessionId);
        if (success) {
            const isActive = activeSessions.some(s => s.id === sessionId);
            if (isActive) {
                handleTabClose(sessionId);
            }
        }
    }, [deleteSession, activeSessions, handleTabClose]);


    // ── Search: start new chat (kept from previous code) ─────────────────────
    /**
     * NOTE: handleSearchStartChat is retained from the previous version in case
     *       any existing consumers still reference it. Remove if no longer needed.
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
        closeSearchPanel?.();
        closeMobileSidebar?.();
    }, [handleNewChat, setActiveSessions, setFocusTrigger, closeSearchPanel, closeMobileSidebar]);


    return {
        handleSend,
        handleRetry,
        handleTypingComplete,
        handleFeatureClick,
        handleSearchResultClick,
        handleDeleteSession,
        handleSearchStartChat,
    };
};