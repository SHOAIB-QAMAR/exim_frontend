import { useState, useEffect, useCallback, useRef } from 'react';
import ChatService from '../../../services/chat.service';

const STORAGE_KEY_SESSIONS = 'CHATS_ACTIVE_SESSIONS';
const STORAGE_KEY_ACTIVE_ID = 'CHATS_ACTIVE_SESSION_ID';

/**
 * Generates a session ID in the format chat_xxxxxxxxxxxx (12 hex chars).
 */
const generateSessionId = () => {
    return 'chat_' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');
};

/**
 * Creates a default session object structure.
 * 
 * @param {string} [id=generateSessionId()] - Local unique identifier for the tab
 * @param {string} [title="New Chat"] - Display title for the tab
 * @returns {Object} A fresh session state object
 */
const createSession = (id = generateSessionId(), title = "New Chat") => ({
    id,
    sessionId: null, // Backend session_id (used for API calls)
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
    selectedFiles: [],
    contextPanel: { open: false, data: null },
    isVoiceMode: false,     // Per-tab voice mode flag
    liveVoiceMessages: []   // Per-tab voice transcriptions
});

/**
 * useChatSessions Hook
 * 
 * Manages the multi-tab chat state, persistence to localStorage, 
 * and session lifecycle (create, load, switch, close).
 * 
 * @param {Array} sessions - Cached session list from the sidebar/history
 * @param {Function} [closeMobileSidebar] - Callback to close sidebar on interaction
 * @returns {Object} Session state and stable action handlers
 */
export const useChatSessions = (sessions, closeMobileSidebar) => {
    // ── CONCURRENCY GAURD ──
    // Synchronous semaphore to prevent race conditions during rapid pagination triggers.
    // React state updates (isLoadingMore) are asynchronous and can be bypassed by rapid scroll events.
    const loadingRef = useRef(new Set());

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
                        selectedFiles: [], // Clear out any straggling File objects serialized as {}
                        isUploading: false,
                        isVoiceMode: false,        // Voice connections are ephemeral
                        liveVoiceMessages: []      // Clear transcriptions on reload
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
     * Updates specific fields on a specific session by ID.
     */
    const updateSession = useCallback((sessionId, fields) => {
        setActiveSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...fields } : s));
    }, []);

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
     * Loads an existing chat session from history into a tab.
     */
    const handleLoadChat = useCallback(async (session) => {
        try {
            if (!session) return;

            const sessionId = session.sessionId || session._id;

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
                sessionId,
                isThinking: true,
                isNew: false
            };

            setActiveSessions(prev => [...prev, newSession]);
            setActiveSessionId(sessionId);
            closeMobileSidebar?.();

            // Fetch actual messages from backend
            try {
                const response = await ChatService.getSessionMessages(sessionId, 1);
                setActiveSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    messages: response.messages || [],
                    hasMoreMessages: response.hasMore || false,
                    messagePage: 1,
                    title: session?.title || "Chat",
                    sessionId: sessionId,
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

        // Synchronous check to block concurrent executions within the same event loop
        if (loadingRef.current.has(activeSession.id)) return;
        loadingRef.current.add(activeSession.id);

        updateActiveSession({ isLoadingMore: true });

        try {
            const nextPage = (activeSession.messagePage || 1) + 1;
            const detailId = activeSession.sessionId || activeSessionId;
            const response = await ChatService.getSessionMessages(detailId, nextPage);

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
        } finally {
            // Ensure the lock is ALWAYS released, even on error
            loadingRef.current.delete(activeSession.id);
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

    return {
        activeSessions,
        setActiveSessions,
        activeSessionId,
        setActiveSessionId,
        activeSession,
        updateActiveSession,
        updateSession,
        handleNewChat,
        handleTabClick,
        handleTabClose,
        handleLoadChat,
        loadMoreMessages,
        saveScrollPosition
    };
};