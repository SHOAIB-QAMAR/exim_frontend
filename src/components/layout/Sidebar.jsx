import { FaMagnifyingGlass, FaShip, FaBars, FaChevronLeft, FaSun, FaMoon, FaPlus } from "react-icons/fa6";
import { MdDelete } from "react-icons/md";
import { FaQuestionCircle } from "react-icons/fa";
import { useTheme } from '../../providers/ThemeContext';
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Tooltip from '../common/Tooltip';

/**
 * A sub-component for rendering individual chat thread items with truncation detection.
 * 
 * @param {Object} props
 * @param {string} props.title - The title of the chat thread.
 * @param {string} props.firstMessage - The preview text of the first message.
 */
const ChatItem = ({ title, firstMessage }) => {
    // Reference to the text container to measure its actual width vs visible width
    const textRef = useRef(null);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (textRef.current) {
                setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [title]);

    return (
        <Tooltip
            content={firstMessage || title}
            position="bottom"
            disabled={!isTruncated} // Optimization: Don't attach tooltip logic if text fits perfectly
            className="flex-1 min-w-0 overflow-hidden block"
        >
            <div
                ref={textRef}
                className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]"
            >
                {title}
            </div>
        </Tooltip>
    );
};

/**
 * Main Navigation Sidebar component.
 */
const Sidebar = ({
    collapsed, toggleSidebar, isOpenMobile, closeMobileSidebar,
    onSearchClick, onNewChat, threads = [], activeSessionId, onLoadChat,
    onDeleteChat, onFAQClick, showFAQ, isLoading, fetchError,
    onRetryFetch, loadMore, hasMore, isFetchingMore
}) => {
    const { theme, toggleTheme } = useTheme();

    // Track which chat thread's options menu (the 3 dots) is currently open ,stores the threadId, allowing only one menu open at a time
    const [activeMenu, setActiveMenu] = useState(null);

    // State to force show the ellipsis menu after a long press on mobile
    const [touchEllipsisId, setTouchEllipsisId] = useState(null);
    const pressTimer = useRef(null);
    const isLongPressing = useRef(false);

    const handleTouchStart = (sessionId) => {
        isLongPressing.current = false;
        pressTimer.current = setTimeout(() => {
            isLongPressing.current = true;
            setTouchEllipsisId(sessionId);
            // Optional: Trigger vibration feedback
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
        }, 500); // 500ms for long press
    };

    const handleTouchEnd = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }
    };

    const handleTouchMove = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
        }
    };

    // Close the forced ellipsis visibility if clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            // Also reset it if activeMenu changes
            if (!activeMenu) setTouchEllipsisId(null);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [activeMenu]);

    const [isDeleting, setIsDeleting] = useState(false);

    // Sidebar is considered "expanded" if either:
    // 1. It is not manually collapsed on desktop
    // 2. It is forcibly opened via the hamburger menu on mobile devices
    const isExpanded = !collapsed || isOpenMobile;

    // ── EVENT HANDLERS ──

    const handleDeleteChat = async (sessionId) => {
        if (!onDeleteChat) return;
        setIsDeleting(true);
        await onDeleteChat(sessionId);
        setIsDeleting(false);
        setActiveMenu(null);
    };

    // Toggles the visibility of the primary chat history list (collapsible accordion style)
    const [showHistory, setShowHistory] = useState(true);

    // Guard: prevents loadMore from firing when clicking a chat causes a re-render near the scroll bottom
    const justClickedChatRef = useRef(false);

    // Scroll persistence refs
    const historyScrollRef = useRef(null);
    const savedScrollPosRef = useRef(parseInt(sessionStorage.getItem('sidebarScrollPos') || '0', 10));

    // Resilient scroll restoration effect
    useEffect(() => {
        // Only run restore if we are expanded, history is shown, and we have a saved position
        if (isExpanded && showHistory && savedScrollPosRef.current > 0) {
            const container = historyScrollRef.current;
            if (!container) return;

            const tryRestore = () => {
                if (container.scrollHeight > container.clientHeight) {
                    container.scrollTop = savedScrollPosRef.current;
                    return true;
                }
                return false;
            };

            // Initial attempt
            if (tryRestore()) return;

            // Short interval polling for 1 second to catch the moment layout settles
            const interval = setInterval(() => {
                if (tryRestore()) {
                    clearInterval(interval);
                }
            }, 60);

            const timeout = setTimeout(() => clearInterval(interval), 1000);

            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }
    }, [isExpanded, showHistory, threads.length]); // Re-run if threads count changes (e.g. initial load)

    // Track a "closing" flag to instantly block scroll logic when isExpanded flips
    const isClosingRef = useRef(false);
    useEffect(() => {
        if (!isExpanded) {
            isClosingRef.current = true;
            // Reset after transition usually takes ~300ms
            const timer = setTimeout(() => {
                isClosingRef.current = false;
            }, 400);
            return () => clearTimeout(timer);
        } else {
            isClosingRef.current = false;
        }
    }, [isExpanded]);

    // Infinite Scroll Handler attached to the history container. 
    const scrollTimerRef = useRef(null);
    const handleScroll = (e) => {
        // BLOCK: If sidebar is closed, closing, or not expanded, do NOT track scroll or load more.
        if (!isExpanded || isClosingRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

        // CRITICAL FIX: Only save the scroll position if the container actually has scrollable content.
        // This prevents the browser from overwriting the saved position with 0 during unmount/shrink.
        if (scrollHeight > clientHeight + 5) {
            savedScrollPosRef.current = scrollTop;
            sessionStorage.setItem('sidebarScrollPos', scrollTop.toString());
        }

        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);

        // If the distance from the bottom is less than 20px
        if (scrollHeight - scrollTop - clientHeight < 20) {
            scrollTimerRef.current = setTimeout(() => {
                // Secondary check inside timeout
                if (!isExpanded || isClosingRef.current || justClickedChatRef.current) return;

                // Only fetch if there's actually more data available, we aren't currently fetching 
                if (hasMore && !isFetchingMore && loadMore) {
                    loadMore();
                }
            }, 150);
        }
    };

    // ── DATA PREPARATION ──
    // Grouping logic removed as requested to show a flat list.

    // ── RENDER HELPERS ──

    const renderThreadItem = (thread) => (
        <div
            key={thread.sessionId}
            className={`chat-item flex items-center p-1.5 rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-all group relative ${activeSessionId === thread.sessionId ? 'bg-[var(--bg-tertiary)]' : ''}`}
            onClick={() => {
                if (isLongPressing.current) {
                    isLongPressing.current = false;
                    return; // Prevent loading chat if the users interaction was a long press
                }
                // Block loadMore from firing during the re-render caused by this click
                justClickedChatRef.current = true;
                setTimeout(() => { justClickedChatRef.current = false; }, 500);
                onLoadChat(thread);
            }}
            onTouchStart={() => handleTouchStart(thread.sessionId)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => {
                // Prevent native OS context menu from showing up on long press
                if (window.innerWidth <= 1024) {
                    e.preventDefault();
                }
            }}
        >
            <ChatItem title={thread.messages?.[0]?.content || thread.title || "New Chat"} firstMessage={thread.messages?.[0]?.content} />

            {/* The 3-dots context menu button (only visible on hover unless active) */}
            <button
                className={`chat-menu p-1.5 rounded-full hover:bg-[var(--bg-secondary)] transition-all ${activeMenu === thread.sessionId || touchEllipsisId === thread.sessionId
                    ? 'opacity-100 bg-[var(--bg-secondary)]'
                    : 'opacity-0 md:group-hover:opacity-100'
                    }`}
                aria-label="Delete chat"
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === thread.sessionId ? null : thread.sessionId);
                    setTouchEllipsisId(null);
                }}
            >
                <MdDelete className="text-[var(--text-secondary)] text-sm" aria-hidden="true" />
            </button>

            {/* Delete Chat Confirmation Modal */}
            {/* Rendered using a React Portal into document.body to ensure it renders over all z-index contexts */}
            {activeMenu === thread.sessionId && ReactDOM.createPortal(
                <>
                    {/* Dark blurred background overlay */}
                    <div
                        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-md"
                        aria-hidden="true"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(null);
                        }}
                    ></div>

                    {/* Centered Modal Container */}
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`delete-confirm-${thread.sessionId}`}
                    >
                        <div
                            className="bg-[var(--bg-card)] rounded-2xl shadow-xl border border-[var(--border-color)] w-[380px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4">
                                <h3 id={`delete-confirm-${thread.sessionId}`} className="text-xl py-2 font-semibold text-[var(--text-primary)]">Delete Chat?</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-2">
                                    Permanently delete <span className="font-medium text-[var(--text-primary)]">{thread.title}.</span>
                                </p>
                            </div>
                            <div className="flex justify-end gap-4 p-4 pt-2">
                                <button
                                    type="button"
                                    className="px-5 py-2 rounded-lg text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenu(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="px-5 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteChat(thread.sessionId);
                                    }}
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );

    return (
        <>
            <div
                className={`sidebar flex flex-col justify-between overflow-hidden border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] text-[var(--text-primary)] transition-all duration-300 ease-in-out fixed lg:relative z-50
          ${isExpanded ? 'w-68' : 'w-16'} 
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
                id="sidebar"
            >
                {/* ── TOP HEADER (Branding & Toggle) ── */}
                <div className="flex flex-col gap-1.5 p-1.5 pt-2 md:pt-1.5">
                    <div className={`sidebar-header flex items-center text-xl pt-1 md:pt-2.5 gap-2.5 ${isExpanded ? 'pl-3 md:pl-4 pr-2 mb-3 md:mb-4' : 'justify-center pb-1.5'}`}>
                        {/* Expanded Mode: Brand Icon on Left, Title, and Close Button on Right */}
                        {isExpanded ? (
                            <>
                                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                    <div className="bg-[var(--brand-primary)] min-w-[32px] w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm">
                                        <FaShip className="text-sm" />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                    onClick={isOpenMobile ? closeMobileSidebar : toggleSidebar}
                                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                                >
                                    <FaChevronLeft className="w-5 h-5" aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            /* Collapsed Mode: Toggle Button (Ship -> Hamburger) */
                            <button
                                type="button"
                                className="sidebar-toggle-btn group relative p-0 rounded-lg bg-[var(--brand-primary)] text-white shadow-md hover:shadow-lg transition-all duration-300 transform active:scale-95 flex items-center justify-center w-8 h-8 mx-auto mt-1"
                                onClick={toggleSidebar}
                                aria-label="Expand sidebar"
                            >
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-100 group-hover:opacity-0`}>
                                    <FaShip className="text-sm" aria-hidden="true" />
                                </div>

                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100`}>
                                    <FaBars className="text-sm" aria-hidden="true" />
                                </div>
                            </button>
                        )}
                    </div>

                    {/* ── MAIN ACTIONS (Search) ── */}
                    <div className="flex flex-col gap-1.5 p-1.5 mb-2">

                        {/* New Chat Button */}
                        <Tooltip
                            content="New Chat"
                            disabled={isExpanded}
                            position="right"
                        >
                            <button
                                className={`icon-item flex items-center justify-center gap-2 p-2 text-[var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${isExpanded ? 'w-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] rounded-full hover:bg-[var(--bg-secondary)] hover:border-[var(--border-color)]' : 'w-10 h-10 justify-center mx-auto rounded-md hover:bg-[var(--bg-tertiary)]'}`}
                                onClick={onNewChat}
                            >
                                <FaPlus className={`${isExpanded ? 'text-xs' : 'text-lg '}`} />
                                <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'block opacity-100' : 'hidden opacity-0'}`}>New Chat</span>
                            </button>
                        </Tooltip>

                        <Tooltip
                            content="Search Chats"
                            disabled={isExpanded} // Hide tooltip when sidebar is wide anyway
                            position="right"
                        >
                            <button
                                className={`icon-item flex items-center justify-center gap-2 p-2 text-[var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${isExpanded ? 'w-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] rounded-full hover:bg-[var(--bg-secondary)] hover:border-[var(--border-color)]' : 'w-10 h-10 justify-center mx-auto rounded-md hover:bg-[var(--bg-tertiary)]'}`}
                                onClick={onSearchClick}
                            >
                                <FaMagnifyingGlass className={`${isExpanded ? 'text-xs' : 'text-lg '}`} />
                                <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'block opacity-100' : 'hidden opacity-0'}`}>Search Chat</span>
                            </button>
                        </Tooltip>

                    </div>
                </div>

                {/* ── CHAT HISTORY LIST ── */}
                {/* Independent scroll container tracking the `handleScroll` event for infinite pagination */}
                <div
                    ref={historyScrollRef}
                    className="flex-1 overflow-y-auto min-h-0 px-3 custom-scrollbar mb-2 relative"
                    onScroll={handleScroll}
                >
                    {/* Chat History Header (Collapsible toggle) */}
                    <div className={`chat-history-section ${!isExpanded ? 'hidden' : ''} sticky top-0 bg-[var(--bg-sidebar)] z-10 pb-2 pt-1`}>
                        <div
                            className="mb-1.5 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex justify-between items-center cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            <span className="flex items-center gap-2">History</span>
                            <span className="text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-1.5 rounded hover:bg-[var(--bg-card)]">
                                {showHistory ? 'Hide' : 'Show'}
                            </span>
                        </div>
                    </div>

                    {/* Render History only if toggled ON and Sidebar is Expanded */}
                    {isExpanded && showHistory && (
                        <div className="chat-list mb-4 animate-in slide-in-from-top-2 duration-200">
                            {isLoading ? (
                                /* Initial load Skeleton Loader */
                                <div className="space-y-4 mt-2">
                                    {[1, 2, 3].map((g) => (
                                        <div key={g} className="space-y-2">
                                            <div className="h-3 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse mb-2"></div>
                                            {[1, 2].map((i) => (
                                                <div key={i} className="h-8 w-full bg-[var(--bg-tertiary)]/50 rounded-lg animate-pulse"></div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : fetchError ? (
                                /* Error State with Retry Button */
                                <div className="text-center mt-4 px-2">
                                    <div className="flex items-center justify-center gap-2 mb-3">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]"></span>
                                        <p className="text-xs text-[var(--text-secondary)]">{fetchError}</p>
                                    </div>
                                    <button
                                        onClick={onRetryFetch}
                                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:bg-[var(--brand-primary)]/20 hover:border-[var(--brand-primary)]/30 text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-all duration-200 cursor-pointer"
                                    >
                                        ↻ Retry
                                    </button>
                                </div>
                            ) : threads.length === 0 ? (
                                /* Empty state */
                                <div className="text-center text-sm text-[var(--text-secondary)] mt-4">
                                    No history
                                </div>
                            ) : (
                                /* Render Flat History List */
                                <>
                                    <div className="space-y-1">
                                        {threads.map((thread) => renderThreadItem(thread))}
                                    </div>

                                    {/* Spinner shown at the bottom when `loadMore` is actively fetching old data */}
                                    {isFetchingMore && (
                                        <div className="mt-2 mb-4 px-2 flex justify-center">
                                            <div className="flex items-center justify-center gap-2 text-[var(--text-secondary)] text-xs font-medium py-2">
                                                <div className="w-3 h-3 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin"></div>
                                                Loading...
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Visual fade-out gradient at the absolute bottom of the scrollable list */}
                    <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--bg-sidebar)] to-transparent z-20 opacity-70" />
                </div>

                {/* ── FOOTER ACTIONS (Theme, FAQ) ── */}
                <div className="sidebar-footer flex flex-col p-2 gap-1 bg-[var(--bg-sidebar)] z-20 relative">
                    <Tooltip
                        content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        disabled={isExpanded}
                        position="right"
                    >
                        <button
                            className={`group icon-item flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-tertiary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${isExpanded ? 'w-full' : 'w-10 h-10 justify-center mx-auto'
                                }`}
                            onClick={toggleTheme}
                        >
                            {theme === 'dark' ? (
                                <FaSun className={`text-lg transition-all duration-200 group-hover:scale-110 
                                    ${isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}
                                />
                            ) : (
                                <FaMoon className={`text-lg transition-all duration-200 group-hover:scale-110 
                                    ${isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}
                                />
                            )}

                            <span
                                className={`label text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 
                                    ${isExpanded ? 'block opacity-100' : 'hidden opacity-0'} 
                                    ${isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}
                                group-hover:text-[var(--text-primary)]`}
                            >
                                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </span>
                        </button>
                    </Tooltip>

                    <Tooltip
                        content="Frequently Asked Questions"
                        disabled={isExpanded}
                        position="right"
                    >
                        <button
                            className={`group icon-item flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-tertiary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 
        ${isExpanded ? 'w-full' : 'w-10 h-10 justify-center mx-auto'} 
        ${showFAQ ? 'bg-[var(--bg-tertiary)]' : ''}`}
                            onClick={() => {
                                if (isOpenMobile) {
                                    closeMobileSidebar();
                                }
                                onFAQClick();
                            }}
                        >
                            <FaQuestionCircle
                                className={`text-lg transition-all duration-200 group-hover:scale-110 
            ${showFAQ ? 'text-[var(--brand-primary)]' :
                                        isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} 
            group-hover:text-[var(--text-primary)]`}
                            />

                            <span className={`label text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 
        ${isExpanded ? 'block opacity-100' : 'hidden opacity-0'} 
        ${showFAQ ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'} 
        group-hover:text-[var(--text-primary)]`}
                            >
                                FAQ
                            </span>
                        </button>
                    </Tooltip>
                </div>
            </div >

            {/* ── MOBILE OVERLAY ── */}
            {/* The dark backdrop that appears behind the sidebar on mobile devices. Clicking it closes the drawer. */}
            {isOpenMobile && (<div className="sidebar-overlay fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={closeMobileSidebar}></div>)}
        </>
    );
};

export default Sidebar;