import React, { useState, useEffect, useRef, useCallback } from 'react';

// Components
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import FAQ from '../components/features/FAQ';
import StarterGrid from '../components/features/StarterGrid';
import InputArea from '../components/chat/InputArea';
import SearchPanel from '../components/features/SearchPanel';
import ChatTabs from '../components/chat/ChatTabs';
import ThreadSwitcher from '../components/layout/ThreadSwitcher';
import LogisticsLoader from '../components/common/LogisticsLoader';
import MessageContent, { TypingMessage } from '../components/chat/MessageContent';
import ContextPanel from '../components/features/ContextPanel';
import AIProcessingDropdown from '../components/chat/AIProcessingDropdown';

// Context
import { useUI } from '../context/UIContext';

// Hooks
import { useThreads } from '../hooks/useThreads';
import { useChatSessions } from '../hooks/useChatSessions';
import { useWebSocket } from '../hooks/useWebSocket';

// Services & Config
import ChatService from '../services/chat.service';
import LANGUAGES from '../config/languages';

/**
 * Logs errors with detailed context for debugging
 */
const logError = (component, method, error, context = {}) => {
    console.error(`[${component}.${method}] Error:`, {
        file: 'Layout.jsx',
        component,
        method,
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
    });
};

const Layout = () => {
    // ==================== UI CONTEXT ====================
    const {
        sidebarCollapsed, toggleSidebar,
        mobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar,
        searchPanelOpen, openSearchPanel, closeSearchPanel,
        contextPanelData, openContextPanel, closeContextPanel,
        threadSwitcherOpen, setThreadSwitcherOpen,
        showFAQ, setShowFAQ,
        langOpen, setLangOpen
    } = useUI();

    // ==================== LOCAL STATE ====================
    // Language state is kept local for now as it's specific to the Header/Input interplay
    // and distinct from "UI visibility" state.
    const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
    const [langSearchTerm, setLangSearchTerm] = useState("");

    const filteredLanguages = LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(langSearchTerm.toLowerCase())
    );

    // ==================== DATA HOOKS ====================
    const { threads, deleteThread, isLoading: isThreadsLoading } = useThreads();

    const {
        activeSessions,
        setActiveSessions,
        activeSessionId,
        activeSession, // The currently visible chat session object
        updateActiveSession, // Function to update state of current session (e.g. typing input)
        handleNewChat,
        handleTabClick, // Handles switching between chat tabs
        handleTabClose,
        handleLoadChat
    } = useChatSessions(threads, closeMobileSidebar);

    // ==================== SCROLL MANAGEMENT ====================
    // We use a sticky scroll mechanism: if the user is at the bottom, stay at the bottom.
    // If they scroll up, don't force them down when new messages arrive.
    const chatContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const prevSessionIdRef = useRef(activeSessionId);
    const lastScrollTimeRef = useRef(0);
    const isStickyRef = useRef(true); // Tracks if we should auto-scroll to bottom

    const handleScroll = () => {
        if (!chatContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        // 10px threshold to determine if user is "at the bottom"
        isStickyRef.current = scrollHeight - scrollTop - clientHeight <= 10;
    };

    const scrollToBottom = useCallback((force = false) => {
        if (!chatContainerRef.current) return;
        const now = Date.now();
        if (!force && now - lastScrollTimeRef.current < 50) return;
        lastScrollTimeRef.current = now;

        if (force || isStickyRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    const saveCurrentScroll = () => {
        if (chatContainerRef.current) {
            updateActiveSession({ scrollPosition: chatContainerRef.current.scrollTop });
        }
    };

    // ==================== WEBSOCKET ====================
    // useWebSocket hook handles the actual connection and message reception.
    // It provides the 'sendMessage' function which we use in handleSend.
    const { sendMessage } = useWebSocket(activeSessions, setActiveSessions, activeSessionId, scrollToBottom);

    // Check if any tab is currently loading (disables send on all tabs)
    const isAnyTabLoading = activeSessions.some(s => s.isThinking || s.messages.some(m => m.isStreaming));

    // ==================== EFFECTS ====================

    // Auto-scroll when session changes or messages update
    useEffect(() => {
        if (activeSessionId !== prevSessionIdRef.current) {
            if (chatContainerRef.current) {
                requestAnimationFrame(() => {
                    if (chatContainerRef.current) {
                        chatContainerRef.current.scrollTop = activeSession.scrollPosition || 0;
                    }
                });
            }
            prevSessionIdRef.current = activeSessionId;
        } else {
            scrollToBottom();
        }
    }, [activeSession.messages.length, activeSession.isThinking, activeSessionId, activeSession.scrollPosition, scrollToBottom]);

    // Note: Global Escape key listener is now handled in UIContext

    // ==================== EVENT HANDLERS ====================

    const onTabClick = (id) => { saveCurrentScroll(); handleTabClick(id); };
    const onNewChatWithScroll = () => { saveCurrentScroll(); handleNewChat(); };
    const onLoadChatWithScroll = (id) => { saveCurrentScroll(); handleLoadChat(id); };

    const handleTypingComplete = (index) => {
        const newMessages = activeSession.messages.map((msg, i) =>
            i === index ? { ...msg, isNew: false } : msg
        );
        updateActiveSession({ messages: newMessages });
    };

    /** 
     * Handles sending a chat message.
     * 1. Validates input
     * 2. Uploads image if present
     * 3. Optimistically updates UI with user message and "Thinking..." state
     * 4. Sends payload via WebSocket
     * 5. Handles immediate failures (e.g. network down)
     */
    const handleSend = async (text) => {
        try {
            if (!text.trim() && !activeSession.selectedFile) return;

            const timestamp = Date.now();
            let userMsg = { role: 'user', content: text, timestamp };
            let uploadedImageUrl = null;

            // Handle image upload if present
            if (activeSession.selectedFile) {
                const blobUrl = URL.createObjectURL(activeSession.selectedFile);
                userMsg.image = blobUrl;

                try {
                    const response = await ChatService.uploadImage(activeSession.selectedFile);
                    uploadedImageUrl = response.url;
                } catch (uploadError) {
                    logError('Layout', 'handleSend', uploadError, { operation: 'image upload' });
                }
            }

            // Optimistic UI update
            const newTitle = activeSession.messages.length === 0
                ? text.split(' ').slice(0, 4).join(' ')
                : activeSession.title;

            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, userMsg],
                inputValue: "",
                isThinking: true,
                title: newTitle,
                selectedFile: null
            } : s));

            setTimeout(() => scrollToBottom(true), 10);

            // Prepare and send payload
            const payload = JSON.stringify({
                content: text,
                image: uploadedImageUrl || null,
                language: selectedLang.name
            });

            const sent = sendMessage(activeSessionId, payload);

            if (!sent) {
                setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                    ...s,
                    isThinking: false,
                    messages: [...s.messages, {
                        role: 'assistant',
                        content: "Error: Connection failed. Please try again.",
                        isNew: true,
                        timestamp: Date.now()
                    }]
                } : s));
            }
        } catch (error) {
            logError('Layout', 'handleSend', error, { activeSessionId });
            setActiveSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                isThinking: false,
                messages: [...s.messages, {
                    role: 'assistant',
                    content: `Error: Could not send message. ${error.message}`,
                    isNew: true,
                    timestamp: Date.now()
                }]
            } : s));
        }
    };

    const handleFeatureClick = (text) => {
        updateActiveSession({ inputValue: text });
        document.querySelector('.chat-input')?.focus();
    };

    const handleSearchResultClick = (text) => {
        updateActiveSession({ inputValue: text });
        closeSearchPanel();
        closeMobileSidebar();
        document.querySelector('.chat-input')?.focus();
    };

    const handleSearchStartChat = (text) => {
        saveCurrentScroll();
        handleNewChat();
        setTimeout(() => {
            setActiveSessions(prev => {
                const last = prev[prev.length - 1];
                return prev.map(s => s.id === last.id ? { ...s, inputValue: text } : s);
            });
            document.querySelector('.chat-input')?.focus();
        }, 50);
        closeSearchPanel();
        closeMobileSidebar();
    };

    /**
     * Handlers for Sidebar
     */
    // toggleSidebar is imported from context and passed down

    // openSearchPanel is imported from context and passed down

    /**
     * Delete a chat thread
     */
    const handleDeleteChat = async (threadId) => {
        if (!threadId) return;

        const success = await deleteThread(threadId);
        if (success) {
            // If the deleted thread was active, close it or switch to another
            const isActive = activeSessions.some(s => s.id === threadId);
            if (isActive) {
                handleTabClose(threadId);
            }
        }
    };

    const handleFAQClick = () => {
        setShowFAQ(true);
    };

    const handleLinkClick = (url) => {
        openContextPanel({ title: 'Reference', type: 'link', content: url });
    };

    // ==================== RENDER ====================
    return (
        <div className="app-container flex h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 overflow-hidden font-sans">
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
                <div className={`chat-area flex-1 flex flex-col overflow-hidden bg-[var(--bg-secondary)] transition-colors duration-800 relative ${searchPanelOpen ? 'blur-[3px] pointer-events-none' : ''}`}>
                    <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto w-full h-full relative">
                        {activeSession.messages.length === 0 ? (
                            /* Welcome State */
                            <div className="relative flex flex-col h-full bg-gradient-to-b from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]/30">
                                <div className="flex-1 flex flex-col justify-center items-center overflow-y-auto custom-scrollbar w-full px-4 pb-4">
                                    <div className="flex flex-col items-center w-full max-w-[1000px]">
                                        <h2 className="md:hidden text-[24px] font-semibold mb-6 text-center tracking-tight drop-shadow-sm bg-gradient-to-r from-[var(--brand-primary)] to-[var(--text-primary)] bg-clip-text text-transparent">
                                            How can I help?
                                        </h2>
                                        <h2 className="hidden md:block text-[32px] font-semibold mb-10 text-center tracking-tight drop-shadow-sm bg-gradient-to-r from-[var(--brand-primary)] to-[var(--text-primary)] bg-clip-text text-transparent">
                                            How can I streamline your logistics today?
                                        </h2>
                                        <StarterGrid onStarterClick={handleFeatureClick} />
                                    </div>
                                </div>
                                <div className="shrink-0 w-full bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pt-4 pb-4 md:pb-8 px-4">
                                    <div className="max-w-[900px] mx-auto">
                                        <InputArea
                                            inputValue={activeSession.inputValue}
                                            setInputValue={(val) => updateActiveSession({ inputValue: val })}
                                            onSend={handleSend}
                                            mode="bottom"
                                            selectedFile={activeSession.selectedFile}
                                            setSelectedFile={(file) => updateActiveSession({ selectedFile: file })}
                                            disabled={isAnyTabLoading}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Chat Messages */
                            <div className="flex flex-col min-h-full">
                                <div className="flex-1 w-full max-w-5xl mx-auto px-2 md:px-6 py-4 space-y-3 md:space-y-4 pb-32">
                                    {activeSession.messages.map((msg, idx) => {
                                        // Check if this is the last assistant message (for dropdown + metrics placement)
                                        const isLastAssistantMsg = msg.role === 'assistant' &&
                                            idx === activeSession.messages.length - 1;

                                        // Show dropdown in last assistant message if we have steps or metrics
                                        const showDropdownInAssistant = isLastAssistantMsg &&
                                            (activeSession.thinkingSteps?.length > 0 || activeSession.metrics);

                                        const isProcessingComplete = !activeSession.isThinking &&
                                            (activeSession.thinkingSteps?.length > 0 || activeSession.metrics);

                                        return (
                                            <React.Fragment key={idx}>
                                                {/* User Message */}
                                                {msg.role === 'user' && (
                                                    <div className="flex gap-2 md:gap-4 justify-end">
                                                        <div className="px-3 py-2.5 md:p-4 rounded-2xl leading-relaxed text-[13px] sm:text-sm md:text-base animate-fade-in-up max-w-[70%] md:max-w-[80%] bg-[var(--brand-primary)]/15 border border-[var(--brand-primary)]/20 text-[var(--text-primary)] rounded-tr-sm">
                                                            {msg.image && (
                                                                <img
                                                                    src={msg.image.startsWith('blob:') ? msg.image : `http://localhost:8080${msg.image}`}
                                                                    alt="Attached"
                                                                    className="max-w-full max-h-36 rounded-lg mb-2 border border-[var(--border-color)]"
                                                                />
                                                            )}
                                                            {msg.content}
                                                        </div>
                                                        <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">U</div>
                                                    </div>
                                                )}

                                                {/* Assistant Message - Combined block with dropdown + response */}
                                                {msg.role === 'assistant' && (
                                                    <div className="flex gap-2 md:gap-4 justify-start">
                                                        <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">A</div>
                                                        <div className="w-full md:max-w-[85%] animate-fade-in-up">
                                                            {/* AI Processing Dropdown - ABOVE the response text */}
                                                            {showDropdownInAssistant && (
                                                                <AIProcessingDropdown
                                                                    steps={activeSession.thinkingSteps}
                                                                    metrics={activeSession.metrics}
                                                                    isComplete={isProcessingComplete}
                                                                />
                                                            )}

                                                            {/* Response Content */}
                                                            <div className="text-[13px] sm:text-sm md:text-base text-[var(--text-primary)] leading-relaxed">
                                                                {msg.isStreaming ? (
                                                                    <TypingMessage
                                                                        content={msg.content}
                                                                        onLinkClick={handleLinkClick}
                                                                        onTyping={scrollToBottom}
                                                                    />
                                                                ) : msg.isNew ? (
                                                                    <TypingMessage
                                                                        content={msg.content}
                                                                        timestamp={msg.timestamp}
                                                                        onComplete={() => handleTypingComplete(idx)}
                                                                        onTyping={scrollToBottom}
                                                                        onLinkClick={handleLinkClick}
                                                                    />
                                                                ) : (
                                                                    <MessageContent content={msg.content} onLinkClick={handleLinkClick} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Show loader if waiting for first message after user query */}
                                                {msg.role === 'user' && idx === activeSession.messages.length - 1 && activeSession.isThinking && (
                                                    <div className="flex gap-2 md:gap-4 justify-start">
                                                        <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">A</div>
                                                        <div className="w-full md:max-w-[85%] animate-fade-in-up">
                                                            {activeSession.thinkingSteps?.length > 0 ? (
                                                                <AIProcessingDropdown
                                                                    steps={activeSession.thinkingSteps}
                                                                    metrics={null}
                                                                    isComplete={false}
                                                                />
                                                            ) : (
                                                                <LogisticsLoader />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}


                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Fixed Bottom Input */}
                                <div className="sticky bottom-0 w-full bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pt-10 pb-6 px-4">
                                    <div className="max-w-5xl mx-auto">
                                        <InputArea
                                            inputValue={activeSession.inputValue}
                                            setInputValue={(val) => updateActiveSession({ inputValue: val })}
                                            onSend={handleSend}
                                            mode="bottom"
                                            selectedFile={activeSession.selectedFile}
                                            setSelectedFile={(file) => updateActiveSession({ selectedFile: file })}
                                            disabled={isAnyTabLoading}
                                        />
                                    </div>
                                </div>

                            </div>
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
                </div>

                {/* Search Panel */}
                <SearchPanel
                    isOpen={searchPanelOpen}
                    onClose={closeSearchPanel}
                    onResultClick={handleSearchResultClick}
                    onStartChat={handleSearchStartChat}
                    onLoadChat={onLoadChatWithScroll}
                    threads={threads}
                />
            </div>

            {/* Context Panel */}
            <ContextPanel
                isOpen={contextPanelData.open}
                onClose={closeContextPanel}
                data={contextPanelData.data}
            />

            {/* Language Picker */}
            {langOpen && (
                <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setLangOpen(false)}></div>
                    <div className="language-panel absolute top-[64px] right-4 w-56 max-h-[320px] bg-[var(--bg-card)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] flex flex-col z-[50] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 border border-[var(--border-color)] rounded-xl">
                        <div className="panel-header flex items-center gap-3 p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                            <input
                                type="text"
                                className="language-search flex-1 w-full p-2 text-xs rounded-md border border-[var(--border-color)] outline-none bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--brand-primary)] placeholder:text-[var(--text-tertiary)]"
                                placeholder="Search language..."
                                value={langSearchTerm}
                                onChange={(e) => setLangSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>
                        <div className="language-grid p-1.5 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">
                            {filteredLanguages.map((lang, idx) => (
                                <div
                                    key={idx}
                                    className={`lang-item flex items-center gap-3 p-2 text-sm cursor-pointer rounded-md transition-all text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] ${selectedLang.name === lang.name ? 'active bg-[var(--bg-tertiary)] text-[var(--brand-primary)] font-semibold' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedLang(lang);
                                        setLangOpen(false);
                                    }}
                                >
                                    <img src={lang.flag} alt="Flag" className="w-5 h-5 rounded-full shrink-0 object-cover border border-[var(--border-color)]" />
                                    <span className="truncate flex-1">{lang.name}</span>
                                    {selectedLang.name === lang.name && <span className="text-[var(--status-attentive)] text-xs">●</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
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