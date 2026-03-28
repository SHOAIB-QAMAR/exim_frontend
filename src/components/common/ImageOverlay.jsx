import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaXmark } from 'react-icons/fa6';

/**
 * A full-screen or container-relative image overlay/modal.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the overlay is visible.
 * @param {string} props.imageUrl - The URL of the image to display.
 * @param {string} [props.altText="Image preview"] - Accessibility text for the image.
 * @param {Function} props.onClose - Callback to close the overlay.
 */
const ImageOverlay = ({ isOpen, imageUrl, altText = "Image preview", onClose }) => {
    // Determine the portal target container
    const container = isOpen ? (document.getElementById('chat-area-container') || document.body) : null;

    useEffect(() => {
        if (!container) return;

        // Prevent body scrolling when the overlay is open
        if (isOpen) {
            const originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalStyle || 'unset';
            };
        }
    }, [isOpen, container]);

    if (!isOpen || !imageUrl || !container) return null;

    const isChatArea = container.id === 'chat-area-container';
    const positionClass = isChatArea ? 'absolute inset-0' : 'fixed inset-0';

    const modalContent = (
        <div 
            className={`${positionClass} z-[10000] bg-[var(--bg-primary)]/60 backdrop-blur animate-in fade-in duration-300 flex items-center justify-center p-4`}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Image Overlay"
        >
            <button
                type="button"
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                title="Close"
                aria-label="Close overlay"
            >
                <FaXmark className="text-3xl" />
            </button>

            <img
                src={imageUrl}
                alt={altText}
                className="max-w-full max-h-[90%] object-contain rounded-lg shadow-2xl transition-transform duration-300 scale-100 hover:scale-[1.02]"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );

    return createPortal(modalContent, container);
};

export default ImageOverlay;
