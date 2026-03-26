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
            /** 
             * --app-height: The actual visible height of the browser's 
             * drawing area, excluding the virtual keyboard.
             * 
             * By setting this on the root element, we can force the 
             * app container to 'shrink' to fit the space above the 
             * keyboard, preventing the browser from scrolling the 
             * page body and creating gaps.
             */
            const appHeight = vv.height;
            document.documentElement.style.setProperty('--app-height', `${appHeight}px`);
        };

        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);

        // Run once on mount to initialise the variable
        update();

        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
            // Reset on unmount
            document.documentElement.style.removeProperty('--app-height');
        };
    }, []);
};

export default useKeyboardHeight;
