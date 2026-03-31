import React from 'react';
import StarterGrid from './StarterGrid';
import InputArea from './InputArea';

/**
 * WelcomeScreen Component
 * 
 * The default landing view for a new chat session. Features a greeting,
 * a grid of starter prompts, and the primary input area.
 * 
 * @param {Object} props
 * @param {Function} props.onFeatureClick - Callback when a starter prompt is clicked
 * @param {string} props.inputValue - Current text in InputArea
 * @param {Function} props.setInputValue - Updates InputArea text
 * @param {Function} props.onSend - Send message callback
 * @param {any} props.selectedFile - Current attachment
 * @param {Function} props.setSelectedFile - Update attachment
 * @param {boolean} props.disabled - Interaction lock
 * @param {boolean} props.focusInput - Focus trigger for InputArea
 * @param {Function} props.setFocusInput - Reset focus trigger
 * @param {Object} props.selectedLang - Active language
 * @param {string} props.activeSessionId - Active session ID
 * @param {boolean} props.isVoiceMode - Voice mode flag
 * @param {Function} props.setIsVoiceMode - Toggle voice mode
 * @param {Function} props.setLiveVoiceMessages - Voice transcription handler
 */

const WelcomeScreen = ({
    onFeatureClick,
    inputValue,
    setInputValue,
    onSend,
    selectedFiles,
    setSelectedFiles,
    disabled,
    focusInput,
    setFocusInput,
    selectedLang,
    activeSessionId,
    isVoiceMode,
    setIsVoiceMode,
    setLiveVoiceMessages
}) => (
    <main
        className="relative flex flex-col h-full bg-gradient-to-b from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]/30"
        aria-label="Welcome screen"
    >
        <div className="flex-1 flex flex-col justify-center items-center overflow-y-auto custom-scrollbar w-full px-4 pb-4">
            <div className="flex flex-col items-center w-full max-w-[1000px]">
                <h1 className="md:hidden text-[24px] font-semibold mb-6 text-center tracking-tight drop-shadow-sm bg-gradient-to-r from-[var(--brand-primary)] to-[var(--text-primary)] bg-clip-text text-transparent">
                    How can I help?
                </h1>
                <h1 className="hidden md:block text-[32px] font-semibold mb-10 text-center tracking-tight drop-shadow-sm bg-gradient-to-r from-[var(--brand-primary)] to-[var(--text-primary)] bg-clip-text text-transparent">
                    How can I streamline your logistics today?
                </h1>
                <StarterGrid onStarterClick={onFeatureClick} />
            </div>
        </div>
        <div className="shrink-0 w-full bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-transparent pt-4 pb-4 md:pb-8 px-4">
            <div className="max-w-[900px] mx-auto">
                <InputArea
                    focusInput={focusInput}
                    setFocusInput={setFocusInput}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    onSend={onSend}
                    mode="bottom"
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                    disabled={disabled}
                    selectedLang={selectedLang}
                    activeSessionId={activeSessionId}
                    isVoiceMode={isVoiceMode}
                    setIsVoiceMode={setIsVoiceMode}
                    setLiveVoiceMessages={setLiveVoiceMessages}
                />
            </div>
        </div>
    </main>
);



export default WelcomeScreen;
