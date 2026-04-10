import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker for consistent rendering across previews and overlays
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Isolated PDF Viewing component to allow for lazy loading of the heavy react-pdf library.
 */
const PdfViewer = ({ file, width }) => {
    const [numPages, setNumPages] = useState(null);

    const handleLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    return (
        <div className="flex flex-col gap-4 py-8">
            <Document
                file={file}
                onLoadSuccess={handleLoadSuccess}
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
                            width={width}
                            renderAnnotationLayer={false} // Disables the rendering of links, forms, and interactive notes, if you only want a "read-only" visual.
                            renderTextLayer={false}       // Disables the invisible layer of text that sits on top of the PDF
                        />
                    </div>
                ))}
            </Document>
        </div>
    );
};

export default PdfViewer;
