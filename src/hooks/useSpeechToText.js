/**
 * @fileoverview Speech to Text Hook
 * 
 * Provides speech recognition functionality using the Web Speech API.
 * Supports continuous listening and interim results.
 */

import { useState, useRef, useCallback, useMemo } from 'react';

/**
 * Custom hook for speech-to-text functionality
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.lang - Language code (default: 'en-US')
 * @returns {Object} Speech recognition state and controls
 */
const useSpeechToText = (options = {}) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);
    const isInitializedRef = useRef(false);

    // Check browser support (computed once)
    const isSupported = useMemo(() => {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }, []);

    // Initialize recognition on first use
    const initRecognition = useCallback(() => {
        if (isInitializedRef.current || !isSupported) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        isInitializedRef.current = true;

        // Configuration
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = options.lang || 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onresult = (event) => {
            let finalTranscript = "";
            let interim = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript + " ";
                } else {
                    interim += result[0].transcript;
                }
            }

            setInterimTranscript(interim);
            if (finalTranscript) {
                setTranscript(prev => prev + finalTranscript);
            }
        };

        recognition.onerror = (event) => {
            setError(`Speech recognition error: ${event.error}`);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };
    }, [isSupported, options.lang]);

    const startListening = useCallback(() => {
        if (!isSupported) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }

        initRecognition();

        if (recognitionRef.current && !isListening) {
            setTranscript("");
            setInterimTranscript("");
            try {
                recognitionRef.current.start();
            } catch (e) {
                setError(`Failed to start speech recognition: ${e.message}`);
            }
        }
    }, [isSupported, isListening, initRecognition]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript("");
        setInterimTranscript("");
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        error,
        isSupported
    };
};

export default useSpeechToText;
