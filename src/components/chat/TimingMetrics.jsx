import React, { useState } from 'react';
import { FaBolt, FaChevronDown, FaChevronRight } from 'react-icons/fa';

/**
 * TimingMetrics Component
 * Displays performance metrics for the AI response in a collapsible dropdown.
 * 
 * @param {Object} props
 * @param {Object} props.metrics - Metrics object { analysis_time, etc. }
 */
const TimingMetrics = ({ metrics }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!metrics) return null;

    const items = [
        { key: 'analysis_time', label: 'Request Analysis', thresholds: [300, 600] },
        { key: 'param_extraction_time', label: 'Parameter Extraction', thresholds: [500, 1000] },
        { key: 'tool_execution_time', label: 'Tool Execution', thresholds: [1000, 3000] },
        { key: 'response_generation_time', label: 'Response Generation', thresholds: [2000, 5000] },
        { key: 'time_to_first_token', label: 'Time to First Token', thresholds: [500, 1000] },
        { key: 'total_time', label: 'Total Time', thresholds: [3000, 6000] }
    ];

    const getColor = (value, thresholds) => {
        if (value < thresholds[0]) return 'text-green-500';
        if (value < thresholds[1]) return 'text-yellow-500';
        return 'text-red-500';
    };

    const hasData = items.some(item => metrics[item.key] != null);
    if (!hasData) return null;

    // Calculate total time for the header summary
    const totalTime = metrics.total_time || 0;

    return (
        <div className="w-full max-w-[85%] mb-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs overflow-hidden">
            {/* Collapsible Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between gap-2 p-3 text-[var(--text-secondary)] font-semibold hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <FaBolt className="text-yellow-500" />
                    <span>Performance Breakdown</span>
                    {totalTime > 0 && (
                        <span className="text-[var(--text-tertiary)] font-normal">
                            ({totalTime}ms total)
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    <FaChevronDown className="text-[var(--text-tertiary)] transition-transform" />
                ) : (
                    <FaChevronRight className="text-[var(--text-tertiary)] transition-transform" />
                )}
            </button>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="border-t border-[var(--border-color)] p-3 animate-fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4">
                        {items.map((item) => {
                            const value = metrics[item.key];
                            if (value == null) return null;

                            return (
                                <div key={item.key} className="flex flex-col">
                                    <span className="text-[var(--text-tertiary)] text-[10px] uppercase tracking-wider">{item.label}</span>
                                    <span className={`font-mono font-medium ${getColor(value, item.thresholds)}`}>
                                        {value} <span className="text-[var(--text-tertiary)] text-[10px]">ms</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimingMetrics;

