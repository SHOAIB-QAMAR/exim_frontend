/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

/**
 * UIContext
 * Global state management for layout components, modals, and navigation panels.
 */
const UIContext = createContext();

/**
 * UIProvider Component
 * 
 * Centralizes the state for various UI elements like sidebars, search panels, 
 * and feature modals. Provides stable callback references to prevent 
 * unnecessary re-renders of consuming components.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 */
export const UIProvider = ({ children }) => {
    // ── LAYOUT STATE ──
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // ── PANEL STATE ──
    const [searchPanelOpen, setSearchPanelOpen] = useState(false);
    const [threadSwitcherOpen, setThreadSwitcherOpen] = useState(false);

    // ── FEATURE MODALS ──
    const [showFAQ, setShowFAQ] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    // ── ACTIONS & HANDLERS ──
    const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), []);
    const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen(prev => !prev), []);
    const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

    const openSearchPanel = useCallback(() => {
        setShowFAQ(false);
        setSearchPanelOpen(true);
        // Only close sidebar on small screens to maintain layout on desktop
        if (window.innerWidth <= 768) setMobileSidebarOpen(false);
    }, []);

    const closeSearchPanel = useCallback(() => setSearchPanelOpen(false), []);

    const openFAQ = useCallback(() => {
        setSearchPanelOpen(false);
        setShowFAQ(true);
        if (window.innerWidth <= 768) setMobileSidebarOpen(false);
    }, []);

    /**
     * Global keyboard shortcuts (Escape key) to dismiss open panels/modals.
     */
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setSearchPanelOpen(false);
                setLangOpen(false);
                setThreadSwitcherOpen(false);
                setShowFAQ(false);
                setMobileSidebarOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ── CONTEXT VALUE MEMOIZATION ──
    // Ensures that consumers only re-render when a relevant state or handler actually changes.
    const value = useMemo(() => ({
        // State
        sidebarCollapsed,
        mobileSidebarOpen,
        searchPanelOpen,
        threadSwitcherOpen,
        showFAQ,
        langOpen,

        // Setters & Actions (Memoized hooks)
        setSidebarCollapsed,
        setMobileSidebarOpen,
        toggleSidebar,
        toggleMobileSidebar,
        closeMobileSidebar,

        setSearchPanelOpen,
        openSearchPanel,
        closeSearchPanel,

        setThreadSwitcherOpen,
        setShowFAQ,
        openFAQ,
        setLangOpen
    }), [
        sidebarCollapsed,
        mobileSidebarOpen,
        searchPanelOpen,
        threadSwitcherOpen,
        showFAQ,
        langOpen,
        toggleSidebar,
        toggleMobileSidebar,
        closeMobileSidebar,
        openSearchPanel,
        closeSearchPanel,
        openFAQ
    ]);

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
};

/**
 * useUI Hook
 * 
 * Custom hook to consume the UIContext.
 * @returns {Object} UI state and action handlers
 * @throws {Error} If used outside of a UIProvider
 */
export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};