import React, { useState, useId } from 'react';
import { FaChevronDown, FaCheck, FaTools, FaSearch, FaLightbulb, FaBolt, FaFileAlt, FaCog, FaComment, FaClock } from 'react-icons/fa';

/**
 * AIProcessingDropdown Component
 * 
 * A collapsible UI component that displays the AI's "Thinking Process" steps
 * and performance metrics (timing). It typically appears between the user's
 * query and the model's streaming response.
 *
 * Behavior:
 * - Automatically expands when processing starts (`isComplete = false`).
 * - Automatically collapses once the process completes and the response begins.
 *
 * @param {Object} props
 * @param {Array} props.steps - Array of objects: { message, status, type, time, details }
 * @param {Object} props.metrics - Performance data: { analysis_time, total_time, etc. }
 * @param {boolean} props.isComplete - Flag indicating if the processing is finished
 */
const AIProcessingDropdown = ({ steps = [], metrics = null, isComplete = false }) => {
    const dropdownId = useId();
    const [isExpanded, setIsExpanded] = useState(!isComplete);
    const [prevIsComplete, setPrevIsComplete] = useState(isComplete);

    // Sync expanded state with completion status
    if (isComplete !== prevIsComplete) {
        setPrevIsComplete(isComplete);
        setIsExpanded(!isComplete);
    }

    // Don't render if there's no data to display
    const hasSteps = steps && steps.length > 0;
    const hasMetrics = metrics && Object.keys(metrics).length > 0;
    if (!hasSteps && !hasMetrics) return null;

    /**
     * Metric items definitions for the performance breakdown grid.
     */
    const metricItems = [
        { key: 'analysis_time', label: 'Request Analysis', icon: <FaSearch className="text-gray-400" aria-hidden="true" />, thresholds: [500, 2000] },
        { key: 'param_extraction_time', label: 'Parameter Extraction', icon: <FaFileAlt className="text-gray-400" aria-hidden="true" />, thresholds: [1000, 3000] },
        { key: 'tool_execution_time', label: 'Tool Execution', icon: <FaCog className="text-gray-400" aria-hidden="true" />, thresholds: [2000, 5000] },
        { key: 'response_generation_time', label: 'Response Generation', icon: <FaComment className="text-gray-400" aria-hidden="true" />, thresholds: [1000, 3000] },
        { key: 'total_time', label: 'Total Time', icon: <FaClock className="text-gray-400" aria-hidden="true" />, thresholds: [5000, 15000] }
    ];

    /**
     * Determines the text color for a metric based on predefined performance thresholds.
     */
    const getColor = (value, thresholds) => {
        if (value < thresholds[0]) return 'text-blue-500';
        if (value < thresholds[1]) return 'text-orange-500';
        return 'text-red-500';
    };

    /**
     * Formats milliseconds into a human-readable string (seconds or ms).
     */
    const formatTime = (ms) => {
        if (ms >= 1000) {
            return (ms / 1000).toFixed(2);
        }
        return ms.toFixed(2);
    };

    /**
     * Returns the appropriate time unit (s/ms) based on the magnitude of the value.
     */
    const getTimeUnit = (ms) => {
        return ms >= 1000 ? 's' : 'ms';
    };

    const totalTime = metrics?.total_time || 0;

    return (
        <div className="w-full mb-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm overflow-hidden text-sm transition-all hover:shadow-md">
            {/* Collapsible Header */}
            <button
                type="button"
                className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer group"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls={dropdownId}
            >
                <div className="flex items-center gap-3 text-[var(--text-primary)] font-medium">
                    {isComplete ? (
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <FaCheck className="text-blue-500 text-xs" aria-hidden="true" />
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
                            <FaLightbulb className="text-[var(--brand-primary)] text-xs animate-pulse" aria-hidden="true" />
                        </div>
                    )}
                    <span className="group-hover:text-blue-600 transition-colors">
                        {isComplete ? 'Processing Complete' : 'AI Processing...'}
                    </span>
                    {totalTime > 0 && (
                        <span className="text-[var(--text-secondary)] font-mono text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full" aria-label={`Total processing time: ${totalTime} milliseconds`}>
                            {totalTime}ms
                        </span>
                    )}
                </div>
                <FaChevronDown 
                    className={`text-[var(--text-secondary)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                    aria-hidden="true" 
                />
            </button>

            {/* Expandable Content Area */}
            {isExpanded && (
                <div 
                    id={dropdownId}
                    className="border-t border-[var(--border-color)] animate-in slide-in-from-top-1 duration-200"
                >
                    {/* Thinking Process Steps */}
                    {hasSteps && (
                        <div className="p-4 space-y-3 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
                                <FaLightbulb className="text-[var(--brand-primary)]" aria-hidden="true" />
                                <span>Thinking Process</span>
                            </div>
                            <div className="space-y-2.5 max-h-[200px] overflow-y-auto px-1 custom-scrollbar" role="log" aria-label="Thinking process steps">
                                {steps.map((step, idx) => (
                                    <div key={idx} className="flex flex-col gap-1.5 relative pl-4 border-l border-[var(--border-color)] ml-1">
                                        {/* Timeline Dot Indicator */}
                                        <div 
                                            className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-card)] ${
                                                step.status === 'completed' ? 'bg-blue-500' : 
                                                step.status === 'in-progress' ? 'bg-[var(--brand-primary)] animate-pulse' : 
                                                'bg-[var(--text-secondary)]'
                                            }`}
                                            aria-hidden="true"
                                        ></div>

                                        <div className={`flex items-start justify-between gap-3 ${step.status === 'in-progress' ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                                            <span className="text-sm leading-relaxed">{step.message}</span>
                                            {step.time && (
                                                <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60 whitespace-nowrap pt-0.5" aria-label={`${step.time} milliseconds`}>
                                                    {step.time}ms
                                                </span>
                                            )}
                                        </div>
                                        {step.details && (
                                            <div className="mt-1 p-2.5 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] font-mono text-xs overflow-x-auto text-[var(--text-secondary)] shadow-inner">
                                                {/* WARNING: JSON details are rendered as is; ensure no sensitive data is passed in 'details' for production. */}
                                                <pre tabIndex={0}>{JSON.stringify(step.details, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Performance Metrics Breakdown */}
                    {hasMetrics && (
                        <div className="p-4 bg-[var(--bg-secondary)]/30" role="region" aria-label="Performance metrics breakdown">
                            <div className="flex items-center gap-2 mb-4">
                                <FaBolt className="text-amber-500" aria-hidden="true" />
                                <span className="font-semibold text-[var(--text-primary)] text-sm">Performance Metrics</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {metricItems.map((item) => {
                                    const value = metrics[item.key];
                                    if (value == null) return null;

                                    return (
                                        <div key={item.key} className="flex flex-col gap-1 p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors border border-transparent hover:border-[var(--border-color)]">
                                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wide">
                                                {item.icon}
                                                <span>{item.label}</span>
                                            </div>
                                            <div className={`font-mono text-lg font-semibold ${getColor(value, item.thresholds)}`}>
                                                {formatTime(value)}
                                                <span className="text-[var(--text-secondary)] opacity-60 text-xs ml-0.5 font-normal">
                                                    {getTimeUnit(value)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIProcessingDropdown;