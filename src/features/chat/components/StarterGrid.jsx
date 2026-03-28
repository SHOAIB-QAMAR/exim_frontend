import React from 'react';
import { FaSackDollar, FaBarcode, FaShip, FaCalculator } from "react-icons/fa6";

/**
 * starters
 * 
 * Predefined list of starter prompts for the user.
 */
const starters = [
    {
        title: "Freight Rates",
        description: "View transport costs for sea, air, or land shipments",
        icon: <FaSackDollar />
    },
    {
        title: "HSN Code",
        description: "Find correct HSN codes for customs and tax purposes",
        icon: <FaBarcode />
    },
    {
        title: "Vessel Schedule",
        description: "Check vessel arrival, departure, and transit details",
        icon: <FaShip />
    },
    {
        title: "Import Duty Calculation",
        description: "Estimate import duties and applicable taxes easily",
        icon: <FaCalculator />
    }
];

/**
 * StarterGrid Component
 * 
 * Displays a grid of helpful starting points for new chat sessions.
 * Adapts between a pill-based layout for mobile and card-based layout for desktop.
 * 
 * @param {Object} props
 * @param {Function} props.onStarterClick - Callback when a starter prompt is selected
 */
const StarterGrid = ({ onStarterClick }) => {
    return (
        <div className="w-full max-w-[1000px] mx-auto">
            {/* Mobile/Compact: Pills */}
            <nav 
                className="flex flex-wrap justify-center gap-2 mobile-ui-visible px-2"
                aria-label="Starter prompts (mobile)"
            >
                {starters.map((starter, idx) => (
                    <button
                        key={`pill-${idx}`}
                        type="button"
                        className="px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-primary)] rounded-full shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer text-[13px] font-medium text-[var(--text-primary)] hover:text-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        onClick={() => onStarterClick && onStarterClick(starter.description)}
                    >
                        {starter.title}
                    </button>
                ))}
            </nav>

            {/* Desktop/Tablet: Full cards */}
            <div 
                className="hidden desktop-ui-visible flex-wrap justify-center gap-4"
                role="region"
                aria-label="Starter prompts (desktop)"
            >
                {starters.map((starter, idx) => (
                    <button
                        key={`card-${idx}`}
                        type="button"
                        className="group relative flex flex-col p-5 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-primary)] rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer w-[180px] h-[180px] overflow-hidden hover:-translate-y-1 hover:scale-[1.02] text-left focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        onClick={() => onStarterClick && onStarterClick(starter.description)}
                        aria-label={`${starter.title}: ${starter.description}`}
                    >
                        {/* Gradient Blob Effect */}
                        <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" aria-hidden="true" />

                        <div className="relative z-10 flex flex-col h-full pointer-events-none">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[var(--brand-primary)] text-xl" aria-hidden="true">
                                    {starter.icon}
                                </span>
                                <h4 className="text-[16px] font-semibold text-[var(--text-primary)] leading-tight">
                                    {starter.title}
                                </h4>
                            </div>

                            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-2 line-clamp-3">
                                {starter.description}
                            </p>
                            
                            <div className="mt-auto">
                                <div
                                    className={`w-full py-2 text-[13px] text-center font-medium rounded-lg transition-all duration-300 shadow-sm
                                        ${idx === 0
                                            ? 'bg-[var(--brand-primary)] text-white shadow-md'
                                            : 'bg-white text-gray-900 border border-[var(--border-color)] group-hover:bg-[var(--brand-primary)] group-hover:text-white group-hover:border-transparent'
                                        }`}
                                    aria-hidden="true"
                                >
                                    Get started
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default StarterGrid;
