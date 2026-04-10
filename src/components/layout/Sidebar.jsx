import { FaMagnifyingGlass, FaShip, FaBars, FaChevronLeft, FaSun, FaMoon, FaPlus } from "react-icons/fa6";
import { MdDelete } from "react-icons/md";
import { FaQuestionCircle } from "react-icons/fa";
import { useTheme } from '../../providers/ThemeContext';
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Tooltip from '../common/Tooltip';

/**
 * A sub-component for rendering individual chat session items with truncation detection.
 * 
 * @param {Object} props
 * @param {string} props.title - The title of the chat session.
 * @param {string} props.firstMessage - The preview text of the first message.
 */
const SessionItem = ({ title, firstMessage }) => {
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
            disabled={!isTruncated}
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
    onSearchClick, onNewChat, sessions = [], activeSessionId, onLoadChat,
    onDeleteSession, onFAQClick, showFAQ, isLoading,
    loadMore, hasMore, isFetchingMore
}) => {
    const { theme, toggleTheme } = useTheme();

    const [activeSessionMenu, setActiveSessionMenu] = useState(null);
    const [touchEllipsisId, setTouchEllipsisId] = useState(null);
    const pressTimer = useRef(null);
    const isLongPressing = useRef(false);

    const handleTouchStart = (sessionId) => {
        isLongPressing.current = false;
        pressTimer.current = setTimeout(() => {
            isLongPressing.current = true;
            setTouchEllipsisId(sessionId);
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
        }, 500);
    };

    const handleTouchEnd = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    const handleTouchMove = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    useEffect(() => {
        const handleClickOutside = () => {
            if (!activeSessionMenu) setTouchEllipsisId(null);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [activeSessionMenu]);

    const [isDeleting, setIsDeleting] = useState(false);
    const isExpanded = !collapsed || isOpenMobile;

    const handleDeleteSession = async (sessionId) => {
        if (!onDeleteSession) return;
        setIsDeleting(true);
        await onDeleteSession(sessionId);
        setIsDeleting(false);
        setActiveSessionMenu(null);
    };

    const [showHistory, setShowHistory] = useState(true);
    const justClickedChatRef = useRef(false);
    const historyScrollRef = useRef(null);
    const savedScrollPosRef = useRef(parseInt(sessionStorage.getItem('sidebarScrollPos') || '0', 10));

    useEffect(() => {
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

            if (tryRestore()) return;

            const interval = setInterval(() => {
                if (tryRestore()) clearInterval(interval);
            }, 60);
            const timeout = setTimeout(() => clearInterval(interval), 1000);
            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }
    }, [isExpanded, showHistory, sessions.length]);

    const isClosingRef = useRef(false);
    useEffect(() => {
        if (!isExpanded) {
            isClosingRef.current = true;
            const timer = setTimeout(() => { isClosingRef.current = false; }, 400);
            return () => clearTimeout(timer);
        } else {
            isClosingRef.current = false;
        }
    }, [isExpanded]);

    const scrollTimerRef = useRef(null);
    const handleScroll = (e) => {
        if (!isExpanded || isClosingRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight > clientHeight + 5) {
            savedScrollPosRef.current = scrollTop;
            sessionStorage.setItem('sidebarScrollPos', scrollTop.toString());
        }

        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        if (scrollHeight - scrollTop - clientHeight < 20) {
            scrollTimerRef.current = setTimeout(() => {
                if (!isExpanded || isClosingRef.current || justClickedChatRef.current) return;
                if (hasMore && !isFetchingMore && loadMore) loadMore();
            }, 150);
        }
    };

    const renderSessionItem = (session) => (
        <div
            key={session.sessionId}
            className={`chat-item flex items-center p-1.5 rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-all group relative ${activeSessionId === session.sessionId ? 'bg-[var(--bg-tertiary)]' : ''}`}
            onClick={() => {
                if (isLongPressing.current) {
                    isLongPressing.current = false;
                    return;
                }
                justClickedChatRef.current = true;
                setTimeout(() => { justClickedChatRef.current = false; }, 500);
                onLoadChat(session);
            }}
            onTouchStart={() => handleTouchStart(session.sessionId)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => { if (window.innerWidth <= 1024) e.preventDefault(); }}
        >
            <SessionItem title={session.messages?.[0]?.content || session.title || "New Chat"} firstMessage={session.messages?.[0]?.content} />

            <button
                className={`chat-menu p-1.5 rounded-full hover:bg-[var(--bg-secondary)] transition-all ${activeSessionMenu === session.sessionId || touchEllipsisId === session.sessionId
                    ? 'opacity-100 bg-[var(--bg-secondary)]'
                    : 'opacity-0 md:group-hover:opacity-100'
                    }`}
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveSessionMenu(activeSessionMenu === session.sessionId ? null : session.sessionId);
                    setTouchEllipsisId(null);
                }}
            >
                <MdDelete className="text-[var(--text-secondary)] text-sm" />
            </button>

            {activeSessionMenu === session.sessionId && ReactDOM.createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-md"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveSessionMenu(null);
                        }}
                    ></div>

                    {/* ✅ FIXED: Removed stray backtick and extra brace */}
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="bg-[var(--bg-card)] rounded-2xl shadow-xl border border-[var(--border-color)] w-[380px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4">
                                <h3 id={`delete-confirm-${session.sessionId}`} className="text-xl py-2 font-semibold text-[var(--text-primary)]">Delete Session?</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-2">
                                    Permanently delete <span className="font-medium text-[var(--text-primary)]">{session.title}.</span>
                                </p>
                            </div>
                            <div className="flex justify-end gap-4 p-4 pt-2">
                                <button
                                    type="button"
                                    className="px-5 py-2 rounded-lg text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveSessionMenu(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="px-5 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSession(session.sessionId);
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
                {/* TOP HEADER */}
                <div className="flex flex-col gap-1.5 p-1.5 pt-2 md:pt-1.5">
                    <div className={`sidebar-header flex items-center text-xl pt-1 md:pt-2.5 gap-2.5 ${isExpanded ? 'pl-3 md:pl-4 pr-2 mb-3 md:mb-4' : 'justify-center pb-1.5'}`}>
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
                                >
                                    <FaChevronLeft className="w-5 h-5" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="sidebar-toggle-btn group relative p-0 rounded-lg bg-[var(--brand-primary)] text-white shadow-md hover:shadow-lg transition-all duration-300 transform active:scale-95 flex items-center justify-center w-8 h-8 mx-auto mt-1"
                                onClick={toggleSidebar}
                            >
                                <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-100 group-hover:opacity-0">
                                    <FaShip className="text-sm" />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                                    <FaBars className="text-sm" />
                                </div>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5 p-1.5 mb-2">
                        <Tooltip content="New Chat" disabled={isExpanded} position="right">
                            <button
                                className={`icon-item flex items-center justify-center gap-2 p-2 text-[var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${isExpanded ? 'w-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] rounded-full hover:bg-[var(--bg-secondary)] hover:border-[var(--border-color)]' : 'w-10 h-10 justify-center mx-auto rounded-md hover:bg-[var(--bg-tertiary)]'}`}
                                onClick={onNewChat}
                            >
                                <FaPlus className={`${isExpanded ? 'text-xs' : 'text-lg'}`} />
                                <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'block opacity-100' : 'hidden opacity-0'}`}>New Chat</span>
                            </button>
                        </Tooltip>

                        <Tooltip content="Search Chat" disabled={isExpanded} position="right">
                            <button
                                className={`icon-item flex items-center justify-center gap-2 p-2 text-[var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${isExpanded ? 'w-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] rounded-full hover:bg-[var(--bg-secondary)] hover:border-[var(--border-color)]' : 'w-10 h-10 justify-center mx-auto rounded-md hover:bg-[var(--bg-tertiary)]'}`}
                                onClick={onSearchClick}
                            >
                                <FaMagnifyingGlass className={`${isExpanded ? 'text-xs' : 'text-lg'}`} />
                                <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'block opacity-100' : 'hidden opacity-0'}`}>Search Chat</span>
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* CHAT HISTORY LIST */}
                <div
                    ref={historyScrollRef}
                    className="flex-1 overflow-y-auto min-h-0 px-3 custom-scrollbar mb-2 relative"
                    onScroll={handleScroll}
                >
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

                    {isExpanded && showHistory && (
                        <div className="chat-list mb-4 animate-in slide-in-from-top-2 duration-200">
                            {isLoading ? (
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
                            ) : sessions.length === 0 ? (
                                <div className="text-center text-sm text-[var(--text-secondary)] mt-4">No history</div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        {sessions.map((session) => renderSessionItem(session))}
                                    </div>
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

                    <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--bg-sidebar)] to-transparent z-20 opacity-70" />
                </div>

                {/* FOOTER ACTIONS */}
                <div className="sidebar-footer flex flex-col p-2 gap-1 bg-[var(--bg-sidebar)] z-20 relative">
                    <Tooltip content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} disabled={isExpanded} position="right">
                        <button
                            className={`group icon-item flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-tertiary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${isExpanded ? 'w-full' : 'w-10 h-10 justify-center mx-auto'}`}
                            onClick={toggleTheme}
                        >
                            {theme === 'dark' ? (
                                <FaSun className={`text-lg transition-all duration-200 group-hover:scale-110 ${isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`} />
                            ) : (
                                <FaMoon className={`text-lg transition-all duration-200 group-hover:scale-110 ${isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`} />
                            )}
                            <span className={`label text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 ${isExpanded ? 'block opacity-100' : 'hidden opacity-0'} ${isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} group-hover:text-[var(--text-primary)]`}>
                                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </span>
                        </button>
                    </Tooltip>

                    <Tooltip content="Frequently Asked Questions" disabled={isExpanded} position="right">
                        <button
                            className={`group icon-item flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-tertiary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 
                            ${isExpanded ? 'w-full' : 'w-10 h-10 justify-center mx-auto'} 
                            ${showFAQ ? 'bg-[var(--bg-tertiary)]' : ''}`}
                            onClick={() => {
                                if (isOpenMobile) closeMobileSidebar();
                                onFAQClick();
                            }}
                        >
                            <FaQuestionCircle
                                className={`text-lg transition-all duration-200 group-hover:scale-110 
                                ${showFAQ ? 'text-[var(--brand-primary)]' : isExpanded ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} 
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
            </div>

            {isOpenMobile && <div className="sidebar-overlay fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={closeMobileSidebar}></div>}
        </>
    );
};

export default Sidebar;