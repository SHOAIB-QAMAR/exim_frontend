/**
 * Tests for useSpeechToText hook
 * Covers: browser support detection, start/stop, transcript handling, errors
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useSpeechToText', () => {
    let useSpeechToText;

    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('../hooks/useSpeechToText');
        useSpeechToText = mod.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Browser Support ───────────────────────────────────────────────────
    describe('browser support', () => {
        it('isSupported returns true when webkitSpeechRecognition exists', () => {
            const { result } = renderHook(() => useSpeechToText());
            expect(result.current.isSupported).toBe(true);
        });

        it('isSupported returns false when SpeechRecognition is missing', async () => {
            const origWebkit = window.webkitSpeechRecognition;
            const origNative = window.SpeechRecognition;

            delete window.webkitSpeechRecognition;
            delete window.SpeechRecognition;

            vi.resetModules();
            const mod = await import('../hooks/useSpeechToText');
            const { result } = renderHook(() => mod.default());

            expect(result.current.isSupported).toBe(false);

            // Restore
            window.webkitSpeechRecognition = origWebkit;
            if (origNative) window.SpeechRecognition = origNative;
        });
    });

    // ── Start / Stop Listening ────────────────────────────────────────────
    describe('startListening / stopListening', () => {
        it('toggles isListening via start and stop', () => {
            const { result } = renderHook(() => useSpeechToText());

            expect(result.current.isListening).toBe(false);

            act(() => result.current.startListening());
            expect(result.current.isListening).toBe(true);

            act(() => result.current.stopListening());
            expect(result.current.isListening).toBe(false);
        });

        it('sets error when browser does not support speech', async () => {
            const origWebkit = window.webkitSpeechRecognition;
            const origNative = window.SpeechRecognition;

            delete window.webkitSpeechRecognition;
            delete window.SpeechRecognition;

            vi.resetModules();
            const mod = await import('../hooks/useSpeechToText');
            const { result } = renderHook(() => mod.default());

            act(() => result.current.startListening());

            expect(result.current.error).toContain('not supported');
            expect(result.current.isListening).toBe(false);

            // Restore
            window.webkitSpeechRecognition = origWebkit;
            if (origNative) window.SpeechRecognition = origNative;
        });
    });

    // ── Transcript ────────────────────────────────────────────────────────
    describe('transcript handling', () => {
        it('resetTranscript clears both transcript and interimTranscript', () => {
            const { result } = renderHook(() => useSpeechToText());

            // Start listening first to initialize recognition
            act(() => result.current.startListening());

            act(() => result.current.resetTranscript());

            expect(result.current.transcript).toBe('');
            expect(result.current.interimTranscript).toBe('');
        });
    });

    // ── Error Handling ────────────────────────────────────────────────────
    describe('error handling', () => {
        it('does not start listening if already listening', () => {
            const { result } = renderHook(() => useSpeechToText());

            act(() => result.current.startListening());
            expect(result.current.isListening).toBe(true);

            // Calling again should not throw
            act(() => result.current.startListening());
            expect(result.current.isListening).toBe(true);
        });

        it('stopListening is a no-op when not listening', () => {
            const { result } = renderHook(() => useSpeechToText());

            // Should not throw
            act(() => result.current.stopListening());
            expect(result.current.isListening).toBe(false);
        });
    });
});
