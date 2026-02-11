
import React, { useState, useEffect } from 'react';
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

const SearchData = [
    { id: 1, title: "Freight Rates", description: "Check shipping costs for different routes", category: "Features", keywords: ["shipping", "cost", "transport", "rates", "freight"] },
    { id: 2, title: "HSN Code", description: "Find Harmonized System Nomenclature codes", category: "Features", keywords: ["hsn", "code", "classification", "tariff", "customs"] },
    { id: 3, title: "Vessel Schedule", description: "Track ship departure and arrival times", category: "Features", keywords: ["vessel", "schedule", "ship", "departure", "arrival"] },
    { id: 4, title: "Import Duty Calculator", description: "Calculate import taxes and duties", category: "Features", keywords: ["import", "duty", "tax", "calculator", "customs"] },
    { id: 5, title: "Real-Time Tracking", description: "Track shipments in real-time", category: "Features", keywords: ["tracking", "real-time", "shipment", "location", "gps"] },
    { id: 6, title: "Export Documents", description: "List of required export documentation", category: "Documents", keywords: ["export", "documents", "paperwork", "certificate", "license"] },
    { id: 7, title: "Bill of Lading", description: "Template and guide for Bill of Lading", category: "Documents", keywords: ["bill", "lading", "bl", "shipping", "document"] },
    { id: 8, title: "Customs Declaration", description: "How to fill customs declaration forms", category: "Documents", keywords: ["customs", "declaration", "form", "clearance", "import"] },
    { id: 9, title: "Get Help", description: "Contact support or read FAQs", category: "Help", keywords: ["help", "support", "faq", "contact", "assistance"] }
];

const SearchPanel = ({ isOpen, onClose, onStartChat, onLoadChat, threads = [] }) => {

    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm("");
            // Merge SearchData (Starters) and History Threads
            setResults([...SearchData, ...threads]);
        }
    }, [isOpen, threads]);

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        if (!term.trim()) {
            setResults([...SearchData, ...threads]);
            return;
        }

        const lowerTerm = term.toLowerCase();

        // Filter Starters
        const filteredStarters = SearchData.filter(item =>
            item.title.toLowerCase().includes(lowerTerm) ||
            item.description.toLowerCase().includes(lowerTerm) ||
            item.keywords.some(k => k.toLowerCase().includes(lowerTerm))
        );

        // Filter History
        const filteredHistory = threads.filter(item =>
            (item.title || "New Chat").toLowerCase().includes(lowerTerm)
        );

        setResults([...filteredStarters, ...filteredHistory]);
    };

    const highlightText = (text, term) => {
        if (!term) return text;

        const parts = text.split(new RegExp(`(${term})`, 'gi'));
        return parts.map((part, i) =>
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
            // Check if it's a Starter Item (has category/description)
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

        // Remove empty groups and LIMIT to 3 items per category
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
            {/* Overlay */}
            <div
                className={`search-overlay fixed inset-0 bg-black/50 z-[1999] backdrop-blur-[3px] transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                onClick={onClose}
            ></div>

            {/* Panel */}
            <div className={`search-panel fixed top-0 left-0 w-[420px] h-screen bg-[var(--bg-card)]/98 backdrop-blur-2xl border-r border-[var(--border-color)] z-[2000] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

                {/* Header */}
                <div className="search-panel-header p-6 pb-4 shrink-0">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Search</h2>
                        </div>
                        <button
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
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
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={handleSearch}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
                    {results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-[var(--text-tertiary)] animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                <FaMagnifyingGlass className="text-3xl opacity-30" />
                            </div>
                            <p className="text-base font-medium text-[var(--text-secondary)]">No results found</p>
                            <p className="text-sm opacity-60 mt-1">Try different keywords</p>
                        </div>
                    ) : (
                        Object.keys(groupedResults).map(category => (
                            <div key={category} className="mb-6">
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
                                                    onStartChat(item.title);
                                                } else {
                                                    onLoadChat(item.id || item.threadId);
                                                }
                                                onClose();
                                            }}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors truncate">
                                                    {highlightText(item.title || "New Chat", searchTerm)}
                                                </h3>
                                                {item.description && (
                                                    <p className="text-[13px] text-[var(--text-secondary)] truncate mt-1 opacity-90">
                                                        {highlightText(item.description, searchTerm)}
                                                    </p>
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
        </>
    );
};

export default SearchPanel;