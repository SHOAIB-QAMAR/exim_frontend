import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tooltip from '../../../components/common/Tooltip';
import { useUI } from '../../../providers/UIContext';
import { FaPlus, FaMicrophone, FaMicrophoneSlash, FaPaperPlane, FaXmark, FaImage, FaCamera, FaRotate, FaCircleCheck, FaVolumeHigh, FaVolumeXmark } from "react-icons/fa6";
import { validateImage, compressImage, uploadImageToSupabase } from '../../../services/uploadService';
import chatService from '../../../services/chat.service';

// --- LiveKit Official Libraries ---
import { RoomEvent } from 'livekit-client';
import { LiveKitRoom, RoomAudioRenderer, useRoomContext, useLocalParticipant } from '@livekit/components-react';
import '@livekit/components-styles';

// ==========================================
// 1. LiveKit Event Bridge (Runs inside Room)
// ==========================================
const getLanguageCode = (name) => {
    const map = {
        "English (IN)": "en-IN", "Hindi": "hi-IN", "Marathi": "mr-IN", "Gujarati": "gu-IN",
        "Malayalam": "ml-IN", "Tamil": "ta-IN", "Telugu": "te-IN", "Urdu": "ur-IN",
        "Arabic": "ar-SA", "Chinese": "zh-CN", "Spanish": "es-ES", "French": "fr-FR",
        "German": "de-DE", "Russian": "ru-RU", "Italian": "it-IT", "Indonesian": "id-ID",
        "Korean": "ko-KR", "Hebrew": "he-IL", "Dutch": "nl-NL", "Polish": "pl-PL",
        "Danish": "da-DK", "Swedish": "sv-SE", "Turkish": "tr-TR", "Portuguese": "pt-PT",
        "Czech": "cs-CZ", "Portuguese (BR)": "pt-BR", "Finnish": "fi-FI", "Greek": "el-GR",
        "Hungarian": "hu-HU", "Thai": "th-TH", "Bulgarian": "bg-BG", "Malay": "ms-MY",
        "Slovenian": "sl-SI", "Ukrainian": "uk-UA", "Croatian": "hr-HR", "Romania": "ro-RO",
        "Japanese": "ja-JP"
    };
    return map[name] || "en-IN";
};

// Subscribes cleanly to Room events and maps
// transcriptions directly into our React state.
function LiveKitEventBridge({ setLiveVoiceMessages, selectedLang }) {
    const room = useRoomContext();
    const segmentTracker = useRef(new Map());
    const prevLangRef = useRef(selectedLang?.name);

    // Flawlessly transmit Language changes to the AI Agent natively over the active connection
    useEffect(() => {
        if (!room || !selectedLang?.name || !room.localParticipant) return;

        if (selectedLang.name !== prevLangRef.current) {
            prevLangRef.current = selectedLang.name;
            try {
                const bcp47Code = getLanguageCode(selectedLang.name);
                
                // We broadcast three robust payload schemas to absolutely guarantee the backend STT Agent picks it up:
                // 1. JSON payload Map 
                const jsonPayload = new TextEncoder().encode(JSON.stringify({ language: bcp47Code, user_lang: bcp47Code }));
                room.localParticipant.publishData(jsonPayload, { reliable: true }).catch(()=>{});
                
                // 2. Raw String (A common standard for basic setups)
                const strPayload = new TextEncoder().encode(bcp47Code);
                room.localParticipant.publishData(strPayload, { reliable: true }).catch(()=>{});

                // 3. LiveKit Participant Attributes (The modern standard for LiveKit Agents)
                if (typeof room.localParticipant.setAttributes === 'function') {
                    room.localParticipant.setAttributes({ language: bcp47Code, user_lang: bcp47Code }).catch(()=>{});
                }
                
                console.log(`Selected Language: ${bcp47Code}`);
                console.log(`Sent language "${bcp47Code}" via LiveKit  header`);
            } catch(e) {
                console.error('Data channel language switch failed:', e);
            }
        }
    }, [room, selectedLang]);

    useEffect(() => {
        if (!room || !setLiveVoiceMessages) return;

        const handleTranscription = (segments, participant) => {
            if (!participant) return;
            const isUser = participant === room.localParticipant;
            const role = isUser ? 'user' : 'assistant';

            let updated = false;

            segments.forEach(segment => {
                const text = segment.text.trim();
                if (!text) return;

                const existingItem = segmentTracker.current.get(segment.id);
                if (!existingItem || existingItem.text !== text) {
                    // Log precisely as requested
                    console.log(`${role === 'user' ? 'USER' : 'AGENT'}: ${text}`);
                    segmentTracker.current.set(segment.id, { role, text });
                    updated = true;
                }
            });

            if (updated) {
                // Map inherently preserves insertion order reliably across distinct sequential segments
                const newMessages = [];
                for (const seg of segmentTracker.current.values()) {
                    const lastMsg = newMessages.length > 0 ? newMessages[newMessages.length - 1] : null;
                    if (lastMsg && lastMsg.role === seg.role) {
                        lastMsg.content = lastMsg.content + " " + seg.text;
                    } else {
                        newMessages.push({ role: seg.role, content: seg.text });
                    }
                }
                setLiveVoiceMessages(newMessages);
            }
        };

        room.on(RoomEvent.TranscriptionReceived, handleTranscription);

        return () => {
            room.off(RoomEvent.TranscriptionReceived, handleTranscription);
        };
    }, [room, setLiveVoiceMessages]);

    return null;
}

