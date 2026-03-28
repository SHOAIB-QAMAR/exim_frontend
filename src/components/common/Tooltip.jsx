import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

/**
 * A reusable Tooltip component using React Portals for overflow safety.
 * Renders into document.body to avoid clipping by parent container overflow or z-index issues.
 * 
 * @param {Object} props
 * @param {React.ReactNode|string} props.content - Tooltip text or component.
 * @param {React.ReactNode} props.children - Trigger element.
 * @param {'top'|'bottom'|'left'|'right'} [props.position='top'] - Preferred tooltip orientation.
 * @param {boolean} [props.disabled=false] - Manual override to prevent showing.
 * @param {string} [props.className=''] - Custom CSS classes for the trigger wrapper.
 * @param {number} [props.delay=200] - Delay in milliseconds before showing.
 */
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
    const triggerRef = useRef(null);
    const timerRef = useRef(null);
    const tooltipId = useId();

    /**
     * Calculates the absolute coordinates for the tooltip based on the trigger's position.
     */
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

    // Handle dynamic repositioning on resize or scroll
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

    // Ensure tooltip hides if it becomes disabled while visible
    useEffect(() => {
        if (disabled && isVisible) {
            requestAnimationFrame(() => setIsVisible(false));
            if (timerRef.current) clearTimeout(timerRef.current);
        }
    }, [disabled, isVisible]);

    const showTooltip = () => {
        if (disabled) return;
        timerRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const hideTooltip = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsVisible(false);
    };

    /**
     * Returns CSS transform values based on position to center the tooltip correctly.
     */
    const getTransform = () => {
        switch (position) {
            case 'top': return 'translate(-50%, -100%)';
            case 'bottom': return 'translate(-50%, 0)';
            case 'left': return 'translate(-100%, -50%)';
            case 'right': return 'translate(0, -50%)';
            default: return 'translate(-50%, 0)';
        }
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                onClick={hideTooltip}
                className={`inline-block ${className}`}
                aria-describedby={isVisible ? tooltipId : undefined}
                aria-haspopup="true"
            >
                {children}
            </div>

            {isVisible && createPortal(
                <div
                    id={tooltipId}
                    role="tooltip"
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
