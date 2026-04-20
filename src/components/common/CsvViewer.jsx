import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { getCachedUrl } from '../../services/fileCache';

const CsvViewer = ({ file }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchAndRender = async () => {
            try {
                setLoading(true);
                const url = await getCachedUrl(file);
                Papa.parse(url, {
                    download: true,
                    header: false,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (mounted) {
                            setData(results.data);
                            setLoading(false);
                        }
                    },
                    error: (err) => {
                        if (mounted) {
                            setError('Failed to parse CSV document: ' + err.message);
                            setLoading(false);
                        }
                    }
                });
            } catch (err) {
                if (mounted) {
                    console.log(err);
                    setError('Failed to load CSV document.');
                    setLoading(false);
                }
            }
        };
        fetchAndRender();
        return () => { mounted = false; };
    }, [file]);

    if (loading) {
        return (
            <div className="flex flex-col items-center gap-4 text-[var(--brand-primary)]">
                <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                <span className="text-sm font-medium animate-pulse">Loading CSV...</span>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 font-medium">{error}</div>;
    }

    return (
        <div className="bg-[var(--bg-card)] p-4 md:p-6 shadow-2xl rounded-lg w-full max-w-6xl max-h-[85vh] flex flex-col">
            <div className="overflow-auto border border-[var(--border-color)] rounded-lg flex-1">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors">
                                {Object.values(row).map((cell, cellIndex) => (
                                    <td key={cellIndex} className={`px-4 py-2 border-r border-[var(--border-color)] ${rowIndex === 0 ? 'font-bold bg-[var(--bg-secondary)]' : ''}`}>
                                        {cell !== undefined && cell !== null ? String(cell) : ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr><td className="px-4 py-8 text-center text-[var(--text-secondary)]">CSV is empty</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CsvViewer;
