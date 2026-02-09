/**
 * @fileoverview Main Application Layout
 * 
 * The primary layout component that orchestrates the chat interface,
 * including sidebar, header, chat messages, input area, and various panels.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft } from "react-icons/fa6";

// Components
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import FAQ from '../components/FAQ';
import StarterGrid from '../components/StarterGrid';
import InputArea from '../components/InputArea';
import SearchPanel from '../components/SearchPanel';
import ChatTabs from '../components/ChatTabs';
import ThreadSwitcher from '../components/ThreadSwitcher';
import LogisticsLoader from '../components/LogisticsLoader';
import MessageContent, { TypingMessage } from '../components/MessageContent';
import ContextPanel from '../components/ContextPanel';

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
    // ==================== UI STATE ====================
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [searchPanelOpen, setSearchPanelOpen] = useState(false);
    const [threadSwitcherOpen, setThreadSwitcherOpen] = useState(false);
    const [contextPanelOpen, setContextPanelOpen] = useState(false);
    const [contextPanelData, setContextPanelData] = useState(null);
    const [showFAQ, setShowFAQ] = useState(false);

    // Language state
    const [langOpen, setLangOpen] = useState(false);
    const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
    const [langSearchTerm, setLangSearchTerm] = useState("");
    const filteredLanguages = LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(langSearchTerm.toLowerCase())
    );

    // ==================== SIDEBAR HANDLERS ====================
    const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
    const toggleMobileSidebar = () => setMobileSidebarOpen(!mobileSidebarOpen);
    const closeMobileSidebar = () => setMobileSidebarOpen(false);

    const openSearchPanel = () => {
        setSearchPanelOpen(true);
        if (window.innerWidth <= 768) closeMobileSidebar();
    };
    const closeSearchPanel = () => setSearchPanelOpen(false);

    // ==================== DATA HOOKS ====================
    const { threads, deleteThread } = useThreads();

    const {
        activeSessions,
        setActiveSessions,
        activeSessionId,
        activeSession,
        updateActiveSession,
        handleNewChat,
        handleTabClick,
        handleTabClose,
        handleLoadChat
    } = useChatSessions(threads, closeMobileSidebar);

    // ==================== SCROLL MANAGEMENT ====================
    const chatContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const prevSessionIdRef = useRef(activeSessionId);
    const lastScrollTimeRef = useRef(0);
    const isStickyRef = useRef(true);

    const handleScroll = () => {
        if (!chatContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
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

    // Close panels on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeSearchPanel();
                setLangOpen(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

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

    /** Sends a chat message with optional image */
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

    const handleDeleteChatProxy = async (threadId) => {
        try {
            if (!threadId) return;
            const isOpen = activeSessions.find(s => s.id === threadId);
            if (isOpen) handleTabClose(threadId);
            await deleteThread(threadId);
        } catch (error) {
            logError('Layout', 'handleDeleteChatProxy', error, { threadId });
        }
    };

    const handleLinkClick = (url) => {
        setContextPanelData({ title: 'Reference', type: 'link', content: url });
        setContextPanelOpen(true);
    };

    // ==================== RENDER ====================
    return (
        <div className="app flex w-screen h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-800 font-sans relative">
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
                onDeleteChat={handleDeleteChatProxy}
                threads={threads}
                currThreadId={activeSessionId}
                onFAQClick={() => setShowFAQ(!showFAQ)}
                showFAQ={showFAQ}
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
                                    {activeSession.messages.map((msg, idx) => (
                                        <div key={idx} className={`flex gap-2 md:gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.role === 'assistant' && (
                                                <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">A</div>
                                            )}
                                            <div className={`px-3 py-2.5 md:p-4 rounded-2xl leading-relaxed text-[13px] sm:text-sm md:text-base animate-fade-in-up ${msg.role === 'user'
                                                ? 'max-w-[70%] md:max-w-[80%] bg-[var(--brand-primary)]/15 border border-[var(--brand-primary)]/20 text-[var(--text-primary)] rounded-tr-sm'
                                                : 'w-full md:max-w-[85%] bg-transparent text-[var(--text-primary)] rounded-tl-sm'
                                                }`}>
                                                {msg.role === 'assistant' ? (
                                                    msg.isStreaming ? (
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
                                                    )
                                                ) : (
                                                    <>
                                                        {msg.image && (
                                                            <img
                                                                src={msg.image.startsWith('blob:') ? msg.image : `http://localhost:8080${msg.image}`}
                                                                alt="Attached"
                                                                className="max-w-full max-h-36 rounded-lg mb-2 border border-[var(--border-color)]"
                                                            />
                                                        )}
                                                        {msg.content}
                                                    </>
                                                )}
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">U</div>
                                            )}
                                        </div>
                                    ))}
                                    {activeSession.isThinking && (
                                        <div className="flex gap-4 justify-start">
                                            <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">A</div>
                                            <LogisticsLoader />
                                        </div>
                                    )}
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
                                <div className="flex justify-between items-center mb-6 px-2">
                                    <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-wider">Frequently Asked Questions</h3>
                                    <button onClick={() => setShowFAQ(false)} className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        <FaChevronLeft className="w-5 h-5 rotate-180" />
                                    </button>
                                </div>
                                <FAQ onFeatureClick={(text) => { handleFeatureClick(text); setShowFAQ(false); }} />
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
                isOpen={contextPanelOpen}
                onClose={() => setContextPanelOpen(false)}
                data={contextPanelData}
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
