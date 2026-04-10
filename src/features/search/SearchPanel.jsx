import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

/**
 * SearchData (Static Starters)
 * Pre-defined suggested actions or templates that appear as default search results.
 */
const SearchData = [
    { id: 1, title: "Export Documents", description: "List of required export documentation", category: "Documents", keywords: ["export", "documents", "paperwork", "certificate", "license"] },
    { id: 2, title: "Bill of Lading", description: "Template and guide for Bill of Lading", category: "Documents", keywords: ["bill", "lading", "bl", "shipping", "document"] }
];

/**
 * SearchPanel Component
 * 
 * A slide-out drawer providing unified search across static templates ("Starters") 
 * and the user's historical chat sessions. Includes real-time text highlighting 
 * and time-based categorization.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls drawer visibility
 * @param {Function} props.onClose - Callback to close the drawer
 * @param {Function} props.onStartChat - Callback triggered when a template is clicked
 * @param {Function} props.onLoadChat - Callback triggered when a history item is clicked
 * @param {Array} props.sessions - Array of historical chat sessions
 */
const SearchPanel = ({ isOpen, onClose, onStartChat, onLoadChat, sessions = [] }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef(null);

    // Auto-focus the search input when the panel opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const timer = setTimeout(() => inputRef.current.focus(), 100);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            const timer = setTimeout(() => setSearchTerm(""), 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    /**
     * Filters and combines static templates and historical sessions based on the search term.
     */
    const results = useMemo(() => {
        if (!isOpen) return [];

        if (!searchTerm.trim()) {
            return [...SearchData, ...sessions];
        }

        const lowerTerm = searchTerm.toLowerCase();

        const filteredStarters = SearchData.filter(item =>
            item.title.toLowerCase().includes(lowerTerm) ||
            item.description.toLowerCase().includes(lowerTerm) ||
            item.keywords.some(k => k.toLowerCase().includes(lowerTerm))
        );

        const filteredSessions = sessions.filter(item =>
            (item.title || "New Chat").toLowerCase().includes(lowerTerm)
        );

        return [...filteredStarters, ...filteredSessions];
    }, [searchTerm, sessions, isOpen]);

    /**
     * Highlights matching search terms within a string of text.
     */
    const highlightText = useCallback((text, term) => {
        if (!term || !text) return text;
        const parts = text.split(new RegExp(`(${term})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === term.toLowerCase()
                ? <span key={i} className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-sm font-bold px-0.5">{part}</span>
                : part
        );
    }, []);

    /**
     * Categorizes search results into groups.
     */
    const groupedResults = useMemo(() => {
        if (!results || results.length === 0) return {};

        const groups = {
            "Suggested Actions": [],
            "Older": []
        };

        results.forEach(item => {
            if (item.category && item.description) {
                groups["Suggested Actions"].push(item);
            } else {
                groups["Older"].push(item);
            }
        });

        const finalGroups = {};
        Object.keys(groups).forEach(key => {
            if (groups[key].length > 0) {
                finalGroups[key] = groups[key];
            }
        });

        return finalGroups;
    }, [results]);

    // Handle Escape key to close the panel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <>
            {/* SEARCH OVERLAY */}
            <div
                className={`search-overlay absolute inset-0 z-30 bg-[var(--bg-primary)]/60 backdrop-blur-md flex items-center justify-center p-6 transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                onClick={onClose}
            >
                {/* Panel Container (Centered Modal) */}
                <div
                    className={`search-panel w-full max-w-2xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[65vh] transition-all duration-300 ease-out transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="search-panel-header p-5 pb-4 shrink-0 border-b border-[var(--border-color)]/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex flex-col">
                                <h2 id="search-panel-title" className="text-lg font-bold uppercase tracking-wider text-[var(--text-primary)]">Search</h2>
                            </div>
                            <button
                                type="button"
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                onClick={onClose}
                                aria-label="Close search"
                            >
                                <FaXmark className="text-lg" />
                            </button>
                        </div>

                        <div className="search-input-wrapper relative group">
                            <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--brand-primary)] transition-colors text-lg" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full py-2.5 pl-11 pr-4 rounded-xl bg-[var(--bg-secondary)] border-2 border-transparent focus:bg-[var(--bg-card)] focus:border-[var(--brand-primary)] text-[var(--text-primary)] text-sm outline-none transition-all shadow-sm placeholder:text-[var(--text-primary)]/50"
                                placeholder="Type to search history or templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                aria-label="Search input"
                            />
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 flex flex-col overflow-hidden px-4 py-4">
                        {results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)] animate-in fade-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mb-4 shadow-xl text-[var(--text-secondary)] border-2 border-[var(--border-color)]">
                                    <FaMagnifyingGlass className="text-4xl opacity-20" />
                                </div>
                                <p className="text-base font-medium text-[var(--text-secondary)]">No results found</p>
                                <p className="text-sm opacity-60 mt-1 text-[var(--text-secondary)]">Try different keywords</p>
                            </div>
                        ) : (
                            <>
                                {/* Static Suggested Actions (Pinned/Not Scrollable) */}
                                {groupedResults["Suggested Actions"] && groupedResults["Suggested Actions"].length > 0 && (
                                    <div className="mb-4 shrink-0">
                                        <div className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                                            <span className="w-1 h-3 rounded-full bg-[var(--brand-primary)]"></span>
                                            Suggested Actions
                                        </div>
                                        <div className="space-y-1.5 mt-1 pr-1">
                                            {groupedResults["Suggested Actions"].map(item => (
                                                <button
                                                    key={item.sessionId || item.id}
                                                    type="button"
                                                    className="w-full group flex items-start gap-4 p-3.5 rounded-xl cursor-pointer hover:bg-[var(--bg-secondary)] transition-all duration-200 border border-transparent hover:border-[var(--border-color)] shadow-sm hover:shadow-md hover:-translate-y-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                                                    onClick={() => {
                                                        if (item.category && item.description && onStartChat) {
                                                            onStartChat(item.description);
                                                        } else {
                                                            onLoadChat(item);
                                                        }
                                                        onClose();
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-[var(--text-primary)] block truncate">
                                                            {highlightText(item.title || "New Chat", searchTerm)}
                                                        </span>
                                                        {item.description && (
                                                            <span className="text-[13px] text-[var(--text-secondary)] opacity-90 block truncate mt-0.5">
                                                                {highlightText(item.description, searchTerm)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Scrollable Older Chats Container */}
                                {groupedResults["Older"] && groupedResults["Older"].length > 0 && (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                                        <div className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] sticky top-0 bg-[var(--bg-card)]/95 backdrop-blur-md z-10 flex items-center gap-2">
                                            <span className="w-1 h-3 rounded-full bg-[var(--brand-primary)]"></span>
                                            Older
                                        </div>
                                        <div className="space-y-1.5 mt-1 pb-2 pr-1">
                                            {groupedResults["Older"].map(item => (
                                                <button
                                                    key={item.sessionId || item.id}
                                                    type="button"
                                                    className="w-full group flex items-start gap-4 p-3.5 rounded-xl cursor-pointer hover:bg-[var(--bg-secondary)] transition-all duration-200 border border-transparent hover:border-[var(--border-color)] shadow-sm hover:shadow-md hover:-translate-y-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                                                    onClick={() => {
                                                        if (item.category && item.description && onStartChat) {
                                                            onStartChat(item.description);
                                                        } else {
                                                            onLoadChat(item);
                                                        }
                                                        onClose();
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-[var(--text-primary)] block truncate">
                                                            {highlightText(item.title || "New Chat", searchTerm)}
                                                        </span>
                                                        {item.description && (
                                                            <span className="text-[13px] text-[var(--text-secondary)] opacity-90 block truncate mt-0.5">
                                                                {highlightText(item.description, searchTerm)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SearchPanel;