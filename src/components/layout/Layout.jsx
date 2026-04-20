import React, { useState, useEffect, useCallback } from 'react';

// Components
import Sidebar from './Sidebar';
import Header from './Header';
import ChatTabs from '../../features/chat/components/ChatTabs';
import SessionSwitcher from './SessionSwitcher';
import WelcomeScreen from '../../features/chat/components/WelcomeScreen';
import ChatMessages from '../../features/chat/components/ChatMessages';
import LanguagePicker from '../../features/chat/components/LanguagePicker';

const FAQ = React.lazy(() => import('../../features/faq/FAQ'));
const SearchPanel = React.lazy(() => import('../../features/search/SearchPanel'));
const ContextPanel = React.lazy(() => import('../../features/context_panel/ContextPanel'));

// Context
import { useUI } from '../../providers/UIContext';

// Hooks
import { useSessions } from '../../features/chat/hooks/useSessions';
import { useChatSessions } from '../../features/chat/hooks/useChatSessions';
import { useWebSocket } from '../../features/chat/hooks/useWebSocket';
import { useThinkingTimeout } from '../../features/chat/hooks/useThinkingTimeout';
import { useChatActions } from '../../features/chat/hooks/useChatActions';

// Config
import LANGUAGES from '../../config/languages';
import useKeyboardHeight from '../../hooks/useKeyboardHeight';
import ChatService from '../../services/chat.service';

/**
 * The main layout coordinator for the EximGPT application.
 * Manages UI state (sidebars, panels), data fetching (sessions), 
 * and orchestration between Header, Sidebar, Chat Area, and Context Panels.
 */
