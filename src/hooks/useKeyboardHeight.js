import { useEffect } from 'react';

/**
 * useKeyboardHeight Hook
 * 
 * Tracks the virtual keyboard height on mobile devices using the VisualViewport API.
 * It writes the current visible viewport height to a CSS custom property `--app-height` 
 * on the document element. This allows CSS to react and prevent layout breakage 
 * when the keyboard appears.
 *
 * Requirements:
 * Works alongside `interactive-widget=resizes-visual` in the viewport meta tag.
 *
 * @example
 * // In main App or Layout component
 * useKeyboardHeight();
 * 
 * // In CSS
 * .container {
 *   height: var(--app-height, 100vh);
 * }
 */
const useKeyboardHeight = () => {
    useEffect(() => {
        // Only run on the client side
        if (typeof window === 'undefined') return;

        const vv = window.visualViewport;
        if (!vv) return; // Desktop or unsupported browsers

        /**
         * Updates the --app-height CSS variable to the current visual viewport height.
         * This prevents the "jumping" behavior on mobile when the keyboard toggles.
         */
        const updateHeight = () => {
            const currentHeight = vv.height;
            document.documentElement.style.setProperty('--app-height', `${currentHeight}px`);
        };

        // Attach listeners for both resize (keyboard popup) and scroll (viewport offset changes)
        vv.addEventListener('resize', updateHeight);
        vv.addEventListener('scroll', updateHeight);

        // Initial trigger
        updateHeight();

        // Cleanup: remove listeners and the CSS property when the hook unmounts
        return () => {
            vv.removeEventListener('resize', updateHeight);
            vv.removeEventListener('scroll', updateHeight);
            document.documentElement.style.removeProperty('--app-height');
        };
    }, []);
};

export default useKeyboardHeight;
