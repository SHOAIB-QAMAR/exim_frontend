import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tooltip from '../../../components/common/Tooltip';
import useSpeechToText from '../../../hooks/useSpeechToText';
import { useUI } from '../../../providers/UIContext';
import { FaPlus, FaMicrophone, FaStop, FaPaperPlane, FaXmark, FaImage, FaCamera, FaRotate, FaCircleCheck } from "react-icons/fa6";
import { validateImage, compressImage, uploadImageToSupabase } from '../../../services/uploadService';

/* Primary chat input area with text, image upload, webcam capture, and speech-to-text. */

const InputArea = ({ inputValue, setInputValue, onSend, mode, selectedFile, setSelectedFile, disabled = false, focusInput, setFocusInput }) => {
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const webcamRef = useRef(null);
    const menuRef = useRef(null);
    const { sidebarCollapsed } = useUI();
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [facingMode, setFacingMode] = useState('environment');
    const [notification, setNotification] = useState(null);
    const notificationTimer = useRef(null);

    const showNotification = (msg, duration = null) => {
        setNotification(msg);
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        if (duration) {
            notificationTimer.current = setTimeout(() => setNotification(null), duration);
        }
    };

    useEffect(() => {
        if (focusInput && textareaRef.current) {
            textareaRef.current.focus();
            setFocusInput(false);
        }
    }, [focusInput, setFocusInput]);

    // Close attachment menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowAttachMenu(false);
            }
        };
        if (showAttachMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAttachMenu]);

    // Speech-to-text
    const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript } = useSpeechToText({
        lang: 'en-US'
    });

    useEffect(() => {
        if (transcript) {
            const spacer = inputValue && !inputValue.endsWith(' ') ? ' ' : '';
            setInputValue(inputValue + spacer + transcript);
            resetTranscript();
        }
    }, [transcript, inputValue, setInputValue, resetTranscript]);

    // Image preview blob URL or string URL
    const previewUrl = useMemo(() => {
        if (!selectedFile) return null;
        if (typeof selectedFile === 'string') return selectedFile;
        try {
            return URL.createObjectURL(selectedFile);
        } catch {
            return null;
        }
    }, [selectedFile]);

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleSend = () => {
        if (disabled) return;
        if (inputValue.trim() || selectedFile) {
            onSend(inputValue);
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e) => {
        setInputValue(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('Image size must be less than 10MB');
                return;
            }
            
            try {
                showNotification('Image uploading...', null);
                validateImage(file);
                const compressedImage = await compressImage(file);
                const publicUrl = await uploadImageToSupabase(compressedImage);
                setSelectedFile(publicUrl);
                showNotification('Image loaded successfully', 3000);
            } catch (err) {
                console.error("Background image upload failed:", err);
                showNotification('Image upload failed', 3000);
            }
        }
        e.target.value = '';
    };

    // Webcam: capture snapshot and convert to File
    const handleCapture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            fetch(imageSrc)
                .then(res => res.blob())
                .then(async blob => {
                    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    setShowCamera(false);
                    
                    try {
                        showNotification('Image uploading...', null);
                        validateImage(file);
                        const compressedImage = await compressImage(file);
                        const publicUrl = await uploadImageToSupabase(compressedImage);
                        setSelectedFile(publicUrl);
                        showNotification('Image loaded successfully', 3000);
                    } catch (err) {
                        console.error("Camera image upload failed:", err);
                        showNotification('Image upload failed', 3000);
                    }
                });
        }
    }, [setSelectedFile]);

    const handleRemoveFile = () => setSelectedFile(null);
    const isStandalone = !mode;
    const toggleListening = () => isListening ? stopListening() : startListening();

    const videoConstraints = {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
    };

    return (
        <>
            {/* ── CAMERA OVERLAY MODAL ── */}
            {showCamera && (
                <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center">
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={videoConstraints}
                        className="w-full h-full object-cover"
                        screenshotQuality={0.85}
                    />
                    <div className="absolute bottom-0 left-0 right-0 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-8">
                        <button
                            type="button"
                            onClick={() => setShowCamera(false)}
                            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                            title="Close Camera"
                        >
                            <FaXmark className="text-xl" />
                        </button>
                        <button
                            type="button"
                            onClick={handleCapture}
                            className="rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
                            style={{ width: 72, height: 72 }}
                            title="Take Photo"
                        >
                            <div className="rounded-full border-4 border-gray-300" style={{ width: 64, height: 64 }} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                            title="Flip Camera"
                        >
                            <FaRotate className="text-lg" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── MAIN INPUT AREA ── */}
            <div className={`${isStandalone ? 'input-area shrink-0 px-4 py-4 bg-[var(--bg-primary)] border-t border-[var(--border-color)] transition-colors duration-800' : 'w-full'}`}>
                <div className={`${isStandalone ? 'container max-w-[900px] mx-auto relative' : 'relative'}`}>

                    {/* ── NOTIFICATION BANNER ── */}
                    {notification && (
                        <div 
                            className="fixed top-20 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2 rounded-full text-[var(--text-primary)] text-sm font-medium shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-[var(--border-color)] bg-[var(--bg-card)] animate-fade-in-up whitespace-nowrap"
                            style={{ 
                                left: window.innerWidth >= 1024 
                                    ? `calc(${sidebarCollapsed ? '64px' : '272px'} + (100vw - ${sidebarCollapsed ? '64px' : '272px'}) / 2)` 
                                    : '50%' 
                            }}
                        >
                            {notification === 'Image uploading...' ? (
                                <span className="animate-spin inline-block w-4 h-4 border-2 border-[var(--text-secondary)] border-t-[var(--brand-primary)] rounded-full" />
                            ) : notification === 'Image upload failed' ? (
                                <FaXmark className="text-red-500 text-sm" />
                            ) : (
                                <FaCircleCheck className="text-green-500 dark:text-green-400 text-sm" />
                            )}
                            {notification}
                        </div>
                    )}

                    {/* ── INPUT BUBBLE ── */}
                    <div className={`relative p-[1px] rounded-xl transition-all duration-500 shadow-sm hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.99]
                        ${isListening
                            ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)]'
                            : 'bg-gradient-to-r from-[var(--brand-primary)]/40 via-[var(--brand-highlight)]/40 to-[var(--brand-primary)]/40 dark:from-white/70 dark:via-white/70 dark:to-white/70 hover:from-[var(--brand-primary)] hover:via-[var(--brand-highlight)] hover:to-[var(--brand-primary)] focus-within:from-[var(--brand-primary)] focus-within:via-[var(--brand-highlight)] focus-within:to-[var(--brand-primary)] focus-within:shadow-[0_0_20px_-5px_var(--brand-primary)]'
                        }`}>

                        <div className="input-wrapper relative flex flex-col rounded-xl bg-[var(--bg-card)] transition-all duration-200 overflow-visible">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(circle_at_top_right,var(--brand-primary),transparent_70%)] opacity-[0.25] blur-2xl rounded-tr-xl pointer-events-none"></div>

                            {/* ── IMAGE PREVIEW INSIDE INPUT ── */}
                            {selectedFile && previewUrl && (
                                <div className="px-3 pt-3 pb-1">
                                    <div className="relative inline-block">
                                        <img
                                            src={previewUrl}
                                            alt="Selected"
                                            className="h-24 max-w-[200px] object-cover rounded-lg border-2 border-[var(--brand-primary)]/30 shadow-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRemoveFile}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                                            title="Remove image"
                                        >
                                            <FaXmark className="text-xs" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── INPUT ROW (+ button, textarea, action buttons) ── */}
                            <div className="flex items-end gap-2 p-3">
                                {/* "+" Menu Button */}
                                <div className="relative shrink-0 mb-0.5" ref={menuRef}>
                                    <button
                                        type="button"
                                        className={`group flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${showAttachMenu ? 'bg-[var(--brand-primary)] text-white rotate-45' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                        onClick={() => setShowAttachMenu(prev => !prev)}
                                        title="Attach"
                                    >
                                        <FaPlus className={`text-lg transition-transform duration-200 ${showAttachMenu ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-[var(--brand-primary)]'}`} />
                                    </button>

                                    {showAttachMenu && (
                                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden">
                                            <button
                                                type="button"
                                                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                onClick={() => {
                                                    fileInputRef.current?.click();
                                                    setShowAttachMenu(false);
                                                }}
                                            >
                                                <FaImage className="text-[var(--brand-primary)] text-base" />
                                                Upload Image
                                            </button>
                                            <div className="h-px bg-[var(--border-color)]" />
                                            <button
                                                type="button"
                                                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                onClick={() => {
                                                    setShowCamera(true);
                                                    setShowAttachMenu(false);
                                                }}
                                            >
                                                <FaCamera className="text-[var(--brand-primary)] text-base" />
                                                Take Photo
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    hidden
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={handleFileChange}
                                />

                                {/* Textarea */}
                                <div className="flex-1 relative w-full">
                                    <textarea
                                        ref={textareaRef}
                                        className="chat-input block w-full border-none outline-none bg-transparent text-base text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none py-2.5 max-h-[200px] overflow-y-auto scrollbar-none"
                                        placeholder={isListening ? "Listening..." : (window.innerWidth < 768 ? "Ask EximGPT" : "Send a message here...")}
                                        value={isListening ? inputValue + (interimTranscript ? " " + interimTranscript : "") : inputValue}
                                        onChange={handleInput}
                                        onKeyDown={handleKeyDown}
                                        rows={1}
                                        style={{ minHeight: '44px' }}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1 mb-0.5 shrink-0">
                                    <div className="relative flex items-center justify-center">
                                        {isListening && (
                                            <div className="absolute inset-0 bg-red-400 rounded-full animate-pulse-ring z-0"></div>
                                        )}
                                        <button
                                            type="button"
                                            className={`group flex items-center justify-center w-10 h-10 rounded-full transition-all relative z-10 ${isListening ? 'bg-red-100 text-red-600' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                            onClick={toggleListening}
                                            title={isListening ? "Stop Recording" : "Voice Input"}
                                        >
                                            {isListening ? (
                                                <FaStop className="text-red-600 text-lg animate-pulse" />
                                            ) : (
                                                <FaMicrophone className="text-[var(--text-secondary)] group-hover:text-[var(--brand-primary)] text-lg" />
                                            )}
                                        </button>
                                    </div>

                                    <Tooltip
                                        content="Response loading..."
                                        position="bottom"
                                        disabled={!disabled}
                                    >
                                        <button
                                            type="button"
                                            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${disabled
                                                ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50'
                                                : (inputValue.trim() || selectedFile)
                                                    ? 'bg-[var(--brand-primary)] text-white shadow-md hover:shadow-lg active:scale-95 cursor-pointer'
                                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed'}`}
                                            onClick={handleSend}
                                            disabled={disabled || (!inputValue.trim() && !selectedFile)}
                                        >
                                            <FaPaperPlane className="text-sm ml-0.5" />
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default InputArea;