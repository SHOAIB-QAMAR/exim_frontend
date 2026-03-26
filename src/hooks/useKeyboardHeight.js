import { useEffect } from 'react';

/**
 * useKeyboardHeight
 *
 * Tracks the virtual keyboard height on mobile using the VisualViewport API
 * and writes the value as --keyboard-height on <html> so CSS can react to it.
 *
 * Works alongside `interactive-widget=resizes-visual` in the viewport meta tag:
 *   - Chrome 108+ Android: keyboard overlays, no layout reflow at all
 *   - Older Chrome / iOS Safari: this hook detects the resize and adjusts via CSS var
 *
 * No return value — side-effect only hook.
 */
const useKeyboardHeight = () => {
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return; // Desktop / unsupported — no-op

        const update = () => {
            // Keyboard height = full layout height minus the visible visual viewport height.
            // We deliberately do NOT subtract vv.offsetTop here: that value represents
            // how much the browser has scrolled the visual viewport upward to keep the
            // focused input in view — it is NOT part of the keyboard size. Including it
            // caused the padding-bottom to be massively over-inflated on the second focus,
            // pushing the header off screen.
            const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
            document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
        };

        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);

        // Run once on mount to initialise the variable
        update();

        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
            // Reset on unmount
            document.documentElement.style.removeProperty('--keyboard-height');
        };
    }, []);
};

export default useKeyboardHeight;
