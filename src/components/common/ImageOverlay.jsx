import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaXmark, FaChevronLeft, FaChevronRight } from 'react-icons/fa6';
import { Document, Page } from 'react-pdf';

/**
 * A full-screen or container-relative media overlay/modal.
 * Supports both images and PDF documents.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the overlay is visible.
 * @param {string} props.imageUrl - The URL of the image or PDF to display.
 * @param {string} [props.altText="Media preview"] - Accessibility text.
 * @param {Function} props.onClose - Callback to close the overlay.
 */
const ImageOverlay = ({ isOpen, imageUrl, altText = "Media preview", onClose }) => {
    const [numPages, setNumPages] = useState(null);
    const [availableWidth, setAvailableWidth] = useState(1200);
    const wrapperRef = useRef(null);

    // Dynamic width calculation: 95% of the *container's* actual width up to a maximum of 1200px
    const pdfPageWidth = Math.min(availableWidth * 0.95, 1200);

    // Use ResizeObserver to track the actual available space in the container or portal
    useEffect(() => {
        if (!wrapperRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setAvailableWidth(entry.contentRect.width);
            }
        });

        observer.observe(wrapperRef.current);
        return () => observer.disconnect();
    }, [isOpen]);

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

    const isPdf = imageUrl.toLowerCase().includes('.pdf') || imageUrl.startsWith('blob:');
    const isChatArea = container.id === 'chat-area-container';
    const positionClass = isChatArea ? 'absolute inset-0' : 'fixed inset-0';

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    const modalContent = (
        <div
            ref={wrapperRef}
            className={`${positionClass} z-[10000] bg-[var(--bg-primary)]/80 backdrop-blur-md animate-in fade-in duration-300 flex items-center justify-center p-4 md:p-8`}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Media Overlay"
        >
            <button
                type="button"
                className="absolute top-4 right-4 md:top-6 md:right-6 bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] text-[var(--text-primary)] rounded-full transition-all shadow-lg z-[10001] border border-[var(--border-color)]"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                title="Close"
                aria-label="Close overlay"
            >
                <FaXmark className="text-lg md:text-xl" />
            </button>

            <div className={`w-full h-full flex overflow-auto scrollbar-none ${isPdf ? 'items-start justify-center' : 'items-center justify-center'}`} onClick={(e) => e.stopPropagation()}>
                {isPdf ? (
                    <div className="flex flex-col gap-4 py-8">
                        <Document
                            file={imageUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            className="flex flex-col items-center gap-6"
                            loading={
                                <div className="flex flex-col items-center gap-4 text-[var(--brand-primary)]">
                                    <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                                    <span className="text-sm font-medium animate-pulse">Loading Document...</span>
                                </div>
                            }
                        >
                            {Array.from(new Array(numPages), (el, index) => (
                                <div key={`page_${index + 1}`} className="shadow-2xl rounded-lg overflow-hidden border border-[var(--border-color)]">
                                    <Page
                                        pageNumber={index + 1}
                                        width={pdfPageWidth}
                                        renderAnnotationLayer={false}
                                        renderTextLayer={false}
                                    />
                                </div>
                            ))}
                        </Document>
                    </div>
                ) : (
                    <img
                        src={imageUrl}
                        alt={altText}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-500 scale-100 hover:scale-[1.01]"
                    />
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, container);
};

export default ImageOverlay;
