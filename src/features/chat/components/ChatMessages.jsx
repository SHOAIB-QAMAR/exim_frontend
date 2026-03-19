import React, { useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import MessageContent, { TypingMessage } from './MessageContent';
import AIProcessingDropdown from './AIProcessingDropdown';
import LogisticsLoader from '../../../components/common/LogisticsLoader';
import InputArea from './InputArea';
import API_CONFIG from '../../../services/api.config';

/* MessageRow Component
 * Represents a single message in the chat timeline (either from the user or the assistant).
 * Wrapped in React.memo to prevent unnecessary re-renders when other messages update, significantly improving performance for long chat histories.
 * @param {Object} props || @param {Object} props.msg - The message object containing role, content, image, and status flags || @param {number} props.idx - The index of this message in the messages array || @param {Array} props.messages - The full array of messages in the current session || @param {Object} props.activeSession - The current chat session object (contains metrics, thinking states) || @param {Function} props.onTypingComplete - Callback fired when a streaming text effect finishes || @param {Function} props.onRetry - Callback to retry sending a failed message || @param {Function} props.onLinkClick - Callback fired when a link inside a message is clicked || @param {Function} props.scrollToBottom - Callback to force the container to scroll to the bottom during typing */

const MessageRow = React.memo(({ msg, idx, messages, activeSession, onTypingComplete, onRetry, onLinkClick, scrollToBottom }) => {

    const isLastAssistantMsg = msg.role === 'assistant' && idx === messages.length - 1;

    // Determine whether to show the AI thinking process dropdown. Only show it on the last assistant message if there are thinking steps available.
    const showDropdownInAssistant = isLastAssistantMsg &&
        (activeSession.thinkingSteps?.length > 0);

    // The AI is considered done thinking if 'isThinking' is false AND we have thinking data to show. This controls whether the dropdown shows a loading state or a completed summary.
    const isProcessingComplete = !activeSession.isThinking &&
        (activeSession.thinkingSteps?.length > 0);

    return (
        <div className="w-full max-w-5xl mx-auto px-2 md:px-6" role="listitem" aria-label={`${msg.role} message`}>
            {/* ------------------------------------------- */}
            {/* USER MESSAGE BLOCK                          */}
            {/* ------------------------------------------- */}
            {msg.role === 'user' && (
                <div className="flex gap-2 md:gap-4 justify-end">
                    <div className="px-3 py-2.5 md:p-4 rounded-2xl leading-relaxed text-[13px] sm:text-sm md:text-base animate-fade-in-up max-w-[70%] md:max-w-[80%] bg-[var(--brand-primary)]/15 border border-[var(--brand-primary)]/20 text-[var(--text-primary)] rounded-tr-sm">
                        {/* Render attached image if it exists */}
                        {msg.image && (
                            <img
                                // Handle blob URLs (previews), absolute URLs (S3), and relative URLs (legacy)
                                src={
                                    msg.image.startsWith('blob:') || msg.image.startsWith('http') 
                                      ? msg.image 
                                      : `${API_CONFIG.BASE_URL}${msg.image}`
                                }
                                alt="Attached"
                                className="max-w-full max-h-36 rounded-lg mb-2 border border-[var(--border-color)] bg-black/5"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        )}
                        {/* Render the user's raw text message */}
                        {msg.content}
                    </div>
                    {/* User Avatar Placeholder */}
                    <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">U</div>
                </div>
            )}

            {/* ------------------------------------------- */}
            {/* ASSISTANT MESSAGE BLOCK                     */}
            {/* ------------------------------------------- */}
            {msg.role === 'assistant' && (
                <div className="flex gap-2 md:gap-4 justify-start">
                    {/* Assistant Avatar Placeholder */}
                    <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">A</div>
                    <div className="w-full md:max-w-[85%] animate-fade-in-up">

                        {/* Render the thinking process dropdown if applicable */}
                        {showDropdownInAssistant && (
                            <AIProcessingDropdown
                                steps={activeSession.thinkingSteps}
                                isComplete={isProcessingComplete}
                            />
                        )}

                        <div className="text-[13px] sm:text-sm md:text-base text-[var(--text-primary)] leading-relaxed">
                            {/* Render text with typing effect if still streaming or new, else render normally parsed Markdown */}
                            {(msg.isStreaming || msg.isNew) ? (
                                <TypingMessage
                                    content={msg.content}
                                    isStreaming={msg.isStreaming}
                                    onComplete={() => onTypingComplete(idx)}
                                    // Make sure we scroll down as characters are appended
                                    onTyping={scrollToBottom}
                                    onLinkClick={onLinkClick}
                                />
                            ) : (
                                <MessageContent content={msg.content} onLinkClick={onLinkClick} />
                            )}

                            {/* Show Retry button if the message failed or timed out during generation */}
                            {(msg.isTimeout || msg.content?.startsWith('Error:')) && (
                                <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-[var(--border-color)]">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]"></span>
                                    <span className="text-xs text-[var(--text-secondary)]">Failed to get response</span>
                                    <button
                                        onClick={() => onRetry(idx)}
                                        className="px-3 py-1 rounded-md text-xs font-medium bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:bg-[var(--brand-primary)]/20 hover:border-[var(--brand-primary)]/30 text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-all duration-200 cursor-pointer"
                                    >
                                        ↻ Retry
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------- */}
            {/* LOADING STATE (Thinking Loader)             */}
            {/* ------------------------------------------- */}
            {/* Show a placeholder loading animation while the assistant is thinking and hasn't replied yet.
                This is only shown after the very last user message. */}
            {msg.role === 'user' && idx === messages.length - 1 && activeSession.isThinking && (
                <div className="flex gap-2 md:gap-4 justify-start mt-3">
                    <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--bg-card)] border-2 border-[var(--text-secondary)] items-center justify-center text-[var(--text-primary)] font-bold text-sm shrink-0 mt-1">A</div>
                    <div className="w-full md:max-w-[85%] animate-fade-in-up">
                        {/* Show thinking steps if they exist, otherwise show a generic pulsing loader */}
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

/* ChatMessages Component: Virtualized chat message list with smart scroll management.
 *
 * This component manages displaying the list of chat messages and handling complex scrolling behaviors like preserving scroll position when older messages load (pagination offset),
 * auto-scrolling to the bottom when new messages stream in (if the user is already at the bottom), and maintaining separate scroll states for different chat sessions.
 * 
 * Wrapped in React.forwardRef to allow parent components to attach a ref to the InputArea. */

const ChatMessages = ({
    messages,
    activeSession,
    onTypingComplete,
    onRetry,
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
    setFocusInput
}) => {
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

    // Determines whether the user is scrolled to the bottom. We allow a 150px threshold so it doesn't have to be perfectly at 0px to be considered "pinned".
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Calculate distance from bottom
        const isPinned = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        isPinnedToBottomRef.current = isPinned;

        // Remember the scroll state for the currently active session globally
        // Scrolling triggers hundreds of events per second. If you tried to save the position to your database or global state on every single pixel of scroll, the app would lag.
        // Instead of running the save logic immediately, it asks the browser: "Wait until the next time you are about to paint the screen (usually 16ms later)."
        // The "Cancel" step: If another scroll event happens before that 16ms is up, it kills the previous request and starts a new one.
        // The Result: The "Save" logic only runs once per frame, preventing "Main Thread" congestion.
        const sid = currentSessionIdRef.current;
        if (sid && saveScrollPosition) {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(() => {
                saveScrollPosition(sid, container.scrollTop, isPinned);
            });
        }
    }, [saveScrollPosition]);

    // Utility function that forcefully pushes the user's scrollbar to the absolute bottom of the chat. It is used constantly, specifically when: The AI says a new word. The user types a brand new message and hits Enter.    
    const snapToBottom = useCallback(() => {
        if (bottomAnchorRef.current) {
            bottomAnchorRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
            isPinnedToBottomRef.current = true;
        } else if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            isPinnedToBottomRef.current = true;
        }
    }, []);


    // UNIFIED SCROLL EFFECT: Session Switching, Pagination, and User Messages
    // useLayoutEffect is critical here because we need to measure DOM changes and adjust scroll position synchronously *before* the browser paints the new frame, preventing jumping.
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        currentSessionIdRef.current = activeSession.id;

        // 1. Session Switch: Restore scroll position or snap to bottom
        if (prevSessionIdRef.current !== activeSession.id) {
            if (activeSession.isPinnedToBottom === false) {
                // Restore exact scroll position if they weren't at the bottom in the previous session. Ensure the saved scroll doesn't exceed the newly rendered height
                container.scrollTop = Math.min(activeSession.scrollPosition || 0, container.scrollHeight - container.clientHeight);
                isPinnedToBottomRef.current = false;
            } else {
                // Start new/pinned sessions at the bottom
                container.scrollTop = container.scrollHeight;
                isPinnedToBottomRef.current = true;

                // Wait 50 milliseconds (enough time for basic Markdown/Syntax Highlighting to finish rendering)
                setTimeout(() => {
                    if (isPinnedToBottomRef.current) snapToBottom();
                }, 50);

                // Wait 150 milliseconds (enough time for early network images to finish loading and stretching the screen)
                setTimeout(() => {
                    if (isPinnedToBottomRef.current) snapToBottom();
                }, 150);

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
        // 3. New User Message: Auto-scroll unconditionally
        else if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
            snapToBottom();
        }

        // Update tracked state for next render comparison
        prevScrollHeightRef.current = container.scrollHeight;
        prevMessagesRef.current = messages;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, activeSession.id, snapToBottom]);


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
                    // Only auto-scroll if the user hasn't manually scrolled up and unpinned
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
            >
                {/* Intersection Observer Target (Top). Used for infinite scrolling backwards. */}
                {hasMoreMessages && (
                    <div ref={observerTargetRef} className="w-full py-4 flex justify-center items-center">
                        {isLoadingMore ? (
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                                <span className="animate-spin inline-block w-4 h-4 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full" />
                                <span className="text-[var(--text-secondary)]">Loading older messages...</span>
                            </div>
                        ) : (
                            <div className="h-4 w-full" /> // Invisible trigger area
                        )}
                    </div>
                )}

                {/* Inner container to monitor height changes */}
                <div ref={innerContainerRef} className="pb-32 pt-4">
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
                                    onRetry={onRetry}
                                    onLinkClick={onLinkClick}
                                    scrollToBottom={handleTypingScroll}
                                />
                            </div>
                        ))
                    )}
                    {/* Bottom anchor div to reliably scroll to the bottom */}
                    <div ref={bottomAnchorRef} className="h-0 w-full" />
                </div>
            </div>

            {/* Fixed Bottom Input Area floating above the chat space */}
            <div className="sticky bottom-0 w-full bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pt-10 pb-6 px-4 z-10">
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
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatMessages;