const Layout = () => {
    // ==================== INTERFACE STATE (UI CONTEXT) ====================
    const {
        sidebarCollapsed, toggleSidebar,
        mobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar,
        searchPanelOpen, openSearchPanel, closeSearchPanel,
        sessionSwitcherOpen, setSessionSwitcherOpen,
        showFAQ, setShowFAQ, openFAQ,
        langOpen, setLangOpen
    } = useUI();

    const [selectedLang, setSelectedLang] = useState(() => {
        const savedLang = localStorage.getItem('selectedLanguage');
        if (savedLang) {
            const found = LANGUAGES.find(l => l.name === savedLang);
            if (found) return found;
        }
        return LANGUAGES[0];
    });


    // Writes --keyboard-height CSS variable whenever the virtual keyboard appears/disappears
    useKeyboardHeight();

    // ==================== DATA HOOKS ====================
    const { sessions, fetchSessions, deleteSession, moveSessionToTop, isLoading: isSessionsLoading, loadMore, hasMore, isFetchingMore } = useSessions();

    const {
        activeSessions,
        setActiveSessions,
        activeSessionId,
        activeSession,
        updateActiveSession,
        updateSession,
        handleNewChat,
        handleTabClick,
        handleTabClose,
        handleLoadChat,
        loadMoreMessages,
        saveScrollPosition
    } = useChatSessions(closeMobileSidebar);

    // ==================== PANEL HANDLERS ====================
    const openContextPanel = (data) => {
        updateActiveSession({ contextPanel: { open: true, data } });
    };

    const closeContextPanel = useCallback(() => {
        updateActiveSession({ contextPanel: { ...activeSession.contextPanel, open: false } });
    }, [activeSession.contextPanel, updateActiveSession]);

    // ==================== SCROLL MANAGEMENT ====================
    const [focusInput, setFocusInput] = useState(false);

    // ==================== WEBSOCKET ====================
    const { sendMessage } = useWebSocket(activeSessions, setActiveSessions, activeSessionId, fetchSessions, moveSessionToTop);

    const isAnyTabLoading = activeSessions.some(s => s.isThinking || s.messages.some(m => m.isStreaming));

    // ==================== THINKING TIMEOUT ====================
    useThinkingTimeout(activeSessions, setActiveSessions);

    // ==================== CHAT ACTIONS ====================
    const {
        handleSend,
        handleTypingComplete,
        handleFeatureClick,
        handleSearchResultClick,
        handleSearchStartChat,
        handleDeleteSession
    } = useChatActions({
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
        setFocusTrigger: setFocusInput
    });

    // ==================== EFFECTS ====================
    // Persistence: Store language choice in localStorage
    useEffect(() => {
        localStorage.setItem('selectedLanguage', selectedLang.name);
    }, [selectedLang]);

    // Scroll management is handled inside ChatMessages.

    // ==================== TAB WRAPPERS ====================
    // When switching tabs, state is preserved. Mic auto-closes only when another tab activates mic.
    const onTabClick = (id) => { handleTabClick(id); };
    const onNewChatWithScroll = () => { handleNewChat(); };
    const onLoadChatWithScroll = (session) => { handleLoadChat(session); };

    const handleFAQClick = () => { openFAQ(); };

    // Escape key for context panel
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && activeSession.contextPanel?.open) {
                closeContextPanel();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [activeSession.contextPanel?.open, closeContextPanel]);

    const handleLinkClick = (url) => {
        openContextPanel({ title: 'Reference', type: 'link', content: url });
    };

    // ==================== RENDER ====================
    return (
        <div className="app-container relative flex h-[100dvh] w-full bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 overflow-hidden font-sans">
            {/* Background Gradient */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,var(--brand-primary),transparent_70%)] opacity-[0.15] blur-3xl pointer-events-none z-0"></div>

            {/* Sidebar */}
            <Sidebar
                collapsed={sidebarCollapsed}
                toggleSidebar={toggleSidebar}
                isOpenMobile={mobileSidebarOpen}
                closeMobileSidebar={closeMobileSidebar}
                onSearchClick={openSearchPanel}
                onNewChat={onNewChatWithScroll}
                onLoadChat={onLoadChatWithScroll}
                onDeleteSession={handleDeleteSession}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onFAQClick={handleFAQClick}
                showFAQ={showFAQ}
                isLoading={isSessionsLoading}
                loadMore={loadMore}
                hasMore={hasMore}
                isFetchingMore={isFetchingMore}
            />

            {/* Main Content */}
            <div className="content flex-1 flex flex-col h-[100dvh] overflow-hidden relative transition-colors duration-800">

                <Header
                    toggleMobileSidebar={toggleMobileSidebar}
                    selectedLang={selectedLang}
                    onToggleLang={() => setLangOpen(!langOpen)}
                    onOpenThreadSwitcher={() => setSessionSwitcherOpen(true)}
                    onNewChat={onNewChatWithScroll}
                />

                {/* Desktop Tab Bar */}
                <div className="hidden desktop-ui-visible">
                    <ChatTabs
                        tabs={activeSessions}
                        activeTabId={activeSessionId}
                        onTabClick={onTabClick}
                        onTabClose={handleTabClose}
                        onNewTab={onNewChatWithScroll}
                    />
                </div>

                {/* Chat Area */}
                <div id="chat-area-container" className="chat-area flex-1 flex flex-col overflow-hidden bg-[var(--bg-secondary)] transition-colors duration-800 relative">
                    <div className={`flex-1 overflow-hidden w-full h-full relative ${(searchPanelOpen || showFAQ) ? 'blur-[16px] pointer-events-none' : ''}`}>
                        {activeSessions.map((session) => {
                            const isActive = session.id === activeSessionId;

                            const isVoiceMode = session.isVoiceMode || false;
                            const liveVoiceMessages = session.liveVoiceMessages || [];

                            const setSessionInputValue = (val) => { updateSession(session.id, { inputValue: val }); };

                            const setSessionSelectedFiles = (updater) => {
                                if (typeof updater === 'function') {
                                    setActiveSessions(prev => prev.map(s => s.id === session.id
                                        ? { ...s, selectedFiles: updater(s.selectedFiles || []) }
                                        : s
                                    ));
                                } else {
                                    updateSession(session.id, { selectedFiles: updater });
                                }
                            };

                            const setSessionVoiceMode = (val) => {
                                const newValue = typeof val === 'function' ? val(session.isVoiceMode || false) : val;
                                if (newValue === true) {
                                    setActiveSessions(prev => prev.map(s =>
                                        s.id === session.id
                                            ? { ...s, isVoiceMode: true }
                                            : { ...s, isVoiceMode: false, liveVoiceMessages: [] }
                                    ));
                                } else {
                                    updateSession(session.id, { isVoiceMode: false });


                                    // 1. Refresh Sidebar History
                                    fetchSessions().then(fetchedSessions => {
                                        if (fetchedSessions) {
                                            const fetchId = session.sessionId || session.id;
                                            const updatedSession = fetchedSessions.find(s => s.sessionId === fetchId);
                                            if (updatedSession?.title) {
                                                updateSession(session.id, { title: updatedSession.title });
                                            }
                                        }
                                    });


                                    // 2. Fetch Tab Message History
                                    const fetchId = session.sessionId || session.id;
                                    ChatService.getSessionMessages(fetchId, 1)
                                        .then(res => {
                                            const refreshedMessages = res.messages || [];
                                            updateSession(session.id, {
                                                messages: refreshedMessages,
                                                hasMoreMessages: res.hasMore || false,
                                                messagePage: 1,
                                                isNew: refreshedMessages.length === 0,
                                                sessionId: res.sessionId || fetchId
                                            });
                                        })
                                        .catch(err => {
                                            console.error("[VoiceRefresh] Failed to fetch session messages:", err);
                                        });
                                }
                            };

                            const setSessionLiveVoiceMessages = (val) => {
                                updateSession(session.id, { liveVoiceMessages: typeof val === 'function' ? val(session.liveVoiceMessages || []) : val });
                            };

                            return (
                                <div key={session.id} className={`w-full h-full ${isActive ? 'block' : 'hidden'}`}>
                                    {(session.messages.length === 0 && session.isNew && !isVoiceMode) ? (
                                        <WelcomeScreen
                                            focusInput={isActive ? focusInput : false}
                                            setFocusInput={setFocusInput}
                                            onFeatureClick={handleFeatureClick}
                                            inputValue={session.inputValue}
                                            setInputValue={setSessionInputValue}
                                            onSend={handleSend}
                                            selectedFiles={session.selectedFiles}
                                            setSelectedFiles={setSessionSelectedFiles}
                                            disabled={isAnyTabLoading}
                                            selectedLang={selectedLang}
                                            activeSessionId={session.id}
                                            isVoiceMode={isVoiceMode}
                                            setIsVoiceMode={setSessionVoiceMode}
                                            setLiveVoiceMessages={setSessionLiveVoiceMessages}
                                        />
                                    ) : (
                                        <ChatMessages
                                            focusInput={isActive ? focusInput : false}
                                            setFocusInput={setFocusInput}
                                            messages={isVoiceMode ? liveVoiceMessages : session.messages}
                                            activeSession={session}
                                            onTypingComplete={handleTypingComplete}
                                            onLinkClick={handleLinkClick}
                                            inputValue={session.inputValue}
                                            setInputValue={setSessionInputValue}
                                            onSend={handleSend}
                                            selectedFiles={session.selectedFiles}
                                            setSelectedFiles={setSessionSelectedFiles}
                                            disabled={isAnyTabLoading}
                                            hasMoreMessages={isVoiceMode ? false : session.hasMoreMessages}
                                            isLoadingMore={isVoiceMode ? false : session.isLoadingMore}
                                            onLoadMore={loadMoreMessages}
                                            saveScrollPosition={saveScrollPosition}
                                            selectedLang={selectedLang}
                                            activeSessionId={session.id}
                                            isVoiceMode={isVoiceMode}
                                            setIsVoiceMode={setSessionVoiceMode}
                                            setLiveVoiceMessages={setSessionLiveVoiceMessages}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* FAQ Overlay */}
                    {showFAQ && (
                        <div
                            className="absolute inset-0 z-20 flex items-center justify-center p-8 bg-[var(--bg-primary)]/60 backdrop-blur animate-in fade-in duration-300"
                            onClick={() => setShowFAQ(false)}
                        >
                            <div
                                className="w-full max-w-4xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl p-6 overflow-y-auto max-h-full"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <React.Suspense fallback={<div className="flex items-center justify-center h-64"><span className="animate-spin w-8 h-8 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full" /></div>}>
                                    <FAQ
                                        onFeatureClick={(text) => { handleFeatureClick(text); setShowFAQ(false); }}
                                        onClose={() => setShowFAQ(false)}
                                    />
                                </React.Suspense>
                            </div>
                        </div>
                    )}

                    {/* Search Panel Overlay (Gemini Style) */}
                    {searchPanelOpen && (
                        <React.Suspense fallback={null}>
                            <SearchPanel
                                isOpen={searchPanelOpen}
                                onClose={closeSearchPanel}
                                onResultClick={handleSearchResultClick}
                                onStartChat={handleSearchStartChat}
                                onLoadChat={onLoadChatWithScroll}
                                sessions={sessions}
                            />
                        </React.Suspense>
                    )}
                </div>
            </div>

            {/* Context Panel */}
            <React.Suspense fallback={null}>
                <ContextPanel
                    isOpen={activeSession.contextPanel?.open || false}
                    onClose={closeContextPanel}
                    data={activeSession.contextPanel?.data || null}
                />
            </React.Suspense>

            {/* Language Picker */}
            {langOpen && (
                <LanguagePicker
                    selectedLang={selectedLang}
                    onSelectLang={(lang) => { setSelectedLang(lang); setLangOpen(false); }}
                    onClose={() => setLangOpen(false)}
                />
            )}

            {/* Session Switcher (Mobile) */}
            <SessionSwitcher
                isOpen={sessionSwitcherOpen}
                onClose={() => setSessionSwitcherOpen(false)}
                sessions={activeSessions}
                activeSessionId={activeSessionId}
                onSelectSession={onTabClick}
                onCloseSession={handleTabClose}
                onNewChat={onNewChatWithScroll}
            />
        </div>
    );
};

export default Layout;