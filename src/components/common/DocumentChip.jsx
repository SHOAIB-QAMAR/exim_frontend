import React from 'react';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFileCsv, FaFileAlt } from 'react-icons/fa';

const getDocumentMetadata = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf':
            return { icon: FaFilePdf, color: '#f83c3c', label: 'PDF' };
        case 'docx':
        case 'doc':
            return { icon: FaFileWord, color: '#2b579a', label: 'WORD' };
        case 'xlsx':
        case 'xls':
            return { icon: FaFileExcel, color: '#217346', label: 'EXCEL' };
        case 'csv':
            return { icon: FaFileCsv, color: '#1d6f42', label: 'CSV' };
        default:
            return { icon: FaFileAlt, color: '#6b7280', label: 'FILE' };
    }
};

const DocumentChip = ({ name, url, pageCount, truncated, onClick, className = '' }) => {
    const { icon: Icon, color, label } = getDocumentMetadata(name || url || '');

    return (
        <div
            className={`flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl cursor-pointer hover:opacity-80 transition-all group/doc shrink-0 w-[240px] ${className}`}
            onClick={onClick}
        >
            <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover/doc:scale-105"
                style={{ backgroundColor: color }}
            >
                <Icon className="text-white text-xl" />
            </div>
            <div className="flex flex-col min-w-0 overflow-hidden pr-2 text-left">
                <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                    {name || 'Document'}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium tracking-wide flex items-center gap-1 uppercase">
                    <span>{label}</span>
                    {pageCount && (
                        <>
                            <span className="opacity-50">•</span>
                            <span className="truncate">{pageCount} pg{pageCount > 1 ? 's' : ''}{truncated ? '+' : ''}</span>
                        </>
                    )}
                </span>
            </div>
        </div>
    );
};

export default DocumentChip;
