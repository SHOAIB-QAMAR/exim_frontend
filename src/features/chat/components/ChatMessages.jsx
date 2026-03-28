import React, { useCallback, useRef, useEffect, useLayoutEffect, useState } from 'react';
import MessageContent, { TypingMessage } from './MessageContent';
import AIProcessingDropdown from './AIProcessingDropdown';
import LogisticsLoader from '../../../components/common/LogisticsLoader';
import InputArea from './InputArea';
import API_CONFIG from '../../../services/api.config';
import ImageOverlay from '../../../components/common/ImageOverlay';
import { FaFilePdf, FaPlus } from 'react-icons/fa6';
import { pdfjs } from 'react-pdf';

// Configure PDF.js worker for consistent rendering across previews and overlays
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
        <div
            className="w-full max-w-5xl mx-auto px-4 md:px-6"
            role="listitem"
            aria-label={`${msg.role === 'user' ? 'Your' : 'AI'} message`}
        >
            {/* User Message Block */}
            {msg.role === 'user' && (
                <div className="flex gap-2 md:gap-4 justify-end">
                    <div className={`
                        ${(msg.pdf && !msg.content?.trim() && !msg.image) ? 'p-0 bg-transparent border-none' : 'px-3 py-2.5 md:p-4 bg-[var(--brand-primary)]/15 border border-[var(--brand-primary)]/20'}
                        rounded-2xl leading-relaxed text-[13px] sm:text-sm md:text-base animate-fade-in-up max-w-[70%] md:max-w-[80%] text-[var(--text-primary)] rounded-tr-sm
                    `}>
                        {msg.image && (
                            <img
                                src={
                                    msg.image.startsWith('blob:') || msg.image.startsWith('http')
                                        ? msg.image
                                        : `${API_CONFIG.API_BASE_URL}${msg.image}`
                                }
                                alt="Attached by user"
                                onClick={(e) => onImageClick && onImageClick(e.target.src)}
                                className="max-w-full max-h-36 rounded-lg mb-2 border border-[var(--border-color)] bg-black/5 cursor-pointer hover:opacity-90 transition-opacity"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        )}

                        {/* PDF Attachment Card (Matching Screenshot) */}
                        {msg.pdf && (
                            <div
                                className="flex items-center gap-3 p-3 bg-black/10 border border-white/5 rounded-xl mb-3 cursor-pointer hover:bg-black/20 transition-all group/pdf"
                                onClick={() => {
                                    const fullUrl = msg.pdf.startsWith('blob:') || msg.pdf.startsWith('http')
                                        ? msg.pdf
                                        : `${API_CONFIG.API_BASE_URL}${msg.pdf}`;
                                    onImageClick && onImageClick(fullUrl);
                                }}
                            >
                                <div className="w-10 h-10 bg-[#f83c3c] rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover/pdf:scale-105">
                                    <FaFilePdf className="text-white text-xl" />
                                </div>
                                <div className="flex flex-col min-w-0 overflow-hidden pr-2">
                                    <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                                        {msg.pdf_name || 'Document.pdf'}
                                    </span>
                                    <span className="text-[11px] text-[var(--text-secondary)] font-medium tracking-wide uppercase">
                                        PDF
                                    </span>
                                </div>
                            </div>
                        )}

                        {msg.content}
                    </div>
                    {/* User Avatar */}
                    <div
                        className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1"
                        aria-hidden="true"
                    >
                        U
                    </div>
                </div>
            )}

            {/* Assistant Message Block */}
            {msg.role === 'assistant' && (
                <div className="flex gap-2 md:gap-4 justify-start">
                    {/* AI Avatar */}
                    <div
                        className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1"
                        aria-hidden="true"
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
                                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[var(--border-color)]" role="alert">
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        <span aria-hidden="true">⚠️</span> Response timed out. The server may be busy or unavailable. Please try again.
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
                        aria-hidden="true"
                    >
                        A
                    </div>
                    <div className="w-full md:max-w-[85%] animate-fade-in-up" aria-live="polite">
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
    messages,
    activeSession,
    onTypingComplete,
    onLinkClick,
    inputValue,
    setInputValue,
    onSend,
    selectedFile,
    setSelectedFile,
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
    const [previewImage, setPreviewImage] = useState(null);
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
    // Using refs instead of state to track previous values prevents unnecessary React re-renders
    const prevScrollHeightRef = useRef(0);
    const prevMessagesRef = useRef(messages);
    const prevSessionIdRef = useRef(null);
    // Tracks if the user is currently scrolled all the way to the bottom. Default to true if undefined.
    const isPinnedToBottomRef = useRef(activeSession.isPinnedToBottom !== false);

    // Keep track of scroll states per session to properly save them when switching tabs
    const currentSessionIdRef = useRef(activeSession.id);
    const rafIdRef = useRef(null);

    /**
     * Pushes the scroll position to the absolute bottom of the container.
     */
    const snapToBottom = useCallback(() => {
        if (bottomAnchorRef.current) {
            bottomAnchorRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
            isPinnedToBottomRef.current = true;
        } else if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            isPinnedToBottomRef.current = true;
        }
    }, []);

    /**
     * Handles manual scroll events to track bottom pinning and save session scroll progress.
     */
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Calculate distance from bottom
        const isPinned = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        isPinnedToBottomRef.current = isPinned;

        const sid = currentSessionIdRef.current;
        if (sid && saveScrollPosition) {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(() => {
                saveScrollPosition(sid, container.scrollTop, isPinned);
            });
        }
    }, [saveScrollPosition]);

    // Handle scroll position restoration, pagination anchoring, and new message snapping
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        currentSessionIdRef.current = activeSession.id;

        // Session Switch Logic
        if (prevSessionIdRef.current !== activeSession.id) {
            if (activeSession.isPinnedToBottom === false) {
                // Restore exact scroll position if they weren't at the bottom in the previous session. Ensure the saved scroll doesn't exceed the newly rendered height
                container.scrollTop = Math.min(activeSession.scrollPosition || 0, container.scrollHeight - container.clientHeight);
                isPinnedToBottomRef.current = false;
            } else {
                // Start new/pinned sessions at the bottom
                container.scrollTop = container.scrollHeight;
                isPinnedToBottomRef.current = true;

                // Allow time for basic layout/rendering before final snap
                setTimeout(() => { if (isPinnedToBottomRef.current) snapToBottom(); }, 50);
                setTimeout(() => { if (isPinnedToBottomRef.current) snapToBottom(); }, 150);
            }

            // Update tracked state for next render comparison
            prevSessionIdRef.current = activeSession.id;
            prevScrollHeightRef.current = container.scrollHeight;
            prevMessagesRef.current = messages;
            return;
        }

        const prevMessages = prevMessagesRef.current;

        // Detect if the message array grew from the top (which indicates pagination loaded old messages)
        const isPagination = prevMessages.length > 0 &&
            messages.length > prevMessages.length &&
            messages[0] !== prevMessages[0];

        // 2. Pagination (Old messages loaded): Adjust scroll to avoid jumping
        // We add the height difference to the current scrollTop so the viewport remains visually stationary
        if (isPagination) {
            container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
        }
        // New User Message Snap
        else if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
            snapToBottom();
        }

        prevScrollHeightRef.current = container.scrollHeight;
        prevMessagesRef.current = messages;
    }, [messages, activeSession.id, snapToBottom, activeSession.isPinnedToBottom, activeSession.scrollPosition]);


    // DYNAMIC HEIGHT EFFECT: Typing & Loaders
    // Uses ResizeObserver to detect when the inner container's height changes.
    // This happens frequently when the assistant is streaming text (typing effect), or when markdown blocks/images render. If the user is at the bottom, we push them down.
    useEffect(() => {
        const innerContainer = innerContainerRef.current;
        if (!innerContainer) return;

        let lastHeight = innerContainer.getBoundingClientRect().height;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const newHeight = entry.contentRect.height;
                if (newHeight !== lastHeight) {
                    if (isPinnedToBottomRef.current) snapToBottom();
                    lastHeight = newHeight;
                }
            }
        });

        resizeObserver.observe(innerContainer);
        return () => resizeObserver.disconnect();
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
            // We tell the observer: Don't monitor the entire computer screen. Only monitor the specific <div> box that contains the scrolling chat messages (scrollContainerRef)
            root: scrollContainerRef.current,
            rootMargin: '100px 0px 0px 0px'
        });

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMoreMessages, isLoadingMore, onLoadMore]);

    // Provide a callback to be used by the TypingMessage to trigger scroll adjustments on new characters. Placed here to ensure the logic respects the user's manual pinning choice.
    const handleTypingScroll = useCallback(() => {
        if (isPinnedToBottomRef.current) snapToBottom();
    }, [snapToBottom]);

    return (
        <div className="flex flex-col min-h-full h-full relative">
            {/* Scrollable Main Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto relative"
                role="log"
                aria-label="Chat messages list"
                aria-live="polite"
            >
                {/* Intersection Observer Target (Top). Used for infinite scrolling backwards. */}
                {hasMoreMessages && (
                    <div ref={observerTargetRef} className="w-full py-4 flex justify-center items-center">
                        {isLoadingMore ? (
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm" role="status">
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
                                    onImageClick={setPreviewImage}
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
                        selectedFile={selectedFile}
                        setSelectedFile={setSelectedFile}
                        disabled={disabled}
                        selectedLang={selectedLang}
                        activeSessionId={activeSessionId}
                        isVoiceMode={isVoiceMode}
                        setIsVoiceMode={setIsVoiceMode}
                        setLiveVoiceMessages={setLiveVoiceMessages}
                    />
                </div>
            </div>

            <ImageOverlay
                isOpen={!!previewImage}
                imageUrl={previewImage}
                onClose={() => setPreviewImage(null)}
            />
        </div>
    );
};

export default ChatMessages;
