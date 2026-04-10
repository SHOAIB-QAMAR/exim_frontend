import React from 'react';
import { FaPlus, FaXmark, FaMessage } from "react-icons/fa6";
import Tooltip from '../../../components/common/Tooltip';

/**
 * ChatTabs Component
 * 
 * A horizontal tab bar for switching between different chat sessions.
 * 
 * @param {Object} props
 * @param {Array} props.tabs - Array of tab objects: { id, title }
 * @param {string} props.activeTabId - ID of the currently active tab
 * @param {Function} props.onTabClick - Callback when a tab is selected
 * @param {Function} props.onTabClose - Callback when a tab's close button is clicked
 * @param {Function} props.onNewTab - Callback to create a new chat session
 */
const ChatTabs = ({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }) => {

    return (
        <div className="flex items-end w-full bg-[var(--bg-secondary)] border-b border-[var(--border-color)] overflow-hidden">
            <div className="flex items-end gap-1 w-full px-2">
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    const tabTitle = tab.title || "New Chat";

                    return (
                        <div
                            key={tab.id}
                            className={`
                                group relative flex items-center px-1.5 py-2 flex-1 min-w-0 max-w-[200px] h-9 
                                rounded-t-lg cursor-pointer transition-all duration-200 select-none
                                [container-type:inline-size]
                                ${isActive
                                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium shadow-[0_-1px_2px_rgba(0,0,0,0.05)] z-10'
                                    : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
                            `}
                            onClick={() => onTabClick(tab.id)}
                        >
                            {/* Tab Content Wrapper - Provides the coordinate system for centering */}
                            <div className="relative flex items-center h-full w-full overflow-hidden">
                                {/* Title/Icon Group - Completely hidden when active tab is tight */}
                                <div className={`
                                    flex-1 min-w-0 items-center justify-start h-full
                                    ${isActive ? 'hidden @[80px]:flex' : 'flex'}
                                `}>
                                    <Tooltip
                                        content={tabTitle}
                                        position="bottom"
                                        className="flex items-center w-full h-full min-w-0"
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0 px-0.5">
                                            <FaMessage
                                                className="text-[10px] shrink-0 opacity-60"
                                               
                                            />
                                            <span className={`truncate text-sm ${isActive ? 'font-medium' : ''}`}>
                                                {tabTitle}
                                            </span>
                                        </div>
                                    </Tooltip>
                                </div>

                                {/* Close Button Group - Absolutely centered when tight, relative on right when wide */}
                                <div
                                    className={`
                                        ${isActive
                                            ? 'flex items-center justify-center @[80px]:relative @[80px]:justify-end'
                                            : 'hidden @[80px]:flex @[80px]:relative @[80px]:justify-end'}
                                        ${isActive ? 'absolute inset-0 @[80px]:static @[80px]:w-auto' : 'static'}
                                    `}
                                >
                                    <Tooltip content="Close Tab" position="bottom" delay={300}>
                                        <button
                                            type="button"
                                            className={`
                                                p-1 rounded-full transition-all duration-200 shrink-0
                                                hover:bg-red-500/10 hover:text-red-500
                                                ${isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'}
                                            `}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTabClose(tab.id);
                                            }}
                                        >
                                            <FaXmark className="text-[11px]" />
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            {/* Active Tab Underline Indicator */}
                            {isActive && (
                                <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-[var(--bg-primary)] z-20"></div>
                            )}

                            {/* Tab Separator */}
                            {!isActive && (
                                <div className="absolute right-0 top-2 bottom-2 w-[1px] bg-[var(--border-color)] opacity-50"></div>
                            )}
                        </div>
                    );
                })}

                {/* New Chat Button */}
                <Tooltip content="New Chat" position="right">
                    <button
                        type="button"
                        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ml-1 mb-0.5 shrink-0"
                        onClick={() => {
                            try {
                                onNewTab();
                            } catch (err) {
                                console.error("Error creating new tab:", err);
                            }
                        }}
                    >
                        <FaPlus className="text-sm" />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};

export default ChatTabs;
