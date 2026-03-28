/**
 * Tests for useChatActions hook
 * Covers: send, retry, delete, feature click, search results, typing-complete
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Mock ChatService ─────────────────────────────────────────────────────────
const { mockUploadImage } = vi.hoisted(() => ({
    mockUploadImage: vi.fn(),
}));

vi.mock('../services/chat.service', () => ({
    default: { uploadImage: mockUploadImage },
}));

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useChatActions } from '../features/chat/hooks/useChatActions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSession = (overrides = {}) => ({
    id: 'session-1',
    messages: [],
    isThinking: false,
    thinkingSteps: [],
    metrics: null,
    inputValue: '',
    title: 'New Chat',
    selectedFile: null,
    ...overrides,
});

/**
 * Create a wrapper around useChatActions that provides all required dependencies
 * and tracks state changes.
 */
function setupHook(sessionOverrides = {}) {
    const session = makeSession(sessionOverrides);
    let sessions = [session];

    const setActiveSessions = vi.fn((updater) => {
        sessions = typeof updater === 'function' ? updater(sessions) : updater;
    });

    const updateActiveSession = vi.fn((updates) => {
        sessions = sessions.map(s =>
            s.id === session.id ? { ...s, ...updates } : s
        );
    });

    const sendMessage = vi.fn(() => true);
    const deleteThread = vi.fn(() => Promise.resolve(true));
    const handleTabClose = vi.fn();
    const handleNewChat = vi.fn();
    const closeSearchPanel = vi.fn();
    const closeMobileSidebar = vi.fn();
    const setFocusTrigger = vi.fn();

    const deps = {
        activeSession: session,
        activeSessionId: session.id,
        setActiveSessions,
        updateActiveSession,
        sendMessage,
        selectedLang: { name: 'English', language: 'en-IN' },
        deleteThread,
        activeSessions: sessions,
        handleTabClose,
        handleNewChat,
        closeSearchPanel,
        closeMobileSidebar,
        setFocusTrigger,
    };

    const { result } = renderHook(() => useChatActions(deps));

    return {
        result,
        deps,
        getSessions: () => sessions,
    };
}

describe('useChatActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Provide mock customer data so handleSend can build the gpt_query payload
        localStorage.setItem('customer', JSON.stringify({
            result: {
                customerData: { _id: 'cust-1', customerName: 'Test Corp' },
                customerBranchData: { _id: 'branch-1', customerId: 'cust-1', branchName: 'Main', emails: ['test@example.com'] },
                csBuddyData: { _id: 'buddy-1', name: 'Buddy', email: 'buddy@example.com' },
                customerBranchPersonId: 'person-1'
            }
        }));
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ── handleSend ────────────────────────────────────────────────────────
    describe('handleSend', () => {
        it('sends a message and updates session with user message', async () => {
            const { result, deps } = setupHook();

            await act(async () => {
                await result.current.handleSend('Hello world');
            });

            expect(deps.setActiveSessions).toHaveBeenCalled();
            expect(deps.sendMessage).toHaveBeenCalledWith('session-1', expect.objectContaining({ question: 'Hello world' }));
        });

        it('does not send empty text', async () => {
            const { result, deps } = setupHook();

            await act(async () => {
                await result.current.handleSend('   ');
            });

            expect(deps.sendMessage).not.toHaveBeenCalled();
        });

        it('appends an error message when sendMessage returns false', async () => {
            const { result, deps } = setupHook();
            deps.sendMessage.mockReturnValue(false);

            await act(async () => {
                await result.current.handleSend('Hi');
            });

            // setActiveSessions should be called twice — once for optimistic update, once for error
            expect(deps.setActiveSessions).toHaveBeenCalledTimes(2);
        });

        it('sets title from first 4 words when messages array is empty', async () => {
            const { result, deps } = setupHook({ messages: [] });

            await act(async () => {
                await result.current.handleSend('How do I clear customs?');
            });

            // The updater should have been called
            const updater = deps.setActiveSessions.mock.calls[0][0];
            const updated = updater([makeSession({ messages: [] })]);
            expect(updated[0].title).toBe('How do I clear');
        });
    });

    // ── handleRetry ───────────────────────────────────────────────────────
    describe('handleRetry', () => {
        it('removes error and user messages and re-sends', async () => {
            vi.useFakeTimers();
            const messages = [
                { role: 'user', content: 'hi' },
                { role: 'assistant', content: 'Error: something broke', isNew: true }
            ];
            const { result, deps } = setupHook({ messages });

            act(() => {
                result.current.handleRetry(1); // error is at index 1
            });

            expect(deps.updateActiveSession).toHaveBeenCalled();
            const { messages: cleaned } = deps.updateActiveSession.mock.calls[0][0];
            expect(cleaned).toHaveLength(0);

            vi.useRealTimers();
        });

        it('does nothing if message before error is not from user', () => {
            const messages = [
                { role: 'assistant', content: 'previous response' },
                { role: 'assistant', content: 'Error: fail' },
            ];
            const { result, deps } = setupHook({ messages });

            act(() => {
                result.current.handleRetry(1);
            });

            expect(deps.updateActiveSession).not.toHaveBeenCalled();
        });
    });

    // ── handleTypingComplete ──────────────────────────────────────────────
    describe('handleTypingComplete', () => {
        it('marks the message at given index as isNew: false', () => {
            const messages = [
                { role: 'assistant', content: 'Hello', isNew: true }
            ];
            const { result, deps } = setupHook({ messages });

            act(() => {
                result.current.handleTypingComplete(0);
            });

            expect(deps.updateActiveSession).toHaveBeenCalled();
            const { messages: updated } = deps.updateActiveSession.mock.calls[0][0];
            expect(updated[0].isNew).toBe(false);
        });
    });

    // ── handleFeatureClick ────────────────────────────────────────────────
    describe('handleFeatureClick', () => {
        it('sets inputValue on the active session', () => {
            const { result, deps } = setupHook();

            act(() => {
                result.current.handleFeatureClick('What is HS code?');
            });

            expect(deps.updateActiveSession).toHaveBeenCalledWith({ inputValue: 'What is HS code?' });
            expect(deps.setFocusTrigger).toHaveBeenCalledWith(true);
        });
    });

    // ── handleSearchResultClick ───────────────────────────────────────────
    describe('handleSearchResultClick', () => {
        it('sets input and closes panels', () => {
            const { result, deps } = setupHook();

            act(() => {
                result.current.handleSearchResultClick('customs query');
            });

            expect(deps.updateActiveSession).toHaveBeenCalledWith({ inputValue: 'customs query' });
            expect(deps.closeSearchPanel).toHaveBeenCalled();
            expect(deps.closeMobileSidebar).toHaveBeenCalled();
        });
    });

    // ── handleSearchStartChat ─────────────────────────────────────────────
    describe('handleSearchStartChat', () => {
        it('creates a new chat and closes panels', () => {
            vi.useFakeTimers();
            const { result, deps } = setupHook();

            act(() => {
                result.current.handleSearchStartChat('start chat text');
            });

            expect(deps.handleNewChat).toHaveBeenCalled();
            expect(deps.closeSearchPanel).toHaveBeenCalled();
            expect(deps.closeMobileSidebar).toHaveBeenCalled();

            vi.useRealTimers();
        });
    });

    // ── handleDeleteChat ──────────────────────────────────────────────────
    describe('handleDeleteChat', () => {
        it('calls deleteThread and closes tab if active', async () => {
            const { result, deps } = setupHook();

            await act(async () => {
                await result.current.handleDeleteChat('session-1');
            });

            expect(deps.deleteThread).toHaveBeenCalledWith('session-1');
            expect(deps.handleTabClose).toHaveBeenCalledWith('session-1');
        });

        it('does nothing for null threadId', async () => {
            const { result, deps } = setupHook();

            await act(async () => {
                await result.current.handleDeleteChat(null);
            });

            expect(deps.deleteThread).not.toHaveBeenCalled();
        });

        it('does not close tab if deleteThread fails', async () => {
            const { result, deps } = setupHook();
            deps.deleteThread.mockResolvedValue(false);

            await act(async () => {
                await result.current.handleDeleteChat('session-1');
            });

            expect(deps.handleTabClose).not.toHaveBeenCalled();
        });
    });
});
