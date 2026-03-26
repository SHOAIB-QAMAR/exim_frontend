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
            // --app-height: The exact height of the visible area above the keyboard.
            // By setting this on <html>, we force the entire app to shrink into 
            // the available space, preventing document-level scrolling and gaps.
            const appHeight = vv.height;
            document.documentElement.style.setProperty('--app-height', `${appHeight}px`);
        };

        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);

        // Initial set
        update();

        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
            document.documentElement.style.removeProperty('--app-height');
        };
    }, []);
};

export default useKeyboardHeight;