// ==========================================
// 2. Custom Voice UI (Runs inside Room)
// ==========================================
// Exact replica of the previously built custom
// graphical UI layout, powered simply by props.
function VoiceCallUI({ handleVoiceCancel, isVoiceConnected, soundEnabled, toggleSound }) {
    const [audioData, setAudioData] = useState(new Array(30).fill(10));
    const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

    // Explicitly enforce Mic initialization to mirror the Vanilla JS implementation
    const micInitialized = useRef(false);
    useEffect(() => {
        if (!localParticipant || micInitialized.current) return;
        micInitialized.current = true;
        console.log('Initial Microphone State: ON');
        localParticipant.setMicrophoneEnabled(true).catch(e => console.error('[VoiceCallUI] Mic start error:', e));
    }, [localParticipant]);

    // Fake pulse visualizer
    useEffect(() => {
        if (!isVoiceConnected) return;
        const iv = setInterval(() => {
            setAudioData(Array.from({ length: 30 }, () => 20 + Math.random() * 60));
        }, 100);
        return () => clearInterval(iv);
    }, [isVoiceConnected]);

    const toggleMic = async () => {
        if (localParticipant) {
            await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center pb-4 w-full animate-fade-in-up">
            {/* Visualizer */}
            <div className="flex items-center justify-center gap-[3px] h-12 w-full mb-6">
                {audioData.map((height, i) => (
                    <div
                        key={i}
                        className={`w-1.5 md:w-2 rounded-full bg-[var(--brand-primary)] ${isVoiceConnected && isMicrophoneEnabled ? 'animate-pulse' : 'opacity-40'}`}
                        style={{
                            height: isVoiceConnected && isMicrophoneEnabled ? `${height}%` : '20%',
                            transition: 'height 0.1s ease'
                        }}
                    />
                ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 md:gap-6">
                {/* Interrupt Mic */}
                <button
                    type="button"
                    className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all relative border border-[var(--border-color)] ${!isMicrophoneEnabled ? 'bg-red-50' : 'bg-white'}`}
                    onClick={toggleMic}
                    title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
                >
                    {isVoiceConnected && isMicrophoneEnabled && <div className="absolute inset-0 bg-red-400 rounded-full animate-pulse-ring z-0 opacity-40"></div>}
                    {isMicrophoneEnabled ? (
                        <FaMicrophone className="text-xl md:text-2xl text-[var(--brand-primary)] relative z-10" />
                    ) : (
                        <FaMicrophoneSlash className="text-xl md:text-2xl text-red-500 relative z-10" />
                    )}
                </button>

                {/* Cancel */}
                <button
                    type="button"
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-[var(--text-primary)] border border-[var(--border-color)] flex items-center justify-center shadow-md hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all text-red-500"
                    onClick={() => handleVoiceCancel(true)}
                    title="Close Voice Mode"
                >
                    <FaXmark className="text-lg md:text-xl" />
                </button>

                {/* Sound Toggle */}
                <button
                    type="button"
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-full border border-[var(--border-color)] flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all bg-white ${soundEnabled ? 'text-[var(--text-primary)]' : 'text-gray-400'}`}
                    onClick={toggleSound}
                    title={soundEnabled ? "Mute Output" : "Unmute Output"}
                >
                    {soundEnabled ? <FaVolumeHigh className="text-lg md:text-xl" /> : <FaVolumeXmark className="text-lg md:text-xl" />}
                </button>
            </div>
        </div>
    );
}

// ==========================================
// 3. Main Component
// ==========================================
const InputArea = ({
    inputValue, setInputValue, onSend, mode,
    selectedFile, setSelectedFile, disabled = false,
    focusInput, setFocusInput, selectedLang, activeSessionId,
    // Voice Mode props mapped from Layout.jsx
    isVoiceMode, setIsVoiceMode, setLiveVoiceMessages
}) => {
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

    // --- LiveKit Component State ---
    const [activeToken, setActiveToken] = useState(null);
    const isFetchingRef = useRef(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

    const showNotification = useCallback((msg, duration = null) => {
        setNotification(msg);
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        if (duration) {
            notificationTimer.current = setTimeout(() => setNotification(null), duration);
        }
    }, []);

    // Focus handling
    useEffect(() => {
        if (focusInput && textareaRef.current && !isVoiceMode) {
            textareaRef.current.focus();
            setFocusInput(false);
        }
    }, [focusInput, setFocusInput, isVoiceMode]);

    // External click handler for menus
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowAttachMenu(false);
            }
        };
        if (showAttachMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAttachMenu]);

    // Image preview cleanup
    const previewUrl = useMemo(() => {
        if (!selectedFile) return null;
        if (typeof selectedFile === 'string') return selectedFile;
        try { return URL.createObjectURL(selectedFile); } catch { return null; }
    }, [selectedFile]);

    useEffect(() => {
        return () => { if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);


    // --- Voice Transition Logic ---
    const fetchAndConnect = useCallback(async () => {
        if (isFetchingRef.current) return;
        try {
            isFetchingRef.current = true;
            showNotification('Connecting to LiveKit...', null);
            const langName = selectedLang?.name || 'English (IN)';
            const t = await chatService.getLiveKitToken(activeSessionId || "", langName);
            setActiveToken(t);
        } catch (e) {
            console.error('Connection failed:', e);
            showNotification('Voice connection failed', 3000);
            if (setIsVoiceMode) setIsVoiceMode(false);
        } finally {
            isFetchingRef.current = false;
        }
    }, [selectedLang, activeSessionId, setIsVoiceMode, showNotification]);

    const handleVoiceCancel = useCallback((closeMode = true) => {
        setActiveToken(null); // Instantly unmounts LiveKitRoom
        if (closeMode) {
            if (setIsVoiceMode) setIsVoiceMode(false);
            showNotification('Voice mode closed', 2000);
        }
    }, [setIsVoiceMode, showNotification]);

    const handleVoiceToggle = () => {
        if (isVoiceMode) {
            handleVoiceCancel(false); // Restart connection
        } else {
            if (setIsVoiceMode) setIsVoiceMode(true);
            if (setLiveVoiceMessages) setLiveVoiceMessages([]);
            // Ensure no manual API hit; let the dedicated useEffect strictly manage connection initialization
        }
    };

    // Ensure connection restores auto-magically if React component replaces itself
    useEffect(() => {
        if (isVoiceMode && !activeToken && !isFetchingRef.current) {
            fetchAndConnect();
        }
    }, [isVoiceMode, activeToken, fetchAndConnect]);

    // --- Input Text Chat Overrides ---
    const handleSend = () => {
        if (disabled) return;
        if (inputValue.trim() || selectedFile) {
            onSend(inputValue);
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            if (isVoiceMode) handleVoiceCancel(true); // Escape voice on manual typing
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

    // --- Media Pickers ---
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) { alert('Please select a valid image file'); return; }
            if (file.size > 10 * 1024 * 1024) { alert('Image size must be less than 10MB'); return; }

            try {
                showNotification('Image uploading...', null);
                validateImage(file);
                const compressedImage = await compressImage(file);
                const publicUrl = await uploadImageToSupabase(compressedImage);
                setSelectedFile(publicUrl);
                showNotification('Image loaded successfully', 3000);
            } catch {
                showNotification('Image upload failed', 3000);
            }
        }
        e.target.value = '';
    };

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
                    } catch {
                        showNotification('Image upload failed', 3000);
                    }
                });
        }
    }, [setSelectedFile, showNotification]);

    const handleRemoveFile = () => setSelectedFile(null);
    const isStandalone = !mode;

    const videoConstraints = { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } };

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
                            {notification === 'Image uploading...' || notification.startsWith('Connecting') || notification === 'Switching voice...' ? (
                                <span className="animate-spin inline-block w-4 h-4 border-2 border-[var(--text-secondary)] border-t-[var(--brand-primary)] rounded-full" />
                            ) : notification.includes('failed') ? (
                                <FaXmark className="text-red-500 text-sm" />
                            ) : (
                                <FaCircleCheck className="text-green-500 dark:text-green-400 text-sm" />
                            )}
                            {notification}
                        </div>
                    )}

                    {isVoiceMode ? (
                        /* ── VOICE MODE UI (React Components Wrappers) ── */
                        <div className="flex flex-col items-center justify-center w-full min-h-[140px]">
                            {activeToken ? (
                                <LiveKitRoom
                                    serverUrl="wss://demo-xv7lww7p.livekit.cloud"
                                    token={activeToken}
                                    connect={true}
                                    audio={false} // Managed locally to avoid permission loop
                                    options={{ adaptiveStream: false, dynacast: false }}
                                    onConnected={() => {
                                        console.log('[LiveKitRoom] Event: onConnected (Stable)');
                                        showNotification("Connected to Voice", 2000);
                                    }}
                                    onDisconnected={() => {
                                        console.log('[LiveKitRoom] Event: onDisconnected (Kicked or Network Lost)');
                                    }}
                                >
                                    <VoiceCallUI
                                        handleVoiceCancel={handleVoiceCancel}
                                        isVoiceConnected={true}
                                        soundEnabled={soundEnabled}
                                        toggleSound={() => setSoundEnabled(!soundEnabled)}
                                    />
                                    <LiveKitEventBridge setLiveVoiceMessages={setLiveVoiceMessages} selectedLang={selectedLang} />
                                    <RoomAudioRenderer volume={soundEnabled ? 1.0 : 0.0} />
                                </LiveKitRoom>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-[var(--brand-primary)] animate-pulse">
                                    <FaMicrophone className="text-4xl opacity-50 mb-2" />
                                    <span className="text-sm font-medium opacity-70">Fetching token...</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── TEXT INPUT BUBBLE ── */
                        <div className={`relative p-[1px] rounded-xl transition-all duration-500 shadow-sm hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.99]
                            bg-gradient-to-r from-[var(--brand-primary)]/40 via-[var(--brand-highlight)]/40 to-[var(--brand-primary)]/40 dark:from-white/70 dark:via-white/70 dark:to-white/70 hover:from-[var(--brand-primary)] hover:via-[var(--brand-highlight)] hover:to-[var(--brand-primary)] focus-within:from-[var(--brand-primary)] focus-within:via-[var(--brand-highlight)] focus-within:to-[var(--brand-primary)] focus-within:shadow-[0_0_20px_-5px_var(--brand-primary)]`}>

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
                                            placeholder={window.innerWidth < 768 ? "Ask EximGPT" : "Send a message here..."}
                                            value={inputValue}
                                            onChange={handleInput}
                                            onKeyDown={handleKeyDown}
                                            rows={1}
                                            style={{ minHeight: '44px' }}
                                        />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1 mb-0.5 shrink-0">
                                        <div className="relative flex items-center justify-center">
                                            <button
                                                type="button"
                                                className={`group flex items-center justify-center w-10 h-10 rounded-full transition-all relative z-10 hover:bg-[var(--bg-tertiary)]`}
                                                onClick={handleVoiceToggle}
                                                title={"Voice Input"}
                                            >
                                                <FaMicrophone className="text-[var(--text-secondary)] group-hover:text-[var(--brand-primary)] text-lg" />
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
                    )}
                </div>
            </div>
        </>
    );
};

export default InputArea;