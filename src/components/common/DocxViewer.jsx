import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { getCachedUrl } from '../../services/fileCache';

const DocxViewer = ({ file }) => {
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchAndRender = async () => {
            try {
                setLoading(true);
                const url = await getCachedUrl(file);
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                if (mounted) {
                    setHtml(result.value);
                }
            } catch (err) {
                if (mounted) setError('Failed to load DOCX document.');
                console.error(err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchAndRender();
        return () => { mounted = false; };
    }, [file]);

    if (loading) {
        return (
            <div className="flex flex-col items-center gap-4 text-[var(--brand-primary)]">
                <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                <span className="text-sm font-medium animate-pulse">Loading Document...</span>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 font-medium">{error}</div>;
    }

    return (
        <div className="bg-white p-8 md:p-12 shadow-2xl rounded-lg max-w-4xl w-full text-[var(--text-primary)]" style={{ backgroundColor: 'white' }}>
            <div 
                className="max-w-none docx-preview-content [&>p]:mb-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-3 [&>table]:w-full [&>table]:border-collapse [&>td]:border [&>td]:border-gray-300 [&>td]:p-2 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4"
                dangerouslySetInnerHTML={{ __html: html }} 
            />
        </div>
    );
};

export default DocxViewer;
