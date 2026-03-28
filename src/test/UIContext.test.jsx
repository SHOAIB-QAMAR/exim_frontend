/**
 * Tests for UIContext
 * Covers: sidebar, search panel, mobile sidebar, Escape key, context guard
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UIProvider, useUI } from '../providers/UIContext';

const wrapper = ({ children }) => <UIProvider>{children}</UIProvider>;

describe('UIContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Sidebar ───────────────────────────────────────────────────────────
    describe('sidebar', () => {
        it('toggleSidebar toggles sidebarCollapsed', () => {
            const { result } = renderHook(() => useUI(), { wrapper });

            const initial = result.current.sidebarCollapsed;
            act(() => result.current.toggleSidebar());
            expect(result.current.sidebarCollapsed).toBe(!initial);
        });
    });

    // ── Mobile Sidebar ────────────────────────────────────────────────────
    describe('mobile sidebar', () => {
        it('toggleMobileSidebar toggles mobileSidebarOpen', () => {
            const { result } = renderHook(() => useUI(), { wrapper });

            expect(result.current.mobileSidebarOpen).toBe(false);
            act(() => result.current.toggleMobileSidebar());
            expect(result.current.mobileSidebarOpen).toBe(true);
        });

        it('closeMobileSidebar sets mobileSidebarOpen to false', () => {
            const { result } = renderHook(() => useUI(), { wrapper });

            act(() => result.current.toggleMobileSidebar()); // open
            act(() => result.current.closeMobileSidebar());
            expect(result.current.mobileSidebarOpen).toBe(false);
        });
    });

    // ── Search Panel ──────────────────────────────────────────────────────
    describe('search panel', () => {
        it('openSearchPanel opens and closeSearchPanel closes', () => {
            const { result } = renderHook(() => useUI(), { wrapper });

            expect(result.current.searchPanelOpen).toBe(false);

            act(() => result.current.openSearchPanel());
            expect(result.current.searchPanelOpen).toBe(true);

            act(() => result.current.closeSearchPanel());
            expect(result.current.searchPanelOpen).toBe(false);
        });
    });

    // ── Escape Key ────────────────────────────────────────────────────────
    describe('Escape key', () => {
        it('closes search panel and thread switcher on Escape', () => {
            const { result } = renderHook(() => useUI(), { wrapper });

            // Open panels
            act(() => {
                result.current.openSearchPanel();
                result.current.setThreadSwitcherOpen(true);
                result.current.setShowFAQ(true);
            });

            // Press Escape
            act(() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            });

            expect(result.current.searchPanelOpen).toBe(false);
            expect(result.current.threadSwitcherOpen).toBe(false);
            expect(result.current.showFAQ).toBe(false);
        });
    });

    // ── Context Guard ─────────────────────────────────────────────────────
    describe('context guard', () => {
        it('useUI throws outside UIProvider', () => {
            expect(() => {
                renderHook(() => useUI());
            }).toThrow('useUI must be used within a UIProvider');
        });
    });
});
