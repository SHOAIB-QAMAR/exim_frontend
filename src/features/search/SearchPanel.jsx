import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

/**
 * SearchData (Static Starters)
 * Pre-defined suggested actions or templates that appear as default search results.
 */
const SearchData = [
    { id: 1, title: "Export Documents", description: "List of required export documentation", category: "Documents", keywords: ["export", "documents", "paperwork", "certificate", "license"] },
    { id: 2, title: "Bill of Lading", description: "Template and guide for Bill of Lading", category: "Documents", keywords: ["bill", "lading", "bl", "shipping", "document"] },
    { id: 3, title: "Customs Declaration", description: "How to fill customs declaration forms", category: "Documents", keywords: ["customs", "declaration", "form", "clearance", "import"] },
];

/**
 * SearchPanel Component
 * 
 * A slide-out drawer providing unified search across static templates ("Starters") 
 * and the user's historical chat threads. Includes real-time text highlighting 
 * and time-based categorization.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls drawer visibility
 * @param {Function} props.onClose - Callback to close the drawer
 * @param {Function} props.onStartChat - Callback triggered when a template is clicked
 * @param {Function} props.onLoadChat - Callback triggered when a history item is clicked
 * @param {Array} props.threads - Array of historical chat threads
 */
const SearchPanel = ({ isOpen, onClose, onStartChat, onLoadChat, threads = [] }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef(null);

    // Auto-focus the search input when the panel opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const timer = setTimeout(() => inputRef.current.focus(), 100);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            // Use a small timeout to avoid synchronous cascading renders during the close transition
            const timer = setTimeout(() => setSearchTerm(""), 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    /**
     * Filters and combines static templates and historical threads based on the search term.
     */
    const results = useMemo(() => {
        if (!isOpen) return [];

        if (!searchTerm.trim()) {
            return [...SearchData, ...threads];
        }

        const lowerTerm = searchTerm.toLowerCase();

        const filteredStarters = SearchData.filter(item =>
            item.title.toLowerCase().includes(lowerTerm) ||
            item.description.toLowerCase().includes(lowerTerm) ||
            item.keywords.some(k => k.toLowerCase().includes(lowerTerm))
        );

        const filteredHistory = threads.filter(item =>
            (item.title || "New Chat").toLowerCase().includes(lowerTerm)
        );

        return [...filteredStarters, ...filteredHistory];
    }, [searchTerm, threads, isOpen]);

    /**
     * Highlights matching search terms within a string of text.
     */
    const highlightText = useCallback((text, term) => {
        if (!term || !text) return text;

        // Split the string into an array of parts based on the matching keyword
        const parts = text.split(new RegExp(`(${term})`, 'gi'));
        return parts.map((part, i) =>
            // If the part matches the search term, inject the highlighted span
            part.toLowerCase() === term.toLowerCase()
                ? <span key={i} className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-sm font-bold px-0.5">{part}</span>
                : part
        );
    }, []);

    /**
     * Categorizes search results into groups like Today, Yesterday, Predicted 7 Days, etc.
     */
    const groupedResults = useMemo(() => {
        if (!results || results.length === 0) return {};

        const groups = {
            "Suggested Actions": [],
            "Today": [],
            "Yesterday": [],
            "Previous 7 Days": [],
            "Previous 30 Days": [],
            "Older": []
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);

        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);

        results.forEach(item => {
            if (item.category && item.description) {
                groups["Suggested Actions"].push(item);
                return;
            }

            const threadDate = new Date(item.updatedAt || item.createdAt);
            const dateCheck = new Date(threadDate.getFullYear(), threadDate.getMonth(), threadDate.getDate());

            if (dateCheck.getTime() === today.getTime()) {
                groups["Today"].push(item);
            } else if (dateCheck.getTime() === yesterday.getTime()) {
                groups["Yesterday"].push(item);
            } else if (dateCheck >= last7Days) {
                groups["Previous 7 Days"].push(item);
            } else if (dateCheck >= last30Days) {
                groups["Previous 30 Days"].push(item);
            } else {
                groups["Older"].push(item);
            }
        });

        const finalGroups = {};
        Object.keys(groups).forEach(key => {
            if (groups[key].length > 0) {
                finalGroups[key] = groups[key].slice(0, 3);
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
            {/* ── SEARCH OVERLAY ── */}
            <div
                className={`search-overlay absolute inset-0 z-30 bg-[var(--bg-primary)]/60 backdrop-blur-md flex items-center justify-center p-6 transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                onClick={onClose}
                aria-hidden="true"
            >
                {/* Panel Container (Centered Modal) */}
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="search-panel-title"
                    className={`search-panel w-full max-w-2xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-full transition-all duration-300 ease-out transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="search-panel-header p-6 pb-4 shrink-0 border-b border-[var(--border-color)]/50">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col">
                                <h2 id="search-panel-title" className="text-xl font-bold uppercase tracking-wider text-[var(--text-primary)]">Search</h2>
                            </div>
                            <button
                                type="button"
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                onClick={onClose}
                                aria-label="Close search"
                            >
                                <FaXmark className="text-lg" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="search-input-wrapper relative group">
                            <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--brand-primary)] transition-colors text-lg" aria-hidden="true" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full py-3.5 pl-12 pr-4 rounded-xl bg-[var(--bg-secondary)] border-2 border-transparent focus:bg-[var(--bg-card)] focus:border-[var(--brand-primary)] text-[var(--text-primary)] text-base outline-none transition-all shadow-sm placeholder:text-[var(--text-primary)]/50"
                                placeholder="Type to search history or templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                aria-label="Search threads and templates"
                            />
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar" role="listbox" aria-label="Search results">
                        {results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)] animate-in fade-in zoom-in duration-300" role="status">
                                <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                    <FaMagnifyingGlass className="text-3xl opacity-30" aria-hidden="true" />
                                </div>
                                <p className="text-base font-medium text-[var(--text-secondary)]">No results found</p>
                                <p className="text-sm opacity-60 mt-1">Try different keywords</p>
                            </div>
                        ) : (
                            Object.keys(groupedResults).map(category => (
                                <div key={category} className="mb-6 last:mb-2" role="group" aria-label={category}>
                                    <div className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] sticky top-0 bg-[var(--bg-card)]/95 backdrop-blur-md z-10 flex items-center gap-2" aria-hidden="true">
                                        <span className="w-1 h-3 rounded-full bg-[var(--brand-primary)]"></span>
                                        {category}
                                    </div>
                                    <div className="space-y-1.5 mt-1">
                                        {groupedResults[category].map(item => (
                                            <button
                                                key={item.sessionId || item.id}
                                                type="button"
                                                role="option"
                                                aria-selected="false"
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
                                                <div className="flex-1 min-w-0" aria-label={`${item.title || 'New Chat'}${item.description ? `: ${item.description}` : ''}`}>
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
                            ))
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SearchPanel;