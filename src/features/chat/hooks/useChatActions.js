import { useRef, useCallback } from 'react';
import ChatService from '../../../services/chat.service';
import { uuidv4 } from '../../../utils/uuid.v4.js';
import { validateFile, compressImage, uploadFileToBackend } from '../../../services/uploadService';

// ─────────────────────────────────────────────────────────────────────────────
// useChatActions
//
// Encapsulates all chat action handlers: send, retry, delete, feature click,
// search results, and typing-complete logic.
//
// Key change vs old version:
//   • File uploads go to /api/upload (backend S3), NOT Supabase.
//   • selectedFile is now either null | File | UploadResult object.
//   • gpt_query payload uses files: [...] array, NOT payload.image string.
//   • userMsg.image is set to the S3 URL for display in the chat bubble (images only).
// ─────────────────────────────────────────────────────────────────────────────

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
     * Builds the files array for the gpt_query payload from an upload result.
     * Returns null if there is no file.
     *
     * @param {object|null} uploadResult
     * @returns {Array|null}
     */
    const buildFilesPayload = (uploadResult) => {
        if (!uploadResult || !uploadResult.url) return null;
        return [{
            url:        uploadResult.url,
            file_type:  uploadResult.file_type,
            filename:   uploadResult.filename,
            page_count: uploadResult.page_count,
            truncated:  uploadResult.truncated,
        }];
    };

    /**
     * Handles sending a chat message (text, file, or both).
     *
     * selectedFile shape coming from InputArea:
     *   null                         — nothing attached
     *   File object                  — selected but upload not yet complete (race condition fallback)
     *   UploadResult object           — pre-uploaded by InputArea background process:
     *     { url, file_type, filename, page_count, truncated, previewBlobUrl }
     */
    const handleSend = useCallback(async (text, options = {}) => {
        if (isSendingRef.current) return;
        isSendingRef.current = true;

        try {
            const hasFile = !!activeSession.selectedFile || !!options.fileResult;
            if (!text.trim() && !hasFile) {
                isSendingRef.current = false;
                return;
            }

            const timestamp = Date.now();
            let userMsg     = { role: 'user', content: text, timestamp };
            let uploadResult = null; // will hold { url, file_type, filename, page_count, truncated }

            // ── Determine upload result ───────────────────────────────────────
            if (options.isRetry && options.fileResult) {
                // Retry path: caller passes the original upload result directly
                uploadResult = options.fileResult;

            } else if (activeSession.selectedFile) {
                const sf = activeSession.selectedFile;

                if (sf && typeof sf === 'object' && sf.url) {
                    // ✅ Happy path: InputArea already uploaded in background, sf IS the result
                    uploadResult = sf;

                } else if (sf instanceof File) {
                    // ⚠️ Fallback: still a raw File — upload now (shouldn't normally happen)
                    try {
                        setActiveSessions(prev => prev.map(s =>
                            s.id === activeSessionId ? { ...s, isUploading: true } : s
                        ));

                        validateFile(sf);
                        const isPdf = sf.type === 'application/pdf' ||
                                      (sf.type === 'application/octet-stream' && sf.name.endsWith('.pdf'));
                        const fileToUpload = isPdf ? sf : await compressImage(sf);
                        uploadResult = await uploadFileToBackend(fileToUpload);

                    } catch (err) {
                        console.error('[useChatActions] Upload failed:', err);
                        alert(err.message || 'File upload failed. Please try again.');
                        setActiveSessions(prev => prev.map(s =>
                            s.id === activeSessionId ? { ...s, isUploading: false } : s
                        ));
                        isSendingRef.current = false;
                        return;
                    }
                }
            }

            // ── Set display image on the user message bubble (images only) ────
            if (uploadResult?.file_type === 'image') {
                // Prefer the local blob URL for instant display; fall back to S3 URL
                userMsg.image = uploadResult.previewBlobUrl || uploadResult.url;
            }

            // ── Optimistic UI update ─────────────────────────────────────────
            const newTitle = activeSession.messages.length === 0
                ? text.split(' ').slice(0, 4).join(' ')
                : activeSession.title;

            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages:     [...s.messages, userMsg],
                inputValue:   '',
                isThinking:   true,
                thinkingSteps: [],
                title:        newTitle,
                selectedFile: null,
                isUploading:  false,
            } : s));

            // ── Build gpt_query payload ───────────────────────────────────────
            const customerStr    = localStorage.getItem('customer');
            const customerObj    = customerStr ? JSON.parse(customerStr) : {};
            const resultData     = customerObj.result || {};
            const custData       = resultData.customerData || {};
            const custBranchData = resultData.customerBranchData || {};
            const csBuddyData    = resultData.csBuddyData || {};

            const payload = {
                question:                  text,
                thread_id:                 '',
                user_id:                   custBranchData.customerId || custData._id || csBuddyData._id || '',
                customerId:                custBranchData.customerId || custData._id || '',
                customerName:              csBuddyData.name || custData.customerName || 'Unknown',
                customerBranchId:          custBranchData._id || '',
                customerBranchName:        custBranchData.branchName || 'Unknown',
                customerBranchPersonId:    resultData.customerBranchPersonId || '',
                customerBranchPersonEmail: csBuddyData.email
                    ? [csBuddyData.email]
                    : (custBranchData.emails || []),
                questionAnswer:            uuidv4(),
                session_id:                activeSession.sessionId || '',
                language:                  selectedLang?.language || 'en-IN',
            };

            // ✅ Attach file using the correct backend contract: files array
            // Never use payload.image — backend does not read that field.
            const filesPayload = buildFilesPayload(uploadResult);
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
                        role:      'assistant',
                        content:   'Error: Connection failed. Please try again.',
                        isNew:     true,
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
                    role:      'assistant',
                    content:   `Error: Could not send message. ${error.message || ''}`,
                    isNew:     true,
                    timestamp: Date.now(),
                }],
            } : s));
        } finally {
            isSendingRef.current = false;
        }
    }, [activeSession, activeSessionId, setActiveSessions, sendMessage, selectedLang]);


    // ── Retry ─────────────────────────────────────────────────────────────────
    /**
     * Retries the last user message.
     * Pass fileResult (the original UploadResult object) if the message had a file.
     */
    const handleRetry = useCallback((text, fileResult = null) => {
        handleSend(text, { isRetry: true, fileResult });
    }, [handleSend]);


    // ── Feature / starter click ───────────────────────────────────────────────
    const handleFeatureClick = useCallback((text) => {
        if (closeSearchPanel)  closeSearchPanel();
        if (closeMobileSidebar) closeMobileSidebar();
        handleSend(text);
    }, [handleSend, closeSearchPanel, closeMobileSidebar]);


    // ── Delete thread ────────────────────────────────────────────────────────
    const handleDeleteThread = useCallback(async (threadId) => {
        try {
            await deleteThread(threadId);
            handleTabClose(threadId);
        } catch (error) {
            console.error('[useChatActions] Delete failed:', error);
        }
    }, [deleteThread, handleTabClose]);


    // ── Search result click ───────────────────────────────────────────────────
    const handleSearchResultClick = useCallback((thread) => {
        if (closeSearchPanel)  closeSearchPanel();
        if (closeMobileSidebar) closeMobileSidebar();
        // Surface the correct tab; caller (Layout) handles the rest via handleLoadChat
    }, [closeSearchPanel, closeMobileSidebar]);


    // ── Typing complete (streaming finished) ─────────────────────────────────
    const handleTypingComplete = useCallback((sessionId) => {
        setActiveSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, isThinking: false, thinkingSteps: [] } : s
        ));
        if (setFocusTrigger) setFocusTrigger(true);
    }, [setActiveSessions, setFocusTrigger]);


    return {
        handleSend,
        handleRetry,
        handleFeatureClick,
        handleDeleteThread,
        handleSearchResultClick,
        handleTypingComplete,
    };
};

