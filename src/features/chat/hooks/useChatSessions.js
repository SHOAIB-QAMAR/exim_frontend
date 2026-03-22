import { useState, useEffect, useCallback } from 'react';
import { v1 as uuidv1 } from 'uuid';
import ChatService from '../../../services/chat.service';

/** Maximum concurrent active sessions before LRU eviction */
const MAX_ACTIVE_SESSIONS = 6;
const STORAGE_KEY_SESSIONS = 'CHATS_ACTIVE_SESSIONS';
const STORAGE_KEY_ACTIVE_ID = 'CHATS_ACTIVE_SESSION_ID';



// Creates a new session object with default values

const createSession = (id = uuidv1(), title = "New Chat") => ({
    id,
    sessionId: null, // Backend's session_id — null for new chats, set when loaded from history or promoted
    objectId: null, // Backend's MongoDB _id
    messages: [],
    hasMoreMessages: false,
    messageSkip: 0,
    isLoadingMore: false,
    inputValue: "",
    title,
    isThinking: false,
    isNew: true, // Tracks if this is a brand new chat session (show WelcomeScreen)
    scrollPosition: 0,
    isPinnedToBottom: true,
    lastAccessedAt: Date.now(),
    selectedFile: null,
    contextPanel: { open: false, data: null }
});

export const useChatSessions = (threads = [], closeMobileSidebar) => {
    // ── PERSISTENCE INITIALIZATION ──
    const [activeSessions, setActiveSessions] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Revive dates or other cleanups if needed
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
            console.error("Failed to load sessions from storage", e);
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

    // Updates fields on the currently active session 
    const updateActiveSession = (fields) => {
        console.log("Updating session:", activeSessionId, fields); setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, ...fields } : s));
    };

    // Removes the least recently used session (excluding active)

    const removeLRUSession = (sessions, currentActiveId) => {
        const candidates = sessions.filter(s => s.id !== currentActiveId);
        if (candidates.length === 0) return sessions;

        const lru = candidates.reduce((oldest, s) =>
            s.lastAccessedAt < oldest.lastAccessedAt ? s : oldest
        );
        return sessions.filter(s => s.id !== lru.id);
    };

    // Creates a new chat session 
    const handleNewChat = () => {
        try {
            const newSession = createSession();

            setActiveSessions(prev => {
                let updated = prev.length >= MAX_ACTIVE_SESSIONS
                    ? removeLRUSession(prev, activeSessionId)
                    : prev;
                return [...updated, newSession];
            });

            setActiveSessionId(newSession.id);
            closeMobileSidebar?.();
        } catch {
            // handleNewChat error — silent

        }
    };

    // Switches to a different tab/session
    const handleTabClick = (id) => {
        if (activeSessionId === id) return;

        setActiveSessions(prev => prev.map(s =>
            s.id === id ? { ...s, lastAccessedAt: Date.now() } : s
        ));
        setActiveSessionId(id);
    };

    // Closes a tab/session
    const handleTabClose = (id) => {
        try {
            if (activeSessions.length === 1) {
                // Reset the last tab by replacing it with a fresh session
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
        } catch {
            // handleTabClose error — silent

        }
    };

    // Loads a chat thread from history
    const handleLoadChat = async (threadId) => {
        try {
            if (!threadId) return;

            const thread = threads.find(t => t.threadId === threadId);
            const objectId = thread?.objectId || thread?._id || threadId;

            // Check if already open
            const existing = activeSessions.find(s => s.id === threadId);
            if (existing) {
                setActiveSessions(prev => prev.map(s =>
                    s.id === threadId ? { ...s, lastAccessedAt: Date.now() } : s
                ));
                setActiveSessionId(threadId);
                closeMobileSidebar?.();
                return;
            }

            // Create new session with loading state. Set isNew to false because we are loading from history.
            const newSession = { ...createSession(threadId, "Loading..."), objectId, isThinking: true, isNew: false };

            setActiveSessions(prev => {
                let updated = prev.length >= MAX_ACTIVE_SESSIONS
                    ? removeLRUSession(prev, activeSessionId)
                    : prev;
                return [...updated, newSession];
            });
            setActiveSessionId(threadId);
            console.log(`[Chat] Opened thread: ${threadId}`);
            closeMobileSidebar?.();

            // Fetch messages from server (initial batch - page 1)
            try {
                const response = await ChatService.getThreadMessages(objectId, 1);

                setActiveSessions(prev => prev.map(s => s.id === threadId ? {
                    ...s,
                    messages: response.messages || [],
                    hasMoreMessages: response.hasMore || false,
                    messagePage: 1,
                    title: thread?.title || "Chat",
                    sessionId: thread?.sessionId || thread?.session_id || null,
                    objectId: objectId,
                    isThinking: false
                } : s));
            } catch {

                setActiveSessions(prev => prev.map(s => s.id === threadId ? {
                    ...s,
                    isThinking: false,
                    title: "Failed to load"
                } : s));
            }
        } catch {
            // handleLoadChat error — silent

        }
    };

    // Loads previous (older) messages for the currently active session
    const loadMoreMessages = async () => {
        if (!activeSession || activeSession.isLoadingMore || !activeSession.hasMoreMessages) return;

        updateActiveSession({ isLoadingMore: true });

        try {
            const nextPage = (activeSession.messagePage || 1) + 1;
            const objectId = activeSession.objectId || activeSessionId;
            const response = await ChatService.getThreadMessages(
                objectId,
                nextPage
            );

            if (response && response.messages) {
                setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                    ...s,
                    // Prepend older messages to the top
                    messages: [...response.messages, ...s.messages],
                    hasMoreMessages: response.hasMore,
                    messagePage: nextPage,
                    isLoadingMore: false
                } : s));
            } else {
                updateActiveSession({ isLoadingMore: false });
            }
        } catch {

            updateActiveSession({ isLoadingMore: false });
        }
    };

    // Saves the scroll state silently without triggering full re-renders if possible
    const saveScrollPosition = (sessionId, scrollTop, isPinned) => {
        setActiveSessions(prev => prev.map(s =>
            s.id === sessionId
                ? { ...s, scrollPosition: scrollTop, isPinnedToBottom: isPinned }
                : s
        ));
    };
    // Promotes a new session's temporary local ID to the real backend session_id.
    // Called when the backend responds with a session_id for a brand new chat.
    const promoteSession = useCallback((oldId, newId) => {
        if (!oldId || !newId || oldId === newId) return;

        setActiveSessions(prev => prev.map(s =>
            s.id === oldId ? { ...s, id: newId, sessionId: newId, isNew: false } : s
        ));
        setActiveSessionId(prev => prev === oldId ? newId : prev);

        // Update localStorage keys immediately
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