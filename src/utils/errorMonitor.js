

/**
 * Global Error Monitor
 * 
 * Catches uncaught errors and unhandled promise rejections.
 * In production, these can be forwarded to an error reporting service (e.g., Sentry).
 * 
 * Call `initErrorMonitoring()` once in main.jsx to activate.
 */

const ERROR_REPORT_ENDPOINT = import.meta.env.VITE_ERROR_REPORT_URL || null;

/**
 * Reports an error to the monitoring backend (if configured).
 * Falls back to logger.error if no endpoint is set.
 */
export const reportError = (errorData) => {
    console.error('[ErrorMonitor]', errorData);

    // If an error reporting endpoint is configured, send the error
    if (ERROR_REPORT_ENDPOINT) {
        try {
            // Use navigator.sendBeacon for reliability (works even during page unload)
            const payload = JSON.stringify({
                ...errorData,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
            });

            if (navigator.sendBeacon) {
                navigator.sendBeacon(ERROR_REPORT_ENDPOINT, payload);
            } else {
                fetch(ERROR_REPORT_ENDPOINT, {
                    method: 'POST',
                    body: payload,
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true,
                }).catch(() => { });
            }
        } catch {
            // Silently fail — we don't want error reporting to cause more errors
        }
    }
};

/**
 * Initializes global error monitoring.
 * Should be called once at app startup (e.g., in main.jsx).
 */
export const initErrorMonitoring = () => {
    // Catch uncaught synchronous errors
    window.onerror = (message, source, lineno, colno, error) => {
        reportError({
            type: 'uncaught_error',
            message,
            source,
            lineno,
            colno,
            stack: error?.stack,
        });
        // Return false to allow default browser error handling
        return false;
    };

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        reportError({
            type: 'unhandled_rejection',
            message: event.reason?.message || String(event.reason),
            stack: event.reason?.stack,
        });
    });

};

