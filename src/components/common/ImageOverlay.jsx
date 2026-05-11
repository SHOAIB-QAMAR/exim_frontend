import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaXmark, FaDownload } from 'react-icons/fa6';
const PdfViewer = React.lazy(() => import('./PdfViewer'));
import { getCachedUrl } from '../../services/fileCache';

/**
 * A full-screen or container-relative media overlay/modal.
 * Supports both images and PDF documents.
 * Uses fileCache to avoid re-fetching on repeat opens.
 */
const ImageOverlay = ({ isOpen, imageUrl, altText = "Media preview", onClose }) => {

    const [availableWidth, setAvailableWidth] = useState(1200);
    const [cachedUrl, setCachedUrl] = useState(null);
    const wrapperRef = useRef(null);

    const pdfPageWidth = Math.min(availableWidth * 0.85, 900);

    // Cache the remote URL into a local blob on open
    const actuallyLoading = isOpen && imageUrl && !cachedUrl;

    useEffect(() => {
        if (!isOpen || !imageUrl) return;

        let cancelled = false;

        getCachedUrl(imageUrl).then(url => {
            if (!cancelled) {
                setCachedUrl(url);
            }
        });

        return () => {
            cancelled = true;
            setCachedUrl(null);
        };
    }, [isOpen, imageUrl]);

    // ResizeObserver for dynamic PDF width
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

    const container = isOpen ? (document.getElementById('chat-area-container') || document.body) : null;

    useEffect(() => {
        if (!container || !isOpen) return;
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = originalStyle || 'unset'; };
    }, [isOpen, container]);

    const handleDownload = async (e) => {
        e.stopPropagation();
        const urlToDownload = cachedUrl || imageUrl;
        if (!urlToDownload) return;

        try {
            const response = await fetch(urlToDownload);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;

            // Extract filename from URL or use default
            const urlParts = imageUrl.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            const fileName = lastPart.includes('.') ? lastPart : (imageUrl.toLowerCase().includes('.pdf') ? 'document.pdf' : 'image.png');

            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(urlToDownload, '_blank');
        }
    };

    if (!isOpen || !imageUrl || !container) return null;

    const isPdf = imageUrl.toLowerCase().includes('.pdf');
    const isChatArea = container.id === 'chat-area-container';
    const positionClass = isChatArea ? 'absolute inset-0' : 'fixed inset-0';

    const modalContent = (
        <div
            ref={wrapperRef}
            className={`${positionClass} z-[10000] bg-[var(--bg-primary)]/95 backdrop-blur-md animate-in fade-in duration-300 flex flex-col`}
            onClick={onClose}
        >
            {/* Static Header Action Bar */}
            <div
                className="w-full flex justify-end items-center px-4 py-2 bg-[var(--bg-primary)] border-b border-[var(--border-color)] gap-2 z-[10001]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:bg-black/5 rounded-lg transition-all flex items-center gap-2 group"
                    onClick={handleDownload}
                    title="Download"
                >
                    <FaDownload className="text-sm md:text-base group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold hidden md:inline">Download</span>
                </button>

                <div className="w-px h-4 bg-[var(--border-color)] mx-1" />

                <button
                    type="button"
                    className="p-2 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    title="Close"
                >
                    <FaXmark className="text-lg md:text-xl" />
                </button>
            </div>

            {/* Scrollable Content Area */}
            <div
                className={`flex-1 w-full overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 flex ${isPdf ? 'items-start justify-center' : 'items-center justify-center'} p-2 md:p-6`}
                onClick={(e) => e.stopPropagation()}
            >
                {actuallyLoading ? (
                    <div className="flex flex-col items-center gap-4 text-[var(--brand-primary)]">
                        <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                        <span className="text-sm font-medium animate-pulse">Loading...</span>
                    </div>
                ) : isPdf ? (
                    <React.Suspense fallback={
                        <div className="flex flex-col items-center gap-4 text-[var(--brand-primary)]">
                            <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                            <span className="text-sm font-medium animate-pulse">Loading Document Engine...</span>
                        </div>
                    }>
                        <div className="w-full max-w-full">
                            <PdfViewer
                                file={cachedUrl || imageUrl}
                                width={pdfPageWidth}
                            />
                        </div>
                    </React.Suspense>
                ) : (
                    <img
                        src={cachedUrl || imageUrl}
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