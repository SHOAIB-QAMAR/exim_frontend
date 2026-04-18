import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getCachedUrl } from '../../services/fileCache';

const ExcelViewer = ({ file }) => {
    const [sheetData, setSheetData] = useState([]);
    const [sheetNames, setSheetNames] = useState([]);
    const [activeSheet, setActiveSheet] = useState(0);
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
                
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                if (mounted) {
                    setSheetNames(workbook.SheetNames);
                    const currentSheetName = workbook.SheetNames[activeSheet];
                    const worksheet = workbook.Sheets[currentSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    setSheetData(jsonData);
                }
            } catch (err) {
                if (mounted) setError('Failed to load Excel document.');
                console.error(err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchAndRender();
        return () => { mounted = false; };
    }, [file, activeSheet]);

    if (loading) {
        return (
             <div className="flex flex-col items-center gap-4 text-[var(--brand-primary)]">
                <span className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full" />
                <span className="text-sm font-medium animate-pulse">Loading Spreadsheet...</span>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 font-medium">{error}</div>;
    }

    return (
        <div className="bg-[var(--bg-card)] p-4 md:p-6 shadow-2xl rounded-lg w-full max-w-6xl max-h-[85vh] flex flex-col">
            {sheetNames.length > 1 && (
                <div className="flex gap-2 overflow-x-auto mb-4 border-b border-[var(--border-color)] pb-2 scrollbar-none shrink-0">
                    {sheetNames.map((name, idx) => (
                        <button
                            key={name}
                            onClick={() => setActiveSheet(idx)}
                            className={`px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap text-sm font-medium ${activeSheet === idx ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-primary)]'}`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
            <div className="overflow-auto border border-[var(--border-color)] rounded-lg flex-1">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <tbody>
                        {sheetData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors">
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className={`px-4 py-2 border-r border-[var(--border-color)] ${rowIndex === 0 ? 'font-bold bg-[var(--bg-secondary)]' : ''}`}>
                                        {cell !== undefined && cell !== null ? String(cell) : ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {sheetData.length === 0 && (
                            <tr><td className="px-4 py-8 text-center text-[var(--text-secondary)]">Sheet is empty</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ExcelViewer;
