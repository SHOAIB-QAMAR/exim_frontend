import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
    // Layout State
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Panel State
    const [searchPanelOpen, setSearchPanelOpen] = useState(false);
    const [contextPanelData, setContextPanelData] = useState({ open: false, data: null });
    const [threadSwitcherOpen, setThreadSwitcherOpen] = useState(false);

    // Feature Modals
    const [showFAQ, setShowFAQ] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    // Derived State / Helpers
    const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), []);
    const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen(prev => !prev), []);
    const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

    const openSearchPanel = useCallback(() => {
        setSearchPanelOpen(true);
        if (window.innerWidth <= 768) closeMobileSidebar();
    }, [closeMobileSidebar]);

    const closeSearchPanel = useCallback(() => setSearchPanelOpen(false), []);

    const openContextPanel = useCallback((data) => {
        setContextPanelData({ open: true, data });
    }, []);

    const closeContextPanel = useCallback(() => {
        setContextPanelData(prev => ({ ...prev, open: false }));
    }, []);

    // Global Event Listeners (Escape Key)
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeSearchPanel();
                setLangOpen(false);
                closeContextPanel();
                setThreadSwitcherOpen(false);
                setShowFAQ(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [closeSearchPanel, closeContextPanel]);

    const value = {
        // State
        sidebarCollapsed,
        mobileSidebarOpen,
        searchPanelOpen,
        contextPanelData,
        threadSwitcherOpen,
        showFAQ,
        langOpen,

        // Setters & Actions
        setSidebarCollapsed,
        setMobileSidebarOpen,
        toggleSidebar,
        toggleMobileSidebar,
        closeMobileSidebar,

        setSearchPanelOpen,
        openSearchPanel,
        closeSearchPanel,

        openContextPanel,
        closeContextPanel,

        setThreadSwitcherOpen,
        setShowFAQ,
        setLangOpen
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};