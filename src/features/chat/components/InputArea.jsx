import React, { useRef, useMemo, useState, useEffect, useCallback, lazy, Suspense } from 'react';
const CameraOverlay = lazy(() => import('./CameraOverlay'));
import Tooltip from '../../../components/common/Tooltip';
import UniversalOverlay from '../../../components/common/UniversalOverlay';
import { useUI } from '../../../providers/UIContext';
import { FaPlus, FaMicrophone, FaMicrophoneSlash, FaPaperPlane, FaXmark, FaImage, FaCamera, FaRotate, FaCircleCheck, FaVolumeHigh, FaVolumeXmark, FaFilePdf } from "react-icons/fa6";
import { processAndUploadFile } from '../../../services/uploadService';
import chatService from '../../../services/chat.service';
import { getLanguageCode } from '../../../config/languages';

// --- LiveKit Official Libraries ---
import { RoomEvent } from 'livekit-client';
import { LiveKitRoom, RoomAudioRenderer, useRoomContext, useLocalParticipant } from '@livekit/components-react';
import '@livekit/components-styles';

/**
 * LiveKitEventBridge
 * 
 * Handles real-time event synchronization between the LiveKit room and the 
 * application state. Specifically manages transcriptions and language switching.
 * 
 * @param {Object} props
 * @param {Function} props.setLiveVoiceMessages - Updates the list of live transcriptions
 * @param {Object} props.selectedLang - Currently selected language for STT/TTS
 */
