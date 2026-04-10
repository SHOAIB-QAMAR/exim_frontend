import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { FaXmark, FaRotate } from "react-icons/fa6";

/**
 * Isolated Camera component to allow for lazy loading of the react-webcam library.
 */
const CameraOverlay = ({ onCapture, onClose }) => {
    const webcamRef = useRef(null);
    const [facingMode, setFacingMode] = useState('environment');

    const handleCaptureInternal = () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc && onCapture) {
            onCapture(imageSrc);
        }
    };

    const videoConstraints = {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
    };

    return (
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
                    onClick={onClose}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    title="Close Camera"
                >
                    <FaXmark className="text-xl" />
                </button>
                <button
                    type="button"
                    onClick={handleCaptureInternal}
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
    );
};

export default CameraOverlay;