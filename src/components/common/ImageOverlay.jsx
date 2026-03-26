import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaXmark } from 'react-icons/fa6';

const ImageOverlay = ({ isOpen, imageUrl, onClose }) => {
    const container = isOpen ? (document.getElementById('chat-area-container') || document.body) : null;

    useEffect(() => {
        if (!container) return;

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen, container]);

    if (!isOpen || !imageUrl || !container) return null;

    const isChatArea = container.id === 'chat-area-container';
    const positionClass = isChatArea ? 'absolute inset-0' : 'fixed inset-0';

    const modalContent = (
        <div 
            className={`${positionClass} z-[10000] bg-[var(--bg-primary)]/60 backdrop-blur animate-in fade-in duration-300 flex items-center justify-center p-4`}
            onClick={onClose}
        >
            <button
                type="button"
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                title="Close"
            >
                <FaXmark className="text-3xl" />
            </button>

            <img
                src={imageUrl}
                alt="Fullscreen preview"
                className="max-w-full max-h-[90%] object-contain rounded-lg shadow-2xl transition-transform duration-300 scale-100 hover:scale-[1.02]"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );

    return createPortal(modalContent, container);
};

export default ImageOverlay;
