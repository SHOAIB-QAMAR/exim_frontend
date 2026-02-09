/**
 * @fileoverview Message Content Components
 * 
 * Renders chat message content with Markdown support.
 * Includes typing animation effect for new messages.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders markdown content with custom styling
 * 
 * @param {Object} props - Component props
 * @param {string} props.content - Markdown content to render
 * @param {Function} props.onLinkClick - Callback when a link is clicked
 */
const MessageContent = ({ content, onLinkClick }) => {

    const components = useMemo(() => ({
        // Headings
        h1: (props) => <h1 className="text-2xl font-bold mt-5 mb-3 text-[var(--text-primary)]" {...props} />,
        h2: (props) => <h2 className="text-xl font-bold mt-4 mb-2 text-[var(--text-primary)]" {...props} />,
        h3: (props) => <h3 className="text-lg font-bold mt-3 mb-2 text-[var(--text-primary)]" {...props} />,
        h4: (props) => <h4 className="text-base font-bold mt-3 mb-1 text-[var(--text-primary)]" {...props} />,

        // Lists
        ul: (props) => <ul className="list-disc pl-6 my-3 space-y-1.5 marker:text-[var(--text-secondary)]" {...props} />,
        ol: (props) => <ol className="list-decimal pl-6 my-3 space-y-1.5 marker:text-[var(--text-secondary)]" {...props} />,
        li: (props) => <li className="pl-1" {...props} />,

        // Links
        a: ({ href, children, ...rest }) => (
            <a
                href={href}
                className="text-[var(--brand-primary)] hover:underline font-medium break-all cursor-pointer"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                    if (onLinkClick && href) {
                        e.preventDefault();
                        onLinkClick(href);
                    }
                }}
                {...rest}
            >
                {children}
            </a>
        ),

        // Code blocks - check for language class to determine block vs inline
        code: ({ className, children, ...rest }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = Boolean(match);

            return isBlock ? (
                <div className="relative my-4 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                    <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-sm text-[var(--text-secondary)]">
                        <span>{match[1]}</span>
                    </div>
                    <div className="p-4 overflow-x-auto text-sm font-mono leading-normal">
                        <code className={className} {...rest}>
                            {children}
                        </code>
                    </div>
                </div>
            ) : (
                <code className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-1.5 py-0.5 rounded text-sm font-mono border border-[var(--border-color)]" {...rest}>
                    {children}
                </code>
            );
        },

        // Blockquotes
        blockquote: (props) => (
            <blockquote className="border-l-4 border-[var(--brand-primary)] pl-4 py-2 my-3 text-[var(--text-secondary)] italic bg-[var(--bg-tertiary)]/30 rounded-r" {...props} />
        ),

        // Tables
        table: ({ children, ...rest }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-[var(--border-color)]">
                <table className="w-full text-left text-base" {...rest}>{children}</table>
            </div>
        ),
        thead: (props) => <thead className="bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold" {...props} />,
        tbody: (props) => <tbody className="divide-y divide-[var(--border-color)]" {...props} />,
        tr: (props) => <tr className="hover:bg-[var(--bg-tertiary)]/50 transition-colors" {...props} />,
        th: (props) => <th className="px-5 py-3 whitespace-nowrap" {...props} />,
        td: (props) => <td className="px-5 py-3 align-top" {...props} />,

        // Paragraphs
        p: (props) => <p className="mb-3 last:mb-0" {...props} />,

        // Horizontal Rule
        hr: () => <hr className="my-6 border-[var(--border-color)]" />,
    }), [onLinkClick]);

    return (
        <div className="message-content text-[var(--text-primary)] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
};

/**
 * Typing animation component for new messages
 * 
 * @param {Object} props - Component props
 * @param {string} props.content - Full message text
 * @param {Function} props.onComplete - Called when typing finishes
 * @param {Function} props.onTyping - Called during typing (for scrolling)
 * @param {number} props.timestamp - Message arrival timestamp
 * @param {Function} props.onLinkClick - Link click handler
 */
export const TypingMessage = ({ content, onComplete, onTyping, timestamp, onLinkClick }) => {
    const [displayedContent, setDisplayedContent] = useState("");
    const indexRef = useRef(0);

    // Typing speed control for streaming effect
    // 2 chars per frame at 60fps = ~120 chars/sec
    // Adjust CHARS_PER_FRAME to control smoothness/speed
    const CHARS_PER_FRAME = 2;

    useEffect(() => {
        let animationFrameId;

        const animate = () => {
            // If we have caught up, stop.
            if (indexRef.current >= content.length) {
                setDisplayedContent(content);
                onComplete?.();
                return;
            }

            // Type forward gracefully
            // We use a float for indexRef to allow sub-integer speeds if needed, 
            // but Math.floor for slicing.
            indexRef.current = Math.min(indexRef.current + CHARS_PER_FRAME, content.length);
            setDisplayedContent(content.slice(0, Math.floor(indexRef.current)));

            onTyping?.();
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [content, onComplete, onTyping]);

    return <MessageContent content={displayedContent} onLinkClick={onLinkClick} />;
};

export default MessageContent;