function LiveKitEventBridge({ setLiveVoiceMessages, selectedLang }) {
    const room = useRoomContext();
    const segmentTracker = useRef(new Map());
    const prevLangRef = useRef(null); // null → forces initial sync on first connection

    /**
     * Sends the BCP-47 language code to the backend agent via LiveKit text stream.
     * Includes room-state check and automatic retry on transient failures.
     */
    const sendFnRef = useRef(null);
    const sendLanguageToAgent = useCallback(async (langName, attempt = 0) => {
        if (!room?.localParticipant) {
            console.warn('[LK-Bridge] No room/localParticipant — language NOT sent');
            return;
        }

        if (room.state !== 'connected') {
            console.warn(`[LK-Bridge] Room state="${room.state}" — deferring (attempt ${attempt + 1})`);
            if (attempt < 3) {
                setTimeout(() => sendFnRef.current?.(langName, attempt + 1), 800);
            }
            return;
        }

        const bcp47Code = getLanguageCode(langName);
        console.log(`[LK-Bridge] Sending language: "${langName}" → "${bcp47Code}" (attempt ${attempt + 1})`);

        try {
            if (typeof room.localParticipant.streamText === 'function') {
                const writer = await room.localParticipant.streamText({ topic: 'user_lang' });
                await writer.write(bcp47Code);
                await writer.close();
                console.log(`[LK-Bridge] ✅ streamText("user_lang") sent successfully: ${bcp47Code}`);
            } else {
                console.warn('[LK-Bridge] streamText unavailable — falling back to publishData');
                const encoder = new TextEncoder();
                await room.localParticipant.publishData(encoder.encode(bcp47Code), {
                    topic: 'user_lang',
                    reliable: true,
                });
                console.log(`[LK-Bridge] ✅ publishData fallback sent: ${bcp47Code}`);
            }
        } catch (err) {
            console.error(`[LK-Bridge] ❌ Language send failed (attempt ${attempt + 1}):`, err);
            if (attempt < 2) {
                setTimeout(() => sendFnRef.current?.(langName, attempt + 1), 500);
            }
        }
    }, [room]);
    useEffect(() => { sendFnRef.current = sendLanguageToAgent; }, [sendLanguageToAgent]);

    // Sync language on initial connection + on every subsequent language change
    useEffect(() => {
        if (!room || !selectedLang?.name || !room.localParticipant) return;

        if (selectedLang.name !== prevLangRef.current) {
            const isInitial = prevLangRef.current === null;
            prevLangRef.current = selectedLang.name;

            if (isInitial) {
                // First mount: wait briefly for the data channel to finish setup
                const t = setTimeout(() => sendLanguageToAgent(selectedLang.name), 600);
                return () => clearTimeout(t);
            } else {
                // User switched language mid-session
                sendLanguageToAgent(selectedLang.name);
            }
        }
    }, [room, selectedLang, sendLanguageToAgent]);

    // Resync language automatically after (re)connection events
    useEffect(() => {
        if (!room) return;

        const handleConnected = () => {
            console.log('[LK-Bridge] Room (re)connected — resyncing language');
            if (selectedLang?.name) {
                setTimeout(() => sendLanguageToAgent(selectedLang.name), 400);
            }
        };

        room.on(RoomEvent.Connected, handleConnected);
        return () => room.off(RoomEvent.Connected, handleConnected);
    }, [room, selectedLang, sendLanguageToAgent]);

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

/**
 * VoiceCallUI
 * 
 * Provides the visual interface for an active voice session, including 
 * a fake audio visualizer and controls for microphone/sound.
 * 
 * @param {Object} props
 * @param {Function} props.handleVoiceCancel - Callback to end the voice session
 * @param {boolean} props.isVoiceConnected - Flag indicating if the room connection is stable
 * @param {boolean} props.soundEnabled - Flag for audio output state
 * @param {Function} props.toggleSound - Callback to mute/unmute audio output
 */
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

/**
 * InputArea Component
 * 
 * The primary interaction point for the user. Supports text input, 
 * file/image attachments, camera capture, and voice-to-voice interaction.
 * 
 * @param {Object} props
 * @param {string} props.inputValue - Current text in the textarea
 * @param {Function} props.setInputValue - Updates text input
 * @param {Function} props.onSend - Callback to send a message
 * @param {string} props.mode - UI mode ('bottom' or standalone)
 * @param {any} props.selectedFile - Current attachment (URL or File)
 * @param {Function} props.setSelectedFile - Updates attachment
 * @param {boolean} props.disabled - Interaction lock (e.g., during AI response)
 * @param {boolean} props.focusInput - Trigger to force focus on the textarea
 * @param {Function} props.setFocusInput - Reset focus trigger
 * @param {Object} props.selectedLang - Active language configuration
 * @param {string} props.activeSessionId - ID of the active chat session
 * @param {boolean} props.isVoiceMode - Flag for voice interaction mode
 * @param {Function} props.setIsVoiceMode - Toggle voice mode
 * @param {Function} props.setLiveVoiceMessages - Handler for voice transcriptions
 */
const InputArea = ({
    inputValue, setInputValue, onSend, mode,
    selectedFiles, setSelectedFiles, disabled = false,
    focusInput, setFocusInput, selectedLang, activeSessionId,
    isVoiceMode, setIsVoiceMode, setLiveVoiceMessages
}) => {
    const inputId = React.useId();
    const notificationId = React.useId();
    const attachMenuId = React.useId();
    const textareaRef = useRef(null);
    const imageInputRef = useRef(null);
    const pdfInputRef = useRef(null);
    const menuRef = useRef(null);

    const { sidebarCollapsed, notification, showNotification, isOffline } = useUI();
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [previewMedia, setPreviewMedia] = useState(null);

    // --- LiveKit Component State ---
    const [activeToken, setActiveToken] = useState(null);
    const [activeServerUrl, setActiveServerUrl] = useState(null);  // NEW
    const isFetchingRef = useRef(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

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

    // Previews cleanup and URL generation
    const previewUrls = useMemo(() => {
        if (!selectedFiles || selectedFiles.length === 0) return [];

        return selectedFiles.map(file => {
            if (typeof file === 'object' && file.url) {
                if (file.file_type === 'pdf') return { type: 'pdf', url: file.url, name: file.filename, ...file };
                return { type: 'image', url: file.previewBlobUrl || file.url, ...file };
            }
            if (file instanceof File) {
                if (file.type.startsWith('image/')) {
                    try { return { type: 'image', url: URL.createObjectURL(file), file }; } catch { return null; }
                }
                return { type: 'pdf', file };
            }
            return null;
        }).filter(Boolean);
    }, [selectedFiles]);

    useEffect(() => {
        return () => {
            previewUrls.forEach(p => {
                if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
            });
        };
    }, [previewUrls]);

    // Also revoke previewBlobUrl stored inside the UploadResult when selectedFiles change:
    useEffect(() => {
        // Find URLs that were in previous selectedFiles but not in current
        // For simplicity, we can rely on the cleanup above or more specific tracking if needed
    }, [selectedFiles]);

    // --- Voice Transition Logic ---
    const fetchAndConnect = useCallback(async () => {
        if (isFetchingRef.current) return;
        try {
            isFetchingRef.current = true;
            showNotification('Connecting to LiveKit...', null);
            const langName = selectedLang?.name || 'English (IN)';
            const { token, url } = await chatService.getLiveKitToken(activeSessionId || "", langName);
            setActiveToken(token);
            setActiveServerUrl(url);
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
        setActiveServerUrl(null);  // NEW
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

    // Ensure stale tokens are dropped if voice mode is disabled externally or tab switches
    useEffect(() => {
        if (!isVoiceMode) {
            setActiveToken(null);
            setActiveServerUrl(null);
            isFetchingRef.current = false;
        }
    }, [isVoiceMode, activeSessionId]);

    // --- Input Text Chat Overrides ---
    const handleSend = () => {
        if (disabled) return;
        if (inputValue.trim() || (selectedFiles && selectedFiles.length > 0)) {
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
        const files = Array.from(e.target.files || []);
        if (files.length === 0) { e.target.value = ''; return; }

        for (const file of files) {
            const isPdf = file.type === 'application/pdf' ||
                (file.type === 'application/octet-stream' && file.name.toLowerCase().endsWith('.pdf'));
            const label = isPdf ? 'document' : 'image';

            try {
                showNotification(`Uploading ${label}...`, null);
                const uploadResult = await processAndUploadFile(file);
                setSelectedFiles(prev => [...prev, uploadResult]);
                showNotification(`${isPdf ? 'Document' : 'Image'} ready`, 3000);
            } catch (err) {
                console.error('[InputArea] handleFileChange upload failed:', err);
                showNotification(err.message || `${label} upload failed`, 3000);
            }
        }
        e.target.value = ''; // reset input so the same file can be re-selected
    };


    const handleCapture = useCallback((imageSrc) => {
        if (!imageSrc) return;

        fetch(imageSrc)
            .then(res => res.blob())
            .then(async blob => {
                const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                setShowCamera(false);
                try {
                    showNotification('Uploading photo...', null);
                    const uploadResult = await processAndUploadFile(file);
                    setSelectedFiles(prev => [...prev, uploadResult]);
                    showNotification('Photo ready', 3000);
                } catch (err) {
                    console.error('[InputArea] handleCapture upload failed:', err);
                    showNotification(err.message || 'Photo upload failed', 3000);
                }
            })
            .catch(() => showNotification('Could not process photo', 3000));
    }, [setSelectedFiles, showNotification]);

    const handleRemoveFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };
    const isStandalone = !mode;

    return (
        <>
            <UniversalOverlay isOpen={!!previewMedia} imageUrl={previewMedia?.url} fileName={previewMedia?.fileName} onClose={() => setPreviewMedia(null)} />
            {/* ── CAMERA OVERLAY MODAL ── */}
            {showCamera && (
                <Suspense fallback={null}>
                    <CameraOverlay
                        onCapture={handleCapture}
                        onClose={() => setShowCamera(false)}
                    />
                </Suspense>
            )}

            {/* ── MAIN INPUT AREA ── */}
            <div className={`${isStandalone ? 'input-area shrink-0 px-0 pt-0 md:px-4 md:pt-4 bg-[var(--bg-primary)] border-t border-[var(--border-color)] transition-colors duration-800' : 'w-full'}`}>
                <div className={`${isStandalone ? 'container max-w-[900px] mx-auto relative' : 'relative'}`}>

                    {/* ── NOTIFICATION BANNER ── */}
                    {notification && (
                        <div
                            id={notificationId}


                            className="fixed top-28 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2 rounded-full text-[var(--text-primary)] text-sm font-medium shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-[var(--border-color)] bg-[var(--bg-card)] animate-fade-in-up whitespace-nowrap"
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
                                    serverUrl={activeServerUrl}
                                    token={activeToken}
                                    connect={true}
                                    audio={true} // Enabled by default to ensure mic is open on connect
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

                                {/* ── ATTACHMENTS PREVIEW INSIDE INPUT ── */}
                                {previewUrls.length > 0 && (
                                    <div className="px-3 pt-3 pb-1 flex flex-wrap gap-3 overflow-x-auto max-w-full scrollbar-none">
                                        {previewUrls.map((p, idx) => (
                                            <div key={idx} className="relative inline-block shrink-0">
                                                {p.type === 'image' ? (
                                                    <Tooltip content={p.name || p.filename || 'Image'} position="bottom">
                                                        <img
                                                            src={p.url}
                                                            alt={p.name || p.filename || 'Selected attachment'}
                                                            onClick={() => setPreviewMedia({ url: p.url, fileName: p.name || p.filename })}
                                                            className="w-28 h-20 object-cover rounded-lg border-2 border-[var(--brand-primary)]/30 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                                        />
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip content={p.name || p.filename || 'Document'} position="bottom">
                                                        <div 
                                                            className="inline-flex items-center gap-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 min-w-[150px] max-w-[220px] cursor-pointer hover:bg-[var(--border-color)] transition-colors"
                                                            onClick={() => setPreviewMedia({ url: p.url, fileName: p.name || p.filename })}
                                                        >
                                                            <span className="text-lg">📄</span>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                                                                    {p.name || 'Document'}
                                                                </span>
                                                                {p.page_count && (
                                                                    <span className="text-[10px] text-[var(--text-secondary)]">
                                                                        {p.page_count} page{p.page_count > 1 ? 's' : ''}
                                                                        {p.truncated ? ' (truncated)' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Tooltip>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFile(idx)}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-10"
                                                    title="Remove attachment"
                                                >
                                                    <FaXmark className="text-xs" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── INPUT ROW (+ button, textarea, action buttons) ── */}
                                <div className="flex items-end gap-2 p-2 md:p-3">
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
                                            <div
                                                id={attachMenuId}
                                                className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden"

                                            >
                                                <button
                                                    type="button"

                                                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                                    onClick={() => {
                                                        imageInputRef.current?.click();
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
                                                        pdfInputRef.current?.click();
                                                        setShowAttachMenu(false);
                                                    }}
                                                >
                                                    <FaFilePdf className="text-[var(--brand-primary)] text-base" />
                                                    Upload Document
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

                                    <input
                                        type="file"
                                        ref={imageInputRef}
                                        hidden
                                        multiple
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileChange}
                                    />
                                    <input
                                        type="file"
                                        ref={pdfInputRef}
                                        hidden
                                        multiple
                                        accept=".pdf,application/pdf,.docx,.xlsx,.xls,.csv"
                                        onChange={handleFileChange}
                                    />

                                    {/* Textarea */}
                                    <div className="flex-1 relative w-full">
                                        <textarea
                                            id={inputId}
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

                                                title="Voice Input"
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
                                                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${disabled || isOffline
                                                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50'
                                                    : (inputValue.trim() || (selectedFiles && selectedFiles.length > 0))
                                                        ? 'bg-[var(--brand-primary)] text-white shadow-md hover:shadow-lg active:scale-95 cursor-pointer'
                                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed'}`}
                                                onClick={handleSend}
                                                disabled={disabled || isOffline || (!inputValue.trim() && (!selectedFiles || selectedFiles.length === 0))}

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