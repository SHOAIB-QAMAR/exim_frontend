import React, { useState } from 'react';
import { FaChevronDown, FaCheck, FaSpinner, FaTools, FaSearch, FaLightbulb } from 'react-icons/fa';

/**
 * ThinkingProcess Component
 * Displays the step-by-step thinking process of the AI.
 * 
 * @param {Object} props
 * @param {Array} props.steps - Array of thinking steps { message, status, type }
 * @param {boolean} props.isComplete - Whether the entire process is complete
 */
const ThinkingProcess = ({ steps = [], isComplete = false }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!steps || steps.length === 0) return null;

    const getIcon = (step) => {
        if (step.status === 'completed') return <FaCheck className="text-green-500" />;
        if (step.status === 'in-progress') return <FaSpinner className="animate-spin text-[var(--brand-primary)]" />;

        switch (step.type) {
            case 'tool_call': return <FaTools className="text-gray-400" />;
            case 'analysis': return <FaSearch className="text-gray-400" />;
            default: return <div className="w-2 h-2 rounded-full bg-gray-300" />;
        }
    };

    return (
        <div className="w-full max-w-[85%] mb-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 overflow-hidden text-sm">
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)]/50 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
                    {isComplete ? <FaCheck className="text-green-500" /> : <FaLightbulb className="text-[var(--brand-primary)]" />}
                    <span>{isComplete ? 'Analysis Complete' : 'Working on your request...'}</span>
                </div>
                <FaChevronDown className={`text-[var(--text-tertiary)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-3 space-y-2 overflow-y-auto max-h-[400px]">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                            {/* Step Title */}
                            <div className={`flex items-center gap-3 ${step.status === 'in-progress' ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                                <div className="w-4 flex justify-center shrink-0">
                                    {getIcon(step)}
                                </div>
                                <span>{step.message}</span>
                                {step.time && <span className="text-xs text-[var(--text-tertiary)]">({step.time}ms)</span>}
                            </div>

                            {/* Detailed Content (e.g. Tool Args/Result) */}
                            {step.details && (
                                <div className="ml-7 mt-1 p-2 bg-[var(--bg-primary)] rounded border border-[var(--border-color)] font-mono text-xs overflow-x-auto text-[var(--text-secondary)]">
                                    <pre>{JSON.stringify(step.details, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ThinkingProcess;
