import React, { useCallback, useRef, useEffect, useState, useLayoutEffect } from 'react';
import MessageContent, { TypingMessage } from './MessageContent';
import AIProcessingDropdown from './AIProcessingDropdown';
import LogisticsLoader from '../../../components/common/LogisticsLoader';
import InputArea from './InputArea';
import API_CONFIG from '../../../services/api.config';
import UniversalOverlay from '../../../components/common/UniversalOverlay';
import DocumentChip from '../../../components/common/DocumentChip';
import Tooltip from '../../../components/common/Tooltip';
import { getCachedUrl } from '../../../services/fileCache';

/** Thumbnail that caches its remote src as a blob for instant re-renders. */
const CachedImage = React.memo(({ src, alt, className, onClick }) => {
    const [cachedSrc, setCachedSrc] = useState(src);
    useEffect(() => {
        let cancelled = false;
        if (src) getCachedUrl(src).then(url => { if (!cancelled) setCachedSrc(url); });
        return () => { cancelled = true; };
    }, [src]);
    return <img src={cachedSrc} alt={alt} className={className} onClick={onClick} onError={(e) => { e.target.style.display = 'none'; }} />;
});

/**
 * MessageRow Component
 * 
 * Represents a single message bubble in the chat timeline.
 * Memoized to prevent expensive re-renders during message streaming.
 */
