import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* Reusable Tooltip Component using React Portal and Tailwind CSS.
 * It uses `createPortal` to render the tooltip directly into `document.body` to avoid being clipped by parent containers with `overflow: hidden` or `z-index` stacking contexts.
 * @param {Object} props || @param {string|React.ReactNode} props.content - Content to display inside the tooltip || @param {React.ReactNode} props.children - The element that triggers the tooltip on hover || @param {string} props.position - Preferred position: 'top', 'bottom', 'left', 'right' (default: 'top') || @param {boolean} props.disabled - specific manual disable flag; prevents tooltip from showing || @param {string} props.className - Custom classes applied to the inline-block wrapper around the children || @param {number} props.delay - Delay in ms before showing tooltip on mouse hover (default: 200) */

const Tooltip = ({
    content,
    children,
    position = 'top',
    disabled = false,
    className = '',
    delay = 200
}) => {
    const [isVisible, setIsVisible] = useState(false);

    const [coords, setCoords] = useState({ top: 0, left: 0 });

    // Reference to the wrapper div surrounding the children.
    const triggerRef = useRef(null);

    // Reference to the timeout timer used for the hover delay to prevent rapid flickering
    const timerRef = useRef(null);

    // ── POSITIONING LOGIC ──
    const updatePosition = React.useCallback(() => {

        if (!triggerRef.current || !isVisible) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const gap = 8;

        let top = 0;
        let left = 0;

        // Keep in mind the `getTransform()` function below applies CSS translations (-50%, -100%) relative to this anchor point to properly align the center borders.
        switch (position) {
            case 'top':
                // Anchor: centered above the trigger. 
                // Transform will shift it UP by 100% of the tooltip's height and LEFT by 50% of the tooltip's width.
                top = rect.top - gap;
                left = rect.left + rect.width / 2;
                break;
            case 'bottom':
                // Anchor: centered below the trigger.
                // Transform will shift it LEFT by 50% of the tooltip's width.
                top = rect.bottom + gap;
                left = rect.left + rect.width / 2;
                break;
            case 'left':
                // Anchor: left edge, vertically centered.
                // Transform will shift it LEFT by 100% of tooltip's width, UP by 50% of tooltip's height.
                top = rect.top + rect.height / 2;
                left = rect.left - gap;
                break;
            case 'right':
                // Anchor: right edge, vertically centered.
                // Transform will shift it UP by 50% of tooltip's height.
                top = rect.top + rect.height / 2;
                left = rect.right + gap;
                break;
            default:
                // Fallback to bottom
                top = rect.bottom + gap;
                left = rect.left + rect.width / 2;
        }

        setCoords({ top, left });
    }, [isVisible, position]);

    // ── EVENT LISTENERS FOR DYNAMIC REPOSITIONING ──
    useEffect(() => {
        if (isVisible) {
            // Wrapping in requestAnimationFrame avoids the "cascading render" lint warning
            // by deferring the state update until the browser is ready to paint.
            requestAnimationFrame(updatePosition);
 
            window.addEventListener('resize', updatePosition);
 
            // Using `true` for useCapture allows catching scroll events from any nested scrollable child elements.
            window.addEventListener('scroll', updatePosition, true);
        }

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isVisible, updatePosition]);

    // ── DISABLE OVERRIDE CLEANUP ──
    useEffect(() => {
        if (disabled && isVisible) {
            requestAnimationFrame(() => setIsVisible(false));
            if (timerRef.current) clearTimeout(timerRef.current);
        }
    }, [disabled, isVisible]);

    // ── MOUSE INTERACTION HANDLERS ──
    const handleMouseEnter = () => {
        if (disabled) return;
        timerRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsVisible(false);
    };

    // These percentages dictate how the tooltip centers itself around the absolute (top/left) coordinate anchor we calculated earlier.
    const getTransform = () => {
        switch (position) {
            case 'top': return 'translate(-50%, -100%)';  // Shift UP 100%, LEFT 50%
            case 'bottom': return 'translate(-50%, 0)';    // Shift LEFT 50%
            case 'left': return 'translate(-100%, -50%)'; // Shift LEFT 100%, UP 50%
            case 'right': return 'translate(0, -50%)';    // Shift UP 50%
            default: return 'translate(-50%, 0)';
        }
    };

    return (
        <>
            {/* ── TRIGGER WRAPPER ── */}
            {/* The invisible div wrapping the child element to intercept mouse events and provide sizing context */}
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    setIsVisible(false);
                }}
                className={`inline-block ${className}`}
            >
                {children}
            </div>

            {/* ── PORTAL RENDERING ── */}
            {/* If the tooltip should be shown, inject it directly into the <body> tag to escape DOM clipping */}
            {isVisible && createPortal(
                <div
                    // High z-index to guarantee it floats above entirely all application UI
                    className="fixed z-[10000] px-3 py-1.5 text-xs font-medium bg-white dark:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-md shadow-lg pointer-events-none transition-opacity duration-200 animate-in fade-in"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: getTransform(),
                        maxWidth: '200px',
                        whiteSpace: 'normal',
                        textAlign: 'center'
                    }}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
