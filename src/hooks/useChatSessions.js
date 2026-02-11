/**
 * @fileoverview Chat Sessions Management Hook
 * 
 * Manages multiple active chat sessions with tab-like functionality.
 * Supports LRU eviction when max session limit is reached.
 */

import { useState } from 'react';
import { v1 as uuidv1 } from 'uuid';
import ChatService from '../services/chat.service';

/** Maximum concurrent active sessions before LRU eviction */
const MAX_ACTIVE_SESSIONS = 7;

/**
 * Logs errors with detailed context for debugging
 */
const logError = (hookName, method, error, context = {}) => {
    console.error(`[${hookName}.${method}] Error:`, {
        file: 'useChatSessions.js',
        hook: hookName,
        method,
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
    });
};

/**
 * Creates a new session object with default values
 */
const createSession = (id = uuidv1(), title = "New Chat") => ({
    id,
    messages: [],
    inputValue: "",
    title,
    isThinking: false,
    scrollPosition: 0,
    lastAccessedAt: Date.now(),
    selectedFile: null
});

export const useChatSessions = (threads = [], closeMobileSidebar) => {
    const [activeSessions, setActiveSessions] = useState([createSession()]);
    const [activeSessionId, setActiveSessionId] = useState(activeSessions[0].id);

    const activeSession = activeSessions.find(s => s.id === activeSessionId) || activeSessions[0];

    /** Updates fields on the currently active session */
    const updateActiveSession = (fields) => {
        setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, ...fields } : s));
    };

    /**
     * Removes the least recently used session (excluding active)
     */
    const removeLRUSession = (sessions, currentActiveId) => {
        const candidates = sessions.filter(s => s.id !== currentActiveId);
        if (candidates.length === 0) return sessions;

        const lru = candidates.reduce((oldest, s) =>
            s.lastAccessedAt < oldest.lastAccessedAt ? s : oldest
        );
        return sessions.filter(s => s.id !== lru.id);
    };

    /** Creates a new chat session */
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
        } catch (error) {
            logError('useChatSessions', 'handleNewChat', error, { activeSessionId });
        }
    };

    /** Switches to a different tab/session */
    const handleTabClick = (id) => {
        if (activeSessionId === id) return;

        setActiveSessions(prev => prev.map(s =>
            s.id === id ? { ...s, lastAccessedAt: Date.now() } : s
        ));
        setActiveSessionId(id);
    };

    /** Closes a tab/session */
    const handleTabClose = (id) => {
        try {
            if (activeSessions.length === 1) {
                // Reset the last tab instead of closing
                updateActiveSession({
                    messages: [],
                    inputValue: "",
                    title: "New Chat",
                    isThinking: false,
                    id: uuidv1()
                });
                return;
            }

            const newSessions = activeSessions.filter(s => s.id !== id);
            setActiveSessions(newSessions);

            if (activeSessionId === id) {
                setActiveSessionId(newSessions[newSessions.length - 1].id);
            }
        } catch (error) {
            logError('useChatSessions', 'handleTabClose', error, { targetId: id });
        }
    };

    /** Loads a chat thread from history */
    const handleLoadChat = async (threadId) => {
        try {
            if (!threadId) return;

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

            // Create new session with loading state
            const newSession = { ...createSession(threadId, "Loading..."), isThinking: true };

            setActiveSessions(prev => {
                let updated = prev.length >= MAX_ACTIVE_SESSIONS
                    ? removeLRUSession(prev, activeSessionId)
                    : prev;
                return [...updated, newSession];
            });
            setActiveSessionId(threadId);
            closeMobileSidebar?.();

            // Fetch messages from server
            try {
                const messages = await ChatService.getThreadMessages(threadId);
                const thread = threads.find(t => t.threadId === threadId);

                setActiveSessions(prev => prev.map(s => s.id === threadId ? {
                    ...s,
                    messages,
                    title: thread?.title || "Chat",
                    isThinking: false
                } : s));
            } catch (fetchError) {
                logError('useChatSessions', 'handleLoadChat', fetchError, { threadId });
                setActiveSessions(prev => prev.map(s => s.id === threadId ? {
                    ...s,
                    isThinking: false,
                    title: "Failed to load"
                } : s));
            }
        } catch (error) {
            logError('useChatSessions', 'handleLoadChat', error, { threadId });
        }
    };

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
        handleLoadChat
    };
};