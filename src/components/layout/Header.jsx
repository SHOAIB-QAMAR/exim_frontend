import React from 'react';
import { FaShip, FaHouse, FaBars } from "react-icons/fa6";
import { MdLibraryAdd } from "react-icons/md";
import { useAuth } from '../../features/auth/context/AuthContext';

/**
 * Functional Header component that manages navigation, language switching, and thread management links.
 * 
 * @param {Object} props
 * @param {Function} props.toggleMobileSidebar - Toggles the visibility of the mobile sidebar.
 * @param {Object} props.selectedLang - The currently active language object (contains name, flag, etc).
 * @param {Function} props.onToggleLang - Toggles the language selection overlay/mode.
 * @param {Function} props.onOpenThreadSwitcher - Opens the conversation thread switcher.
 */
const Header = ({ toggleMobileSidebar, selectedLang, onToggleLang, onOpenThreadSwitcher }) => {
    const { logout } = useAuth();

    return (
        <header className="header flex justify-between items-center px-3 md:px-5 py-2 md:py-3 bg-[var(--bg-card)]/95 backdrop-blur-md text-[var(--text-primary)] border-b border-[var(--border-color)] shrink-0 z-40 shadow-sm relative w-full h-14 md:h-16 transition-all duration-300">

            {/* Left Section: Logo & Mobile Toggle */}
            <div className="header-left flex items-center gap-2 md:gap-4 min-w-0 flex-shrink-0">
                {/* Mobile Menu Toggle Button */}
                <button
                    type="button"
                    className="menu-btn lg:hidden flex items-center justify-center w-9 h-9 text-lg text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    onClick={toggleMobileSidebar}
                    aria-label="Toggle mobile menu"
                >
                    <FaBars aria-hidden="true" />
                </button>

                {/* Application Branding */}
                <div className="app-brand flex items-center gap-2">
                    <div className="hidden xs:flex w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-highlight)] items-center justify-center text-white shadow-sm">
                        <FaShip className="text-sm md:text-base" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col justify-center">
                        <h1 className="text-base md:text-lg font-bold leading-none tracking-tight font-display text-[var(--text-primary)]">
                            EximGPT
                        </h1>
                        <span className="hidden sm:block text-[9px] md:text-[10px] font-medium tracking-wider text-[var(--text-secondary)] uppercase">
                            Logistics AI
                        </span>
                    </div>
                </div>
            </div>

            {/* Dynamic Spacer */}
            <div className="flex-1" />

            {/* Right Section: Core Actions */}
            <div className="header-right flex items-center gap-1.5 md:gap-2.5 flex-shrink-0">

                {/* Mobile/Tablet Adaptive Controls */}
                <div className="mobile-ui-visible flex items-center gap-1">
                    {/* Thread Switcher Interaction */}
                    {onOpenThreadSwitcher && (
                        <button
                            type="button"
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--brand-primary)] transition-all"
                            onClick={onOpenThreadSwitcher}
                            title="Switch Chats"
                            aria-label="Switch conversation threads"
                        >
                            <MdLibraryAdd className="text-xl rotate-180" aria-hidden="true" />
                        </button>
                    )}

                    {/* Quick Language Toggle */}
                    <button
                        type="button"
                        className="flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden border border-transparent hover:border-[var(--border-color)] transition-all"
                        onClick={onToggleLang}
                        title={selectedLang?.name || 'Language'}
                        aria-label={`Change language, current: ${selectedLang?.name || 'English'}`}
                    >
                        <img
                            src={selectedLang?.flag || ""}
                            className="w-5 h-5 rounded-full object-cover shrink-0 border border-[var(--border-color)] shadow-sm"
                            alt=""
                        />
                    </button>

                    {/* Logout / Navigation Home Action */}
                    <button
                        type="button"
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--brand-primary)] transition-all"
                        onClick={logout}
                        title="Logout"
                        aria-label="Logout and return home"
                    >
                        <FaHouse className="text-base" aria-hidden="true" />
                    </button>
                </div>

                {/* Expanded Desktop Controls */}
                <div className="hidden desktop-ui-visible items-center gap-2.5">
                    {/* Language Selection Picker */}
                    <div className="relative p-[1px] rounded-full bg-gradient-to-r from-[var(--brand-primary)]/30 to-[var(--brand-highlight)]/30 hover:from-[var(--brand-primary)] hover:to-[var(--brand-highlight)] transition-all duration-300 group">
                        <button
                            type="button"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[var(--bg-card)] cursor-pointer h-full"
                            onClick={onToggleLang}
                            aria-label={`Current language: ${selectedLang?.name || 'English'}. Click to change.`}
                        >
                            <img src={selectedLang?.flag || ""} className="w-5 h-5 rounded-full object-cover shrink-0 border border-[var(--border-color)] shadow-sm" alt="" />
                            <span className="text-xs font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--brand-primary)] transition-colors max-w-[80px]">
                                {selectedLang?.name || 'English'}
                            </span>
                        </button>
                    </div>

                    {/* Vertical Divider */}
                    <div className="h-5 w-px bg-[var(--border-color)]" aria-hidden="true" />

                    {/* Desktop Logout Trigger */}
                    <button
                        type="button"
                        className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-all"
                        onClick={logout}
                        title="Logout"
                        aria-label="Sign out of application"
                    >
                        <FaHouse className="text-lg" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
