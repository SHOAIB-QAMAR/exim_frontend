import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaXmark } from 'react-icons/fa6';
const PdfViewer = React.lazy(() => import('./PdfViewer'));
const DocxViewer = React.lazy(() => import('./DocxViewer'));
const ExcelViewer = React.lazy(() => import('./ExcelViewer'));
const CsvViewer = React.lazy(() => import('./CsvViewer'));
import { getCachedUrl } from '../../services/fileCache';

/**
 * A full-screen or container-relative media overlay/modal.
 * Supports images, PDF, DOCX, XLSX, and CSV documents.
 * Uses fileCache to avoid re-fetching on repeat opens.
 */
const UniversalOverlay = ({ isOpen, imageUrl, fileName, altText = "Media preview", onClose }) => {

    const [availableWidth, setAvailableWidth] = useState(1200);
    const [cachedUrl, setCachedUrl] = useState(null);
    const wrapperRef = useRef(null);

    const pdfPageWidth = Math.min(availableWidth * 0.95, 1200);

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

    if (!isOpen || !imageUrl || !container) return null;

    const sourceString = (fileName || imageUrl).toLowerCase();
    const isDocx = sourceString.includes('.docx');
    const isXlsx = sourceString.includes('.xlsx') || sourceString.includes('.xls');
    const isCsv = sourceString.includes('.csv');
    const isPdf = sourceString.includes('.pdf');
    const isDocument = isPdf || isDocx || isXlsx || isCsv;

    const isChatArea = container.id === 'chat-area-container';
    const positionClass = isChatArea ? 'absolute inset-0' : 'fixed inset-0';
    
    const renderViewer = () => {
        if (isPdf) {
            return <PdfViewer file={cachedUrl || imageUrl} width={pdfPageWidth} />;
        } else if (isDocx) {
            return <DocxViewer file={cachedUrl || imageUrl} />;
        } else if (isXlsx) {
            return <ExcelViewer file={cachedUrl || imageUrl} />;
        } else if (isCsv) {
            return <CsvViewer file={cachedUrl || imageUrl} />;
        } else {
             return (
                 <img
                    src={cachedUrl || imageUrl}
                    alt={altText}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-500 scale-100 hover:scale-[1.01]"
                 />
             );
        }
    };

    const modalContent = (
        <div
            ref={wrapperRef}
            className={`${positionClass} z-[10000] bg-[var(--bg-primary)]/80 backdrop-blur-md animate-in fade-in duration-300 flex items-center justify-center p-4 md:p-8`}
            onClick={onClose}
        >
            <button
                type="button"
                className="absolute top-4 right-4 md:top-6 md:right-6 bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] text-[var(--text-primary)] rounded-full transition-all shadow-lg z-[10001] border border-[var(--border-color)] p-3"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                title="Close"
            >
                <FaXmark className="text-lg md:text-xl" />
            </button>

            <div className={`w-full h-full flex overflow-auto scrollbar-none ${isDocument ? 'items-start justify-center' : 'items-center justify-center'}`} onClick={(e) => e.stopPropagation()}>
                {actuallyLoading ? (
                    <div className="flex flex-col items-center justify-center h-full w-full gap-4 text-[var(--brand-primary)]">
                        <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                        <span className="text-sm font-medium animate-pulse">Loading Asset...</span>
                    </div>
                ) : (
                    <React.Suspense fallback={
                        <div className="flex flex-col items-center justify-center h-full w-full gap-4 text-[var(--brand-primary)]">
                            <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                            <span className="text-sm font-medium animate-pulse">Loading Document Engine...</span>
                        </div>
                    }>
                        {renderViewer()}
                    </React.Suspense>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, container);
};

export default UniversalOverlay;
