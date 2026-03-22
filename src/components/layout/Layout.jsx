import React, { useState, useEffect, useCallback } from 'react';

// Components
import Sidebar from './Sidebar';
import Header from './Header';
import FAQ from '../../features/faq/FAQ';
import SearchPanel from '../../features/search/SearchPanel';
import ChatTabs from '../../features/chat/components/ChatTabs';
import ThreadSwitcher from './ThreadSwitcher';
import ContextPanel from '../../features/context_panel/ContextPanel';
import WelcomeScreen from '../../features/chat/components/WelcomeScreen';
import ChatMessages from '../../features/chat/components/ChatMessages';
import LanguagePicker from '../../features/chat/components/LanguagePicker';

// Context
import { useUI } from '../../providers/UIContext';

// Hooks
import { useThreads } from '../../features/chat/hooks/useThreads';
import { useChatSessions } from '../../features/chat/hooks/useChatSessions';
import { useWebSocket } from '../../features/chat/hooks/useWebSocket';
import { useThinkingTimeout } from '../../features/chat/hooks/useThinkingTimeout';
import { useChatActions } from '../../features/chat/hooks/useChatActions';

// Config
import LANGUAGES from '../../config/languages';

const Layout = () => {
    // ==================== UI CONTEXT ====================
    const {
        sidebarCollapsed, toggleSidebar,
        mobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar,
        searchPanelOpen, openSearchPanel, closeSearchPanel,
        threadSwitcherOpen, setThreadSwitcherOpen,
        showFAQ, setShowFAQ, openFAQ,
        langOpen, setLangOpen
    } = useUI();

    // ==================== LOCAL STATE ====================
    const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);

    // ==================== DATA HOOKS ====================
    const { threads, fetchThreads, deleteThread, moveThreadToTop, isLoading: isThreadsLoading, fetchError, loadMore, hasMore, isFetchingMore } = useThreads();

    const {
        activeSessions,
        setActiveSessions,
        activeSessionId,
        activeSession,
        updateActiveSession,
        handleNewChat,
        handleTabClick,
        handleTabClose,
        handleLoadChat,
        loadMoreMessages,
        saveScrollPosition,
        promoteSession
    } = useChatSessions(threads, closeMobileSidebar);

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
    const { sendMessage } = useWebSocket(activeSessions, setActiveSessions, activeSessionId, fetchThreads, promoteSession, moveThreadToTop);

    const isAnyTabLoading = activeSessions.some(s => s.isThinking || s.messages.some(m => m.isStreaming));

    // ==================== THINKING TIMEOUT ====================
    useThinkingTimeout(activeSessions, setActiveSessions);

    // ==================== CHAT ACTIONS ====================
    const {
        handleSend,
        handleRetry,
        handleTypingComplete,
        handleFeatureClick,
        handleSearchResultClick,
        handleSearchStartChat,
        handleDeleteChat
    } = useChatActions({
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
        setFocusTrigger: setFocusInput
    });

    // ==================== EFFECTS ====================
    // Scroll management is handled inside ChatMessages.

    // ==================== TAB WRAPPERS ====================
    const onTabClick = (id) => { handleTabClick(id); };
    const onNewChatWithScroll = () => { handleNewChat(); };
    const onLoadChatWithScroll = (id) => { handleLoadChat(id); };

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

    // ==================== VISUAL VIEWPORT SYNC ====================
    useEffect(() => {
        const updateHeight = () => {
            const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        updateHeight();
        
        window.addEventListener('resize', updateHeight);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateHeight);
            window.visualViewport.addEventListener('scroll', updateHeight);
        }
        
        return () => {
            window.removeEventListener('resize', updateHeight);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', updateHeight);
                window.visualViewport.removeEventListener('scroll', updateHeight);
            }
        };
    }, []);

    // ==================== RENDER ====================
    return (
        <div 
            className="app-container flex w-full bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 overflow-hidden font-sans"
            style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
        >
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
                onDeleteChat={handleDeleteChat}
                threads={threads}
                currThreadId={activeSessionId}
                onFAQClick={handleFAQClick}
                showFAQ={showFAQ}
                isLoading={isThreadsLoading}
                fetchError={fetchError}
                onRetryFetch={fetchThreads}
                loadMore={loadMore}
                hasMore={hasMore}
                isFetchingMore={isFetchingMore}
            />

            {/* Main Content */}
            <div className="content flex-1 flex flex-col h-screen overflow-hidden relative transition-colors duration-800">

                <Header
                    toggleMobileSidebar={toggleMobileSidebar}
                    selectedLang={selectedLang}
                    onToggleLang={() => setLangOpen(!langOpen)}
                    onOpenThreadSwitcher={() => setThreadSwitcherOpen(true)}
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
                <div className="chat-area flex-1 flex flex-col overflow-hidden bg-[var(--bg-secondary)] transition-colors duration-800 relative">
                    <div className={`flex-1 overflow-hidden w-full h-full relative ${(searchPanelOpen || showFAQ) ? 'blur-[16px] pointer-events-none' : ''}`}>
                        {(activeSession.messages.length === 0 && activeSession.isNew) ? (
                            <WelcomeScreen
                                focusInput={focusInput}
                                setFocusInput={setFocusInput}
                                onFeatureClick={handleFeatureClick}
                                inputValue={activeSession.inputValue}
                                setInputValue={(val) => updateActiveSession({ inputValue: val })}
                                onSend={handleSend}
                                selectedFile={activeSession.selectedFile}
                                setSelectedFile={(file) => updateActiveSession({ selectedFile: file })}
                                disabled={isAnyTabLoading}
                            />
                        ) : (
                            <ChatMessages
                                focusInput={focusInput}
                                setFocusInput={setFocusInput}
                                messages={activeSession.messages}
                                activeSession={activeSession}
                                onTypingComplete={handleTypingComplete}
                                onRetry={handleRetry}
                                onLinkClick={handleLinkClick}
                                inputValue={activeSession.inputValue}
                                setInputValue={(val) => updateActiveSession({ inputValue: val })}
                                onSend={handleSend}
                                selectedFile={activeSession.selectedFile}
                                setSelectedFile={(file) => updateActiveSession({ selectedFile: file })}
                                disabled={isAnyTabLoading}
                                hasMoreMessages={activeSession.hasMoreMessages}
                                isLoadingMore={activeSession.isLoadingMore}
                                onLoadMore={loadMoreMessages}
                                saveScrollPosition={saveScrollPosition}
                            />
                        )}
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
                                <FAQ
                                    onFeatureClick={(text) => { handleFeatureClick(text); setShowFAQ(false); }}
                                    onClose={() => setShowFAQ(false)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Search Panel Overlay (Gemini Style) */}
                    {searchPanelOpen && (
                        <SearchPanel
                            isOpen={searchPanelOpen}
                            onClose={closeSearchPanel}
                            onResultClick={handleSearchResultClick}
                            onStartChat={handleSearchStartChat}
                            onLoadChat={onLoadChatWithScroll}
                            threads={threads}
                        />
                    )}
                </div>
            </div>

            {/* Context Panel */}
            <ContextPanel
                isOpen={activeSession.contextPanel?.open || false}
                onClose={closeContextPanel}
                data={activeSession.contextPanel?.data || null}
            />

            {/* Language Picker */}
            {langOpen && (
                <LanguagePicker
                    selectedLang={selectedLang}
                    onSelectLang={(lang) => { setSelectedLang(lang); setLangOpen(false); }}
                    onClose={() => setLangOpen(false)}
                />
            )}

            {/* Thread Switcher (Mobile) */}
            <ThreadSwitcher
                isOpen={threadSwitcherOpen}
                onClose={() => setThreadSwitcherOpen(false)}
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