import React from 'react';
import StarterGrid from './StarterGrid';
import InputArea from './InputArea';

const WelcomeScreen = ({
    onFeatureClick,
    inputValue,
    setInputValue,
    onSend,
    selectedFile,
    setSelectedFile,
    disabled,
    focusInput,
    setFocusInput,
    selectedLang,
    activeSessionId,
    isVoiceMode,
    setIsVoiceMode,
    setLiveVoiceMessages
}) => (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]/30">
        <div className="flex-1 flex flex-col justify-end md:justify-center items-center overflow-y-auto custom-scrollbar w-full px-4 pb-4">
            <div className="flex flex-col items-center w-full max-w-[1000px]">
                <h2 className="md:hidden text-[24px] font-semibold mb-6 text-center tracking-tight drop-shadow-sm bg-gradient-to-r from-[var(--brand-primary)] to-[var(--text-primary)] bg-clip-text text-transparent">
                    How can I help?
                </h2>
                <h2 className="hidden md:block text-[32px] font-semibold mb-10 text-center tracking-tight drop-shadow-sm bg-gradient-to-r from-[var(--brand-primary)] to-[var(--text-primary)] bg-clip-text text-transparent">
                    How can I streamline your logistics today?
                </h2>
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
                    selectedFile={selectedFile}
                    setSelectedFile={setSelectedFile}
                    disabled={disabled}
                    selectedLang={selectedLang}
                    activeSessionId={activeSessionId}
                    isVoiceMode={isVoiceMode}
                    setIsVoiceMode={setIsVoiceMode}
                    setLiveVoiceMessages={setLiveVoiceMessages}
                />
            </div>
        </div>
    </div>
);



export default WelcomeScreen;
