/**
 * @fileoverview Threads Management Hook
 * 
 * Manages chat thread data fetched from the backend.
 * Provides CRUD operations for threads.
 */

import { useState, useEffect, useCallback } from 'react';
import ChatService from '../services/chat.service';

/**
 * Custom hook for managing chat threads
 * 
 * @returns {Object} Threads state and operations
 */
export const useThreads = () => {
    const [threads, setThreads] = useState([]);

    const fetchThreads = useCallback(async () => {
        try {
            const data = await ChatService.getAllThreads();
            setThreads(data);
        } catch (err) {
            console.error('[useThreads.fetchThreads] Error:', err.message);
        }
    }, []);

    // Fetch threads on mount using proper async IIFE pattern
    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const data = await ChatService.getAllThreads();
                if (isMounted) {
                    setThreads(data);
                }
            } catch (err) {
                console.error('[useThreads] Initial fetch error:', err.message);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    const deleteThread = async (threadId) => {
        try {
            if (!threadId) return false;
            await ChatService.deleteThread(threadId);
            setThreads(prev => prev.filter(t => t.threadId !== threadId));
            return true;
        } catch (err) {
            console.error('[useThreads.deleteThread] Error:', err.message);
            return false;
        }
    };

    return { threads, setThreads, fetchThreads, deleteThread };
};