const MessageRow = React.memo(({
    msg,
    idx,
    messages,
    activeSession,
    onTypingComplete,
    onLinkClick,
    onImageClick,
    scrollToBottom
}) => {

    const isLastAssistantMsg = msg.role === 'assistant' && idx === messages.length - 1;

    // Show the AI thinking process dropdown only on the last assistant message
    const showDropdownInAssistant = isLastAssistantMsg && (activeSession.thinkingSteps?.length > 0);

    // Completion status for the thinking dropdown
    const isProcessingComplete = !activeSession.isThinking && (activeSession.thinkingSteps?.length > 0);

    return (
        // ✅ FIXED: Removed stray backtick and "message", properly closed the div
        <div className="w-full max-w-5xl mx-auto px-4 md:px-6">
            {/* User Message Block */}
            {msg.role === 'user' && (
                <div className="flex gap-2 md:gap-4 justify-end">
                    <div className={`
                        ${(msg.pdfs?.length > 0 || msg.images?.length > 0 || msg.pdf || msg.image) ? 'p-0 bg-transparent border-none' : 'px-3 py-2.5 md:p-4 bg-[var(--brand-primary)]/15 border border-[var(--brand-primary)]/20'}
                        rounded-2xl leading-relaxed text-[13px] sm:text-sm md:text-base animate-fade-in-up max-w-[70%] md:max-w-[80%] text-[var(--text-primary)] rounded-tr-sm flex flex-col items-end text-right
                    `}>
                        {/* Multiple Images Support */}
                        {msg.images && msg.images.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mb-2 justify-end">
                                {msg.images.map((imgUrl, i) => (
                                    <CachedImage
                                        key={i}
                                        src={imgUrl}
                                        alt={`Attachment ${i}`}
                                        onClick={(e) => onImageClick && onImageClick({ url: e.target.src })}
                                        className="w-32 h-24 rounded-lg border border-[var(--border-color)] bg-black/5 cursor-pointer hover:opacity-90 transition-opacity object-cover"
                                    />
                                ))}
                            </div>
                        ) : msg.image ? (
                            <div className="flex justify-end w-full">
                                <CachedImage
                                    src={
                                        msg.image.startsWith('blob:') || msg.image.startsWith('http')
                                            ? msg.image
                                            : `${API_CONFIG.API_BASE_URL}${msg.image}`
                                    }
                                    alt="Attached by user"
                                    onClick={(e) => onImageClick && onImageClick({ url: e.target.src })}
                                    className="w-32 h-24 rounded-lg mb-2 border border-[var(--border-color)] bg-black/5 cursor-pointer hover:opacity-90 transition-opacity object-cover"
                                />
                            </div>
                        ) : null}

                        {/* Multiple PDF Support */}
                        {msg.pdfs && msg.pdfs.length > 0 ? (
                            <div className="flex flex-col gap-2 mb-3 items-end">
                                {msg.pdfs.map((pdf, i) => {
                                    const fullUrl = pdf.url.startsWith('blob:') || pdf.url.startsWith('http')
                                        ? pdf.url
                                        : `${API_CONFIG.API_BASE_URL}${pdf.url}`;
                                    return (
                                        <div key={i} className="flex justify-end w-full">
                                            <Tooltip content={pdf.name || 'Document'} position="bottom">
                                                <DocumentChip
                                                    name={pdf.name || 'Document.pdf'}
                                                    url={fullUrl}
                                                    onClick={() => onImageClick && onImageClick({ url: fullUrl, fileName: pdf.name })}
                                                />
                                            </Tooltip>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (msg.pdf ? (
                            <div className="flex justify-end w-full mb-3">
                                <Tooltip content={msg.pdf_name || 'Document'} position="bottom">
                                    <DocumentChip
                                        name={msg.pdf_name || 'Document.pdf'}
                                        url={msg.pdf.startsWith('blob:') || msg.pdf.startsWith('http') ? msg.pdf : `${API_CONFIG.API_BASE_URL}${msg.pdf}`}
                                        onClick={() => {
                                            const fullUrl = msg.pdf.startsWith('blob:') || msg.pdf.startsWith('http') ? msg.pdf : `${API_CONFIG.API_BASE_URL}${msg.pdf}`;
                                            onImageClick && onImageClick({ url: fullUrl, fileName: msg.pdf_name });
                                        }}
                                    />
                                </Tooltip>
                            </div>
                        ) : null)}

                        {msg.content}
                    </div>
                    {/* User Avatar - fixed empty aria-label */}
                    <div
                        className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1"
                        aria-label="User avatar"
                    >
                        U
                    </div>
                </div>
            )}

            {/* Assistant Message Block */}
            {msg.role === 'assistant' && (
                <div className="flex gap-2 md:gap-4 justify-start">
                    {/* AI Avatar - fixed empty aria-label */}
                    <div
                        className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1"
                        aria-label="AI assistant avatar"
                    >
                        A
                    </div>
                    <div className="w-full md:max-w-[85%] animate-fade-in-up">
                        {showDropdownInAssistant && (
                            <AIProcessingDropdown
                                steps={activeSession.thinkingSteps}
                                isComplete={isProcessingComplete}
                            />
                        )}

                        <div className="text-[13px] sm:text-sm md:text-base text-[var(--text-primary)] leading-relaxed">
                            {(msg.isStreaming || msg.isNew) ? (
                                <TypingMessage
                                    content={msg.content}
                                    isStreaming={msg.isStreaming}
                                    onComplete={() => onTypingComplete(idx)}
                                    onTyping={scrollToBottom}
                                    onLinkClick={onLinkClick}
                                />
                            ) : (
                                <MessageContent content={msg.content} onLinkClick={onLinkClick} />
                            )}

                            {((msg.isTimeout || msg.content?.startsWith('Error:')) && !msg.content?.includes('timed out')) && (
                                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[var(--border-color)]">
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        <span>⚠️</span> Response timed out. The server may be busy or unavailable. Please try again.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Inline Loading / Thinking State */}
            {msg.role === 'user' && idx === messages.length - 1 && activeSession.isThinking && (
                <div className="flex gap-2 md:gap-4 justify-start mt-3">
                    <div
                        className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1"
                        aria-label="AI assistant avatar"
                    >
                        A
                    </div>
                    <div className="w-full md:max-w-[85%] animate-fade-in-up">
                        {activeSession.thinkingSteps?.length > 0 ? (
                            <AIProcessingDropdown
                                steps={activeSession.thinkingSteps}
                                isComplete={false}
                            />
                        ) : (
                            <LogisticsLoader />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

MessageRow.displayName = 'MessageRow';

/**
 * ChatMessages Component
 * 
 * Manages the scrollable container for chat history, virtualized rendering,
 * and complex scrolling behaviors (pagination anchoring, auto-scroll to bottom).
 */
const ChatMessages = ({
    isActive = true,
    messages,
    activeSession,
    onTypingComplete,
    onLinkClick,
    inputValue,
    setInputValue,
    onSend,
    selectedFiles,
    setSelectedFiles,
    disabled,
    hasMoreMessages,
    isLoadingMore,
    onLoadMore,
    saveScrollPosition,
    focusInput,
    setFocusInput,
    selectedLang,
    activeSessionId,
    isVoiceMode,
    setIsVoiceMode,
    setLiveVoiceMessages
}) => {
    const [previewMedia, setPreviewMedia] = useState(null);
    // -------------------------------------------
    // REFS FOR DOM ACCESS AND MEASUREMENT
    // -------------------------------------------
    const scrollContainerRef = useRef(null); // The main scrollable container viewport (controls scroll position)
    const observerTargetRef = useRef(null);  // Invisible div at top. Used by IntersectionObserver to trigger pagination
    const bottomAnchorRef = useRef(null);    // An invisible div at the very bottom strictly for scrolling into view
    const innerContainerRef = useRef(null);  // Wraps all messages to observe total height changes for resize adjustments

    // -------------------------------------------
    // REFS FOR ASYNCHRONOUS STATE TRACKING
    // -------------------------------------------
    const lastSnapTimeRef = useRef(0);
    const isPinnedToBottomRef = useRef(true);
    const prevSessionIdRef = useRef(null);
    const rafIdRef = useRef(null);
    const beforeLoadScrollHeightRef = useRef(0);


    /**
     * Simplest possible scroll to bottom: scrolls the 'bottomAnchorRef' into view.
     */
    const snapToBottom = useCallback((force = false) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const now = Date.now();
        // Use a short throttle for performance, but force if specifically requested
        if (!force && (now - lastSnapTimeRef.current < 50)) return;

        // Direct assignment is more reliable for 'sticky' scrolling during streaming
        container.scrollTop = container.scrollHeight;
        lastSnapTimeRef.current = now;
        isPinnedToBottomRef.current = true;
    }, []);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Update pinning status: if within a small buffer, consider 'pinned'.
        // We use a larger buffer (60px) while thinking/typing to avoid accidental breakaway.
        const buffer = (activeSession.isThinking || activeSession.isStreaming) ? 60 : 15;
        const isPinned = container.scrollHeight - container.scrollTop - container.clientHeight < buffer;
        isPinnedToBottomRef.current = isPinned;

        // Save progress for session persistence
        const sid = activeSession.id;
        if (sid && saveScrollPosition) {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(() => {
                saveScrollPosition(sid, container.scrollTop, isPinned);
            });
        }
    }, [saveScrollPosition, activeSession.id, activeSession.isThinking, activeSession.isStreaming]);

    /**
     * Simple Effect: Scroll to bottom when messages are added or thinking starts.
     * This mimics the standard behavior in modern chat apps.
     */
    useEffect(() => {
        if (!isActive) return;

        // If a new thread is loaded, or if a user message was just sent, force a snap
        const wasUserMsg = messages.length > 0 && messages[messages.length - 1].role === 'user';
        const isNewThread = prevSessionIdRef.current !== activeSession.id;

        if (isNewThread || wasUserMsg) {
            snapToBottom(true);
            prevSessionIdRef.current = activeSession.id;
        }
        // If text is streaming or thinking, only snap if already at bottom
        else if (isPinnedToBottomRef.current) {
            snapToBottom();
        }
    }, [messages, activeSession.id, activeSession.isThinking, activeSession.thinkingSteps?.length, isActive, snapToBottom]);

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    const handleTypingScroll = useCallback(() => {
        if (isPinnedToBottomRef.current) snapToBottom();
    }, [snapToBottom]);

    // PAGINATION OBSERVER: Load More Messages
    // Sets up an IntersectionObserver on the invisible target element at the top of the chat. When the top target becomes visible in the viewport, we fetch older messages.
    useEffect(() => {
        const target = observerTargetRef.current;
        if (!target || !hasMoreMessages || isLoadingMore || !onLoadMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                onLoadMore();
            }
        }, {
            root: scrollContainerRef.current,
            rootMargin: '100px 0px 0px 0px'
        });

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMoreMessages, isLoadingMore, onLoadMore]);

    // ── SCROLL ANCHORING ──
    // Step 1: Capture the scrollHeight immediately when loading starts
    useEffect(() => {
        if (isLoadingMore && scrollContainerRef.current) {
            beforeLoadScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
        }
    }, [isLoadingMore]);

    // Step 2: After messages are prepended and DOM is updated (but before paint), adjust scrollTop
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (!isLoadingMore && beforeLoadScrollHeightRef.current > 0 && container) {
            const currentHeight = container.scrollHeight;
            const diff = currentHeight - beforeLoadScrollHeightRef.current;

            // If height increased, it means messages were prepended at the top.
            // We shift the scrollTop by exactly that amount to maintain the user's relative position.
            if (diff > 0) {
                container.scrollTop = diff;
            }
            beforeLoadScrollHeightRef.current = 0; // Reset anchor
        }
    }, [messages, isLoadingMore]);

    return (
        <div className="flex flex-col min-h-full h-full relative">
            {/* Scrollable Main Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto relative chat-scroll-container"
            >
                {/* Intersection Observer Target (Top). Used for infinite scrolling backwards. */}
                {hasMoreMessages && (
                    <div ref={observerTargetRef} className="w-full py-4 flex justify-center items-center">
                        {isLoadingMore ? (
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                                <span className="animate-spin inline-block w-4 h-4 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full" />
                                <span>Loading older messages...</span>
                            </div>
                        ) : (
                            <div className="h-4 w-full" /> // Invisible trigger area
                        )}
                    </div>
                )}

                {/* Inner container to monitor height changes */}
                <div ref={innerContainerRef} className="pb-16 pt-4">
                    {messages.length === 0 && activeSession.isThinking ? (
                        /* Show loader when opening an existing chat before messages arrive */
                        <div className="flex flex-col items-center justify-center h-64">
                            <LogisticsLoader label="Retrieving History..." />
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div key={index} className="py-1.5 md:py-2">
                                <MessageRow
                                    msg={msg}
                                    idx={index}
                                    messages={messages}
                                    activeSession={activeSession}
                                    onTypingComplete={onTypingComplete}
                                    onLinkClick={onLinkClick}
                                    onImageClick={setPreviewMedia}
                                    scrollToBottom={handleTypingScroll}
                                />
                            </div>
                        ))
                    )}
                    {/* Bottom anchor div to reliably scroll to the bottom */}
                    <div ref={bottomAnchorRef} className="h-0 w-full" />
                </div>
            </div>

            {/* Input Area */}
            <div className="sticky bottom-0 w-full bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pt-4 pb-6 px-4 z-10">
                <div className="max-w-5xl mx-auto">
                    <InputArea
                        focusInput={focusInput}
                        setFocusInput={setFocusInput}
                        inputValue={inputValue}
                        setInputValue={setInputValue}
                        onSend={onSend}
                        mode="bottom"
                        selectedFiles={selectedFiles}
                        setSelectedFiles={setSelectedFiles}
                        disabled={disabled}
                        selectedLang={selectedLang}
                        activeSessionId={activeSessionId}
                        isVoiceMode={isVoiceMode}
                        setIsVoiceMode={setIsVoiceMode}
                        setLiveVoiceMessages={setLiveVoiceMessages}
                    />
                </div>
            </div>

            <UniversalOverlay
                isOpen={!!previewMedia}
                imageUrl={previewMedia?.url}
                fileName={previewMedia?.fileName}
                containerId={activeSessionId ? `chat-tab-${activeSessionId}` : 'chat-area-container'}
                onClose={() => setPreviewMedia(null)}
            />
        </div>
    );
};

export default ChatMessages;