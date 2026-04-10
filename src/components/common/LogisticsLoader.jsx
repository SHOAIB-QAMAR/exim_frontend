import React, { useState, useEffect } from 'react';
import { FaShip, FaPlane, FaTruck, FaBox } from "react-icons/fa6";

const icons = [FaShip, FaPlane, FaTruck, FaBox];

/**
 * A specialized loading indicator with rotating logistics icons and a pulse effect.
 * 
 * @param {Object} props
 * @param {string} [props.label="AI Processing..."] - The text to display next to the loader.
 */
const LogisticsLoader = ({ label = "AI Processing..." }) => {
    const [index, setIndex] = useState(0);

    // Rotate through logistics icons (ship, plane, truck, box) every 1.2 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % icons.length);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    const CurrentIcon = icons[index];

    return (
        <div 
            className="flex items-center gap-3 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
           
           
        >
            <div className="relative flex items-center justify-center w-10 h-10">
                {/* Clipper to keep pulse effect contained within the ring */}
                <div className="absolute inset-0 rounded-full overflow-hidden">
                    {/* Pulsing Background Glow */}
                    <div className="absolute inset-0 bg-[var(--brand-primary)]/40 rounded-full animate-pulse-ring"></div>
                </div>

                {/* Rotating Outer Scanner Ring */}
                <div className="absolute inset-0 border-2 border-t-[var(--brand-primary)] border-r-transparent border-b-[var(--brand-primary)]/30 border-l-transparent rounded-full animate-spin-slow"></div>

                {/* Centered Rotating Icon Container */}
                <div className="relative z-10 w-8 h-8 flex items-center justify-center">
                    <CurrentIcon className="text-[var(--brand-primary)] text-xs transition-all duration-300 transform scale-100" />
                </div>
            </div>

            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-[var(--text-primary)] tracking-wide uppercase">{label}</span>
            </div>
        </div>
    );
};

export default LogisticsLoader;