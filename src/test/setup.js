import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ─── Global WebSocket mock ───────────────────────────────────────────────────
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;
        this.send = vi.fn();
        this.close = vi.fn(() => {
            this.readyState = MockWebSocket.CLOSED;
        });
    }
}

// Assign both instance and static constants
MockWebSocket.prototype.CONNECTING = 0;
MockWebSocket.prototype.OPEN = 1;
MockWebSocket.prototype.CLOSING = 2;
MockWebSocket.prototype.CLOSED = 3;

globalThis.WebSocket = MockWebSocket;

// ─── SpeechRecognition mock ──────────────────────────────────────────────────
class MockSpeechRecognition {
    constructor() {
        this.continuous = false;
        this.interimResults = false;
        this.lang = '';
        this.onstart = null;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
    }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
}

globalThis.webkitSpeechRecognition = MockSpeechRecognition;

// ─── navigator.sendBeacon mock ───────────────────────────────────────────────
if (!navigator.sendBeacon) {
    navigator.sendBeacon = vi.fn(() => true);
}

// ─── PerformanceObserver mock ────────────────────────────────────────────────
if (typeof globalThis.PerformanceObserver === 'undefined') {
    globalThis.PerformanceObserver = class {
        constructor() { }
        observe() { }
        disconnect() { }
    };
}
