import React, { useState, useEffect } from 'react';
import { FaChevronDown, FaCheck, FaSpinner, FaTools, FaSearch, FaLightbulb, FaBolt, FaFileAlt, FaCog, FaComment, FaClock } from 'react-icons/fa';

/**
 * AIProcessingDropdown Component
 * A single collapsible dropdown showing both Thinking Process steps and Timing Metrics.
 * Appears between user query and model response.
 * 
 * Behavior:
 * - OPEN during processing (isComplete = false)
 * - AUTO-CLOSE when first response chunk arrives (isComplete = true)
 * 
 * @param {Object} props
 * @param {Array} props.steps - Array of thinking steps { message, status, type, time, details }
 * @param {Object} props.metrics - Timing metrics { analysis_time, total_time, etc. }
 * @param {boolean} props.isComplete - Whether the entire process is complete
 */
const AIProcessingDropdown = ({ steps = [], metrics = null, isComplete = false }) => {
    // Start expanded during processing, collapse when complete
    const [isExpanded, setIsExpanded] = useState(!isComplete);

    // Auto-collapse when processing completes
    useEffect(() => {
        if (isComplete) {
            // eslint-disable-next-line
            setIsExpanded(false);
        } else {
            setIsExpanded(true);
        }
    }, [isComplete]);

    // Don't render if there's nothing to show
    const hasSteps = steps && steps.length > 0;
    const hasMetrics = metrics && Object.keys(metrics).length > 0;
    if (!hasSteps && !hasMetrics) return null;



    // Metric items with icons matching the screenshot
    const metricItems = [
        { key: 'analysis_time', label: 'Request Analysis', icon: <FaSearch className="text-gray-400" />, thresholds: [500, 2000] },
        { key: 'param_extraction_time', label: 'Parameter Extraction', icon: <FaFileAlt className="text-gray-400" />, thresholds: [1000, 3000] },
        { key: 'tool_execution_time', label: 'Tool Execution', icon: <FaCog className="text-gray-400" />, thresholds: [2000, 5000] },
        { key: 'response_generation_time', label: 'Response Generation', icon: <FaComment className="text-gray-400" />, thresholds: [1000, 3000] },
        { key: 'total_time', label: 'Total Time', icon: <FaClock className="text-gray-400" />, thresholds: [5000, 15000] }
    ];

    const getColor = (value, thresholds) => {
        if (value < thresholds[0]) return 'text-blue-500';
        if (value < thresholds[1]) return 'text-orange-500';
        return 'text-red-500';
    };

    const formatTime = (ms) => {
        if (ms >= 1000) {
            return (ms / 1000).toFixed(2);
        }
        return ms.toFixed(2);
    };

    const getTimeUnit = (ms) => {
        return ms >= 1000 ? 's' : 'ms';
    };

    const totalTime = metrics?.total_time || 0;

    return (
        <div className="w-full mb-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm overflow-hidden text-sm transition-all hover:shadow-md">
            {/* Collapsible Header */}
            <button
                className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 text-[var(--text-primary)] font-medium">
                    {isComplete ? (
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <FaCheck className="text-blue-500 text-xs" />
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
                            <FaLightbulb className="text-[var(--brand-primary)] text-xs animate-pulse" />
                        </div>
                    )}
                    <span className="group-hover:text-blue-600 transition-colors">{isComplete ? 'Processing Complete' : 'AI Processing...'}</span>
                    {totalTime > 0 && (
                        <span className="text-[var(--text-secondary)] font-mono text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
                            {totalTime}ms
                        </span>
                    )}
                </div>
                <FaChevronDown className={`text-[var(--text-secondary)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="border-t border-[var(--border-color)] animate-in slide-in-from-top-1 duration-200">
                    {/* Thinking Steps */}
                    {hasSteps && (
                        <div className="p-4 space-y-3 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
                                <FaLightbulb className="text-[var(--brand-primary)]" />
                                Thinking Process
                            </div>
                            <div className="space-y-2.5 max-h-[200px] overflow-y-auto px-1 custom-scrollbar">
                                {steps.map((step, idx) => (
                                    <div key={idx} className="flex flex-col gap-1.5 relative pl-4 border-l border-[var(--border-color)] ml-1">
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-card)] ${step.status === 'completed' ? 'bg-blue-500' : step.status === 'in-progress' ? 'bg-[var(--brand-primary)] animate-pulse' : 'bg-[var(--text-secondary)]'}`}></div>

                                        <div className={`flex items-start justify-between gap-3 ${step.status === 'in-progress' ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                                            <span className="text-sm leading-relaxed">{step.message}</span>
                                            {step.time && <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60 whitespace-nowrap pt-0.5">{step.time}ms</span>}
                                        </div>
                                        {step.details && (
                                            <div className="mt-1 p-2.5 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] font-mono text-xs overflow-x-auto text-[var(--text-secondary)] shadow-inner">
                                                <pre>{JSON.stringify(step.details, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Performance Breakdown */}
                    {hasMetrics && (
                        <div className="p-4 bg-[var(--bg-secondary)]/30">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <FaBolt className="text-amber-500" />
                                <span className="font-semibold text-[var(--text-primary)] text-sm">Performance Metrics</span>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {metricItems.map((item) => {
                                    const value = metrics[item.key];
                                    if (value == null) return null;

                                    return (
                                        <div key={item.key} className="flex flex-col gap-1 p-2 rounded-lg hover:bg-[var(--bg-card)] transition-colors border border-transparent hover:border-[var(--border-color)]">
                                            {/* Label with icon */}
                                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wide">
                                                {item.icon}
                                                <span>{item.label}</span>
                                            </div>
                                            {/* Value */}
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