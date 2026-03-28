/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import SharedWebSocketService from '../../../services/SharedWebSocketService';
import { useAuth } from '../../auth/context/AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [service] = useState(() => new SharedWebSocketService());
    const { isAuthenticated } = useAuth();
    const wasAuthenticatedRef = useRef(isAuthenticated);

    // Force-close WebSocket when user logs out (auth goes true → false)
    useEffect(() => {
        if (wasAuthenticatedRef.current && !isAuthenticated) {
            service.forceClose();
        }
        wasAuthenticatedRef.current = isAuthenticated;
    }, [isAuthenticated, service]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            service.forceClose();
        };
    }, [service]);

    return (
        <WebSocketContext.Provider value={service}>
            {children}
        </WebSocketContext.Provider>
    );
};

// Hook to access the SharedWebSocketService instance from context.

export const useWebSocketService = () => {
    const service = useContext(WebSocketContext);
    if (!service) {
        throw new Error('useWebSocketService must be used within a WebSocketProvider');
    }
    return service;
};
