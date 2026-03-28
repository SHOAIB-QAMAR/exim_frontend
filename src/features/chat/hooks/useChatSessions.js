import { useState, useEffect, useCallback } from 'react';
import { v1 as uuidv1 } from 'uuid';
import ChatService from '../../../services/chat.service';

const STORAGE_KEY_SESSIONS = 'CHATS_ACTIVE_SESSIONS';
const STORAGE_KEY_ACTIVE_ID = 'CHATS_ACTIVE_SESSION_ID';

/**
 * Creates a default session object structure.
 * 
 * @param {string} [id=uuidv1()] - Local unique identifier for the tab
 * @param {string} [title="New Chat"] - Display title for the tab
 * @returns {Object} A fresh session state object
 */
const createSession = (id = uuidv1(), title = "New Chat") => ({
    id,
    sessionId: null, // Backend session_id (used for API calls)
    objectId: null,  // Backend MongoDB _id (used for history lookups)
    messages: [],
    hasMoreMessages: false,
    messagePage: 1,  // Track pagination locally
    isLoadingMore: false,
    inputValue: "",
    title,
    isThinking: false,
    isNew: true, // If true, shows the WelcomeScreen instead of ChatMessages
    scrollPosition: 0,
    isPinnedToBottom: true,
    lastAccessedAt: Date.now(),
    selectedFile: null,
    contextPanel: { open: false, data: null }
});

/**
 * useChatSessions Hook
 * 
 * Manages the multi-tab chat state, persistence to localStorage, 
 * and session lifecycle (create, load, switch, close).
 * 
 * @param {Array} threads - Cached thread list from the sidebar/history
 * @param {Function} [closeMobileSidebar] - Callback to close sidebar on interaction
 * @returns {Object} Session state and stable action handlers
 */
