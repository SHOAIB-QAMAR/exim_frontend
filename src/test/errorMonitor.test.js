/**
 * Tests for errorMonitor
 * Covers: reportError, initErrorMonitoring
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('errorMonitor', () => {
    let reportError, initErrorMonitoring;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Suppress console output during tests
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'group').mockImplementation(() => { });
        vi.spyOn(console, 'groupEnd').mockImplementation(() => { });

        // Spy on console.error since it replaced logger
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const mod = await import('../utils/errorMonitor');
        reportError = mod.reportError;
        initErrorMonitoring = mod.initErrorMonitoring;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── reportError ───────────────────────────────────────────────────────
    describe('reportError', () => {
        it('calls console.error with the error data', async () => {
            const errorData = { type: 'test_error', message: 'Something failed' };

            reportError(errorData);

            expect(console.error).toHaveBeenCalledWith('[ErrorMonitor]', errorData);
        });

        it('does not throw when sendBeacon is unavailable', async () => {
            const original = navigator.sendBeacon;
            delete navigator.sendBeacon;

            expect(() => {
                reportError({ type: 'test', message: 'boom' });
            }).not.toThrow();

            navigator.sendBeacon = original;
        });
    });

    // ── initErrorMonitoring ───────────────────────────────────────────────
    describe('initErrorMonitoring', () => {
        it('sets window.onerror handler', () => {
            const originalOnError = window.onerror;

            initErrorMonitoring();

            expect(typeof window.onerror).toBe('function');

            // Restore
            window.onerror = originalOnError;
        });

        it('window.onerror calls reportError with error details', async () => {

            initErrorMonitoring();

            // Trigger the onerror handler
            window.onerror('Test error', 'test.js', 10, 5, new Error('boom'));

            expect(console.error).toHaveBeenCalledWith(
                '[ErrorMonitor]',
                expect.objectContaining({
                    type: 'uncaught_error',
                    message: 'Test error',
                })
            );
        });

        it('adds unhandledrejection listener', () => {
            const addSpy = vi.spyOn(window, 'addEventListener');

            initErrorMonitoring();

            expect(addSpy).toHaveBeenCalledWith(
                'unhandledrejection',
                expect.any(Function)
            );

            addSpy.mockRestore();
        });

        it('does not throw even if PerformanceObserver is unavailable', () => {
            const original = globalThis.PerformanceObserver;
            delete globalThis.PerformanceObserver;

            expect(() => initErrorMonitoring()).not.toThrow();

            globalThis.PerformanceObserver = original;
        });
    });
});
