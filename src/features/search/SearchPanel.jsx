
import React, { useState } from 'react';
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

/* SearchData (Static Starters): Pre-defined suggested actions or templates that appear as default search results. */

const SearchData = [
    { id: 1, title: "Export Documents", description: "List of required export documentation", category: "Documents", keywords: ["export", "documents", "paperwork", "certificate", "license"] },
    { id: 2, title: "Bill of Lading", description: "Template and guide for Bill of Lading", category: "Documents", keywords: ["bill", "lading", "bl", "shipping", "document"] },
    { id: 3, title: "Customs Declaration", description: "How to fill customs declaration forms", category: "Documents", keywords: ["customs", "declaration", "form", "clearance", "import"] },
];

/* A slide-out drawer providing unified search across static templates ("Starters") and the user's historical chat threads. Includes real-time text highlighting and time-based categorization (Today, Yesterday, etc.).
 * @param {Object} props || @param {boolean} props.isOpen - Controls drawer visibility || @param {function} props.onClose - Closes the drawer || @param {function} props.onStartChat - Callback for when a static Starter item is clicked (creates new chat) || @param {function} props.onLoadChat - Callback for when a historical thread is clicked (loads existing chat) || @param {Array} props.threads - The user's full array of chat history objects */

const SearchPanel = ({ isOpen, onClose, onStartChat, onLoadChat, threads = [] }) => {

    const [searchTerm, setSearchTerm] = useState("");

    // ── SEARCH LOGIC (Derived from searchTerm and threads) ──
    const results = React.useMemo(() => {
        if (!isOpen) return []; // Don't compute if closed

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

        const combined = [...filteredStarters, ...filteredHistory];
        return combined;
    }, [searchTerm, threads, isOpen]);

    const highlightText = (text, term) => {
        if (!term) return text;

        // Split the string into an array of parts based on the matching keyword
        const parts = text.split(new RegExp(`(${term})`, 'gi'));
        return parts.map((part, i) =>
            // If the part matches the search term, inject the highlighted span
            part.toLowerCase() === term.toLowerCase()
                ? <span key={i} className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-sm font-bold px-0.5">{part}</span>
                : part
        );
    };

    const groupedResults = React.useMemo(() => {
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

            // History Logic
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

        // ── CATEGORY TRUNCATION ──
        // Only show groups that actually have items, and slice arrays to a maximum of 3 items per group
        // to keep the UI clean and prevent search results from scrolling endlessly
        const finalGroups = {};
        Object.keys(groups).forEach(key => {
            if (groups[key].length > 0) {
                finalGroups[key] = groups[key].slice(0, 3);
            }
        });

        return finalGroups;
    }, [results]);

    return (
        <>
            {/* ── SEARCH OVERLAY ── */}
            <div
                className={`search-overlay absolute inset-0 z-30 bg-[var(--bg-primary)]/60 backdrop-blur-md flex items-center justify-center p-6 transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                onClick={onClose}
            >
                {/* Panel Container (Centered Modal) */}
                <div
                    className={`search-panel w-full max-w-2xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-full transition-all duration-300 ease-out transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                    onClick={(e) => e.stopPropagation()}
                >

                    {/* Header */}
                    <div className="search-panel-header p-6 pb-4 shrink-0 border-b border-[var(--border-color)]/50">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-bold uppercase tracking-wider text-[var(--text-primary)]">Search</h2>
                            </div>
                            <button
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                onClick={onClose}
                            >
                                <FaXmark className="text-lg" />
                            </button>
                        </div>

                        <div className="search-input-wrapper relative group">
                            <FaMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--brand-primary)] transition-colors text-lg" />
                            <input
                                type="text"
                                className="w-full py-3.5 pl-12 pr-4 rounded-xl bg-[var(--bg-secondary)] border-2 border-transparent focus:bg-[var(--bg-card)] focus:border-[var(--brand-primary)] text-[var(--text-primary)] text-base outline-none transition-all shadow-sm placeholder:text-[var(--text-primary)]"
                                placeholder="Type to search history or templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
                        {results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)] animate-in fade-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                    <FaMagnifyingGlass className="text-3xl opacity-30" />
                                </div>
                                <p className="text-base font-medium text-[var(--text-secondary)]">No results found</p>
                                <p className="text-sm opacity-60 mt-1">Try different keywords</p>
                            </div>
                        ) : (
                            Object.keys(groupedResults).map(category => (
                                <div key={category} className="mb-6 last:mb-2">
                                    <div className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] sticky top-0 bg-[var(--bg-card)]/95 backdrop-blur-md z-10 flex items-center gap-2">
                                        <span className="w-1 h-3 rounded-full bg-[var(--brand-primary)]"></span>
                                        {category}
                                    </div>
                                    <div className="space-y-1.5 mt-1">
                                        {groupedResults[category].map(item => (
                                            <div
                                                key={item.id || item.threadId}
                                                className="group flex items-start gap-4 p-3.5 rounded-xl cursor-pointer hover:bg-[var(--bg-secondary)] transition-all duration-200 border border-transparent hover:border-[var(--border-color)] shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                                onClick={() => {
                                                    if (item.category && item.description && onStartChat) {
                                                        onStartChat(item.description);
                                                    } else {
                                                        onLoadChat(item.id || item.threadId);
                                                    }
                                                    onClose();
                                                }}
                                            >
                                                <div className="flex-1 min-w-0 truncate text-[14px]">
                                                    <span className="font-semibold text-[var(--text-primary)]">
                                                        {highlightText(item.title || "New Chat", searchTerm)}
                                                    </span>
                                                    {item.description && (
                                                        <span className="text-[13px] text-[var(--text-secondary)] opacity-90 ml-1">
                                                            : {highlightText(item.description, searchTerm)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
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