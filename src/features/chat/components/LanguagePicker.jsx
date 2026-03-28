import React, { useState, useMemo, useEffect, useRef } from 'react';
import LANGUAGES from '../../../config/languages';

/**
 * LanguagePicker Component
 * 
 * An overlay panel that allows users to search and select a language for 
 * real-time transcription and translation.
 * 
 * @param {Object} props
 * @param {Object} props.selectedLang - The currently active language object
 * @param {Function} props.onSelectLang - Callback when a language is selected
 * @param {Function} props.onClose - Callback to close the picker overlay
 */
const LanguagePicker = ({ selectedLang, onSelectLang, onClose }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const activeItemRef = useRef(null);

    // Automatically scroll the selected language into view when the panel opens
    useEffect(() => {
        if (activeItemRef.current) {
            activeItemRef.current.scrollIntoView({
                behavior: 'auto',
                block: 'center'
            });
        }
    }, []);

    const filteredLanguages = useMemo(() => LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [searchTerm]);

    return (
        <>
            <div className="fixed inset-0 z-[40]" onClick={onClose}></div>
            <div className="language-panel absolute top-[64px] right-4 w-56 max-h-[320px] bg-[var(--bg-card)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] flex flex-col z-[50] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 border border-[var(--border-color)] rounded-xl">
                <div className="panel-header flex items-center gap-3 p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <input
                        type="text"
                        className="language-search flex-1 w-full p-2 text-xs rounded-md border border-[var(--border-color)] outline-none bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--brand-primary)] placeholder:text-[var(--text-tertiary)]"
                        placeholder="Search language..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                    />
                </div>
                <div className="language-grid p-1.5 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">
                    {filteredLanguages.map((lang, idx) => {
                        const isActive = selectedLang.name === lang.name;
                        return (
                            <div
                                key={idx}
                                ref={isActive ? activeItemRef : null}
                                className={`lang-item flex items-center gap-3 p-2 text-sm cursor-pointer rounded-md transition-all text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] ${isActive ? 'active bg-[var(--bg-tertiary)] text-[var(--brand-primary)] font-semibold' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectLang(lang);
                                }}
                            >
                                <img src={lang.flag} alt="Flag" className="w-5 h-5 rounded-full shrink-0 object-cover border border-[var(--border-color)]" />
                                <span className="truncate flex-1">{lang.name}</span>
                                {isActive && <span className="text-[var(--status-attentive)] text-xs">●</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default LanguagePicker;
