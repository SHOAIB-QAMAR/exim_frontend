/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import SharedWebSocketService from '../../../services/SharedWebSocketService';
import { useAuth } from '../../auth/context/AuthContext';

/**
 * WebSocketContext
 * 
 * Context for providing a single SharedWebSocketService instance across the application.
 */
const WebSocketContext = createContext(null);

/**
 * WebSocketProvider Component
 * 
 * Manages the lifecycle of a single SharedWebSocketService instance.
 * Automatically closes connections when the user logs out or the component unmounts.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The child components to be wrapped by the provider
 */

export const WebSocketProvider = ({ children }) => {
    // Initialize the shared service once per application lifecycle
    const [service] = useState(() => new SharedWebSocketService());
    const { isAuthenticated } = useAuth();

    // Track authentication state changes for proactive connection cleanup
    const wasAuthenticatedRef = useRef(isAuthenticated);

    /**
     * Security Measure: Force-close WebSocket when user logs out (auth goes true → false)
     * This ensures that stale authenticated sessions are fully terminated on the client side.
     */
    useEffect(() => {
        if (wasAuthenticatedRef.current && !isAuthenticated) {
            service.forceClose();
        }
        wasAuthenticatedRef.current = isAuthenticated;
    }, [isAuthenticated, service]);

    /**
     * Lifecycle Management: Cleanup on unmount
     * Ensures all active socket listeners and connections are purged.
     */
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

/**
 * useWebSocketService Hook
 * 
 * Custom hook for accessing the SharedWebSocketService instance safely.
 * 
 * @returns {SharedWebSocketService} The active shared websocket service
 * @throws {Error} If used outside a WebSocketProvider
 */
export const useWebSocketService = () => {
    const service = useContext(WebSocketContext);
    if (!service) {
        throw new Error('useWebSocketService must be used within a WebSocketProvider');
    }
    return service;
};