export const useChatSessions = (threads, closeMobileSidebar) => {
    // ── PERSISTENCE INITIALIZATION ──
    const [activeSessions, setActiveSessions] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Cleanup volatile states before initializing from storage
                    return parsed.map(s => ({
                        ...s,
                        isThinking: false, // Don't persist thinking state across refresh
                        isLoadingMore: false,
                        selectedFile: null, // Clear out any straggling File objects serialized as {}
                        isUploading: false
                    }));
                }
            }
        } catch (e) {
            console.error("[useChatSessions] Storage load failed:", e);
        }
        return [createSession()];
    });

    const [activeSessionId, setActiveSessionId] = useState(() => {
        const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
        if (savedId && activeSessions.some(s => s.id === savedId)) {
            return savedId;
        }
        return activeSessions[0].id;
    });

    // ── PERSISTENCE EFFECT ──
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(activeSessions));
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeSessionId);
    }, [activeSessions, activeSessionId]);

    const activeSession = activeSessions.find(s => s.id === activeSessionId) || activeSessions[0];

    /**
     * Updates specific fields on the currently active session.
     */
    const updateActiveSession = useCallback((fields) => {
        setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, ...fields } : s));
    }, [activeSessionId]);

    /**
     * Creates a brand new chat session and switches to it.
     */
    const handleNewChat = useCallback(() => {
        try {
            const newSession = createSession();
            setActiveSessions(prev => [...prev, newSession]);
            setActiveSessionId(newSession.id);
            closeMobileSidebar?.();
        } catch (e) {
            console.warn("[useChatSessions] New chat error:", e);
        }
    }, [closeMobileSidebar]);

    /**
     * Switches the UI to a different tab/session.
     */
    const handleTabClick = useCallback((id) => {
        if (activeSessionId === id) return;
        setActiveSessions(prev => prev.map(s =>
            s.id === id ? { ...s, lastAccessedAt: Date.now() } : s
        ));
        setActiveSessionId(id);
    }, [activeSessionId]);

    /**
     * Closes a specific tab and manages active ID fallback.
     */
    const handleTabClose = useCallback((id) => {
        try {
            if (activeSessions.length === 1) {
                // If closing the last tab, reset to a fresh empty session
                const freshSession = createSession();
                setActiveSessions([freshSession]);
                setActiveSessionId(freshSession.id);
                return;
            }

            const newSessions = activeSessions.filter(s => s.id !== id);
            setActiveSessions(newSessions);

            if (activeSessionId === id) {
                setActiveSessionId(newSessions[newSessions.length - 1].id);
            }
        } catch (e) {
            console.warn("[useChatSessions] Tab close error:", e);
        }
    }, [activeSessions, activeSessionId]);

    /**
     * Loads an existing chat thread from history into a tab.
     */
    const handleLoadChat = useCallback(async (thread) => {
        try {
            if (!thread) return;

            const objectId = thread.objectId || thread._id;
            const sessionId = thread.sessionId || objectId;

            // Check if already open in a tab
            const existing = activeSessions.find(s => s.id === sessionId);
            if (existing) {
                setActiveSessions(prev => prev.map(s =>
                    s.id === sessionId ? { ...s, lastAccessedAt: Date.now() } : s
                ));
                setActiveSessionId(sessionId);
                closeMobileSidebar?.();
                return;
            }

            // Create placeholder session with loading indicator
            const newSession = {
                ...createSession(sessionId, "Loading..."),
                objectId,
                sessionId,
                isThinking: true,
                isNew: false
            };

            setActiveSessions(prev => [...prev, newSession]);
            setActiveSessionId(sessionId);
            closeMobileSidebar?.();

            // Fetch actual messages from backend
            try {
                const response = await ChatService.getThreadMessages(objectId, 1);
                setActiveSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    messages: response.messages || [],
                    hasMoreMessages: response.hasMore || false,
                    messagePage: 1,
                    title: thread?.title || "Chat",
                    sessionId: thread?.sessionId || thread?.session_id || null,
                    objectId: objectId,
                    isThinking: false
                } : s));
            } catch (error) {
                console.error("[useChatSessions] Load messages error:", error);
                setActiveSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    isThinking: false,
                    title: "Failed to load"
                } : s));
            }
        } catch (e) {
            console.warn("[useChatSessions] Load chat error:", e);
        }
    }, [activeSessions, closeMobileSidebar]);

    /**
     * Paginates older messages for the currently active session.
     */
    const loadMoreMessages = useCallback(async () => {
        if (!activeSession || activeSession.isLoadingMore || !activeSession.hasMoreMessages) return;

        updateActiveSession({ isLoadingMore: true });

        try {
            const nextPage = (activeSession.messagePage || 1) + 1;
            const objectId = activeSession.objectId || activeSessionId;
            const response = await ChatService.getThreadMessages(objectId, nextPage);

            if (response && response.messages) {
                setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                    ...s,
                    messages: [...response.messages, ...s.messages],
                    hasMoreMessages: response.hasMore,
                    messagePage: nextPage,
                    isLoadingMore: false
                } : s));
            } else {
                updateActiveSession({ isLoadingMore: false });
            }
        } catch (error) {
            console.error("[useChatSessions] Load more error:", error);
            updateActiveSession({ isLoadingMore: false });
        }
    }, [activeSession, activeSessionId, updateActiveSession]);

    /**
     * Persists scroll position for a specific session.
     */
    const saveScrollPosition = useCallback((sessionId, scrollTop, isPinned) => {
        setActiveSessions(prev => prev.map(s =>
            s.id === sessionId
                ? { ...s, scrollPosition: scrollTop, isPinnedToBottom: isPinned }
                : s
        ));
    }, []);

    /**
     * Promotes a temporary local session to a backend-persisted session.
     * Called when the first message is successfully processed by the server.
     */
    const promoteSession = useCallback((oldId, newId) => {
        if (!oldId || !newId || oldId === newId) return;

        setActiveSessions(prev => prev.map(s =>
            s.id === oldId ? { ...s, id: newId, sessionId: newId, isNew: false } : s
        ));
        setActiveSessionId(prev => prev === oldId ? newId : prev);

        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newId);
    }, []);

    return {
        activeSessions,
        setActiveSessions,
        activeSessionId,
        setActiveSessionId,
        activeSession,
        updateActiveSession,
        handleNewChat,
        handleTabClick,
        handleTabClose,
        handleLoadChat,
        loadMoreMessages,
        saveScrollPosition,
        promoteSession
    };
};