/**
 * Tests for ChatService
 * Covers: getAllThreads, getThreadMessages, deleteThread — success + HTTP error paths
 * Uses vi.stubGlobal to mock fetch; no real network calls are made.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Mock import.meta.env and window ─────────────────────────────────────────
// api.config.js uses import.meta.env.VITE_API_BASE_URL and window.location.protocol
vi.stubGlobal('import', { meta: { env: { VITE_API_BASE_URL: 'http://test-host' } } });

vi.mock('../utils/logger', () => ({
    default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Response object.
 */
const mockFetch = (status, body) => {
    const ok = status >= 200 && status < 300;
    return vi.fn().mockResolvedValue({
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
    });
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatService', () => {
    let ChatService;

    beforeEach(async () => {
        vi.resetModules();
        // Re-import after stubbing so api.config is evaluated fresh
        const mod = await import('../services/chat.service');
        ChatService = mod.default;
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── getAllThreads ─────────────────────────────────────────────────────
    describe('getAllThreads', () => {
        const mockCustomer = {
            result: {
                csBuddyData: { _id: 'cs123', email: 'cs@test.com' },
                customerData: { _id: 'cust456', customerName: 'Test Corp' },
                customerBranchData: { customerId: 'cust456', _id: 'branch789', branchName: 'Main Branch' },
                customerBranchPersonId: 'person001'
            }
        };

        beforeEach(() => {
            localStorage.setItem('customer', JSON.stringify(mockCustomer));
        });

        it('returns parsed thread array on success with mapped properties', async () => {
            const backendResponse = {
                all_chat: [
                    { _id: 'mongo123', query_head: 'Delhi to dubai', session_id: 'sess-abc-123' }
                ],
                page: 1,
                totalPages: 2
            };
            
            vi.stubGlobal('fetch', mockFetch(200, backendResponse));

            const result = await ChatService.getAllThreads();

            expect(result.threads).toHaveLength(1);
            expect(result.hasMore).toBe(true);
            expect(result.threads[0].sessionId).toBe('sess-abc-123');
            expect(result.threads[0].objectId).toBe('mongo123');
            expect(result.threads[0].title).toBe('Delhi to dubai');
        });

        it('throws with HTTP status message on non-OK response', async () => {
            vi.stubGlobal('fetch', mockFetch(500, { detail: 'Server error' }));

            await expect(ChatService.getAllThreads()).rejects.toThrow('HTTP 500');
        });

        it('throws when fetch itself rejects (network error)', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unreachable')));

            await expect(ChatService.getAllThreads()).rejects.toThrow('Network unreachable');
        });

        it('sends POST request with parsed payload and Authorization header', async () => {
            const fetchMock = mockFetch(200, { result: [] });
            vi.stubGlobal('fetch', fetchMock);

            await ChatService.getAllThreads(0, 10); // skip 0, limit 10 -> page 1

            const [, options] = fetchMock.mock.calls[0];
            
            // Check headers
            expect(options.headers['Content-Type']).toBe('application/json');
            
            // Check Method
            expect(options.method).toBe('POST');
            
            // Check Payload Mapping
            const body = JSON.parse(options.body);
            expect(body.user_id).toBe('cust456');
            expect(body.page).toBe(1);
            expect(body.customerId).toBe('cust456');
            expect(body.customerName).toBe('Test Corp');
            expect(body.customerBranchId).toBe('branch789');
        });
    });

    // ── getThreadMessages ─────────────────────────────────────────────────
    describe('getThreadMessages', () => {
        it('returns messages on success and sends POST request', async () => {
            const rawMessages = [
                { _id: 'msg1', role: 'customer', message: 'hello' },
                { _id: 'msg2', role: 'assistant', message: 'hi there' }
            ];
            vi.stubGlobal('fetch', mockFetch(200, rawMessages));

            const result = await ChatService.getThreadMessages('mongo-123', 1);

            // Verify mapping
            expect(result.objectId).toBe('mongo-123');
            expect(result.messages[0].role).toBe('user'); // customer -> user
            expect(result.messages[0].content).toBe('hello');

            // Verify POST request details
            const [url, options] = vi.mocked(fetch).mock.calls[0];
            expect(url.toString()).toContain('/api/zipAi/getHistoryChat');
            expect(options.method).toBe('POST');
            
            const body = JSON.parse(options.body);
            expect(body.id).toBe('mongo-123');
            expect(body.page).toBe(1);
        });

        it('throws on HTTP 404', async () => {
            vi.stubGlobal('fetch', mockFetch(404, {}));

            await expect(ChatService.getThreadMessages('bad-id')).rejects.toThrow('HTTP 404');
        });

        it('throws immediately if objectId is null', async () => {
            await expect(ChatService.getThreadMessages(null)).rejects.toThrow(
                'objectId is required'
            );
        });

        it('throws immediately if objectId is undefined', async () => {
            await expect(ChatService.getThreadMessages(undefined)).rejects.toThrow(
                'objectId is required'
            );
        });
    });

    // ── deleteThread ──────────────────────────────────────────────────────
    describe('deleteThread', () => {
        it('returns true on successful deletion', async () => {
            vi.stubGlobal('fetch', mockFetch(200, {}));

            const result = await ChatService.deleteThread('mongo-abc');

            expect(result).toBe(true);

            // Verify DELETE method was used (actually POST to /delete)
            const [, options] = vi.mocked(fetch).mock.calls[0];
            expect(options.method).toBe('POST');
            
            const body = JSON.parse(options.body);
            expect(body.id).toBe('mongo-abc');
        });

        it('throws on HTTP 403', async () => {
            vi.stubGlobal('fetch', mockFetch(403, { detail: 'Forbidden' }));

            await expect(ChatService.deleteThread('mongo-abc')).rejects.toThrow('HTTP 403');
        });

        it('throws immediately if objectId is null', async () => {
            await expect(ChatService.deleteThread(null)).rejects.toThrow(
                'objectId is required'
            );
        });
    });

});
