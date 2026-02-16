import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MessageContent = ({ content, onLinkClick }) => {

    console.log("-------Content------", content);
    const components = useMemo(() => ({
        // Headings (h1-h6) - Standard formatting
        h1: (props) => <h1 className="text-2xl font-bold mt-6 mb-3 text-[var(--text-primary)]" {...props} />,
        h2: (props) => <h2 className="text-xl font-bold mt-5 mb-2.5 text-[var(--text-primary)]" {...props} />,
        h3: (props) => <h3 className="text-lg font-bold mt-4 mb-2 text-[var(--text-primary)]" {...props} />,
        h4: (props) => <h4 className="text-base font-bold mt-3 mb-1.5 text-[var(--text-primary)]" {...props} />,
        h5: (props) => <h5 className="text-sm font-bold mt-2 mb-1 text-[var(--text-primary)]" {...props} />,
        h6: (props) => <h6 className="text-xs font-bold mt-2 mb-1 text-[var(--text-secondary)]" {...props} />,

        // Lists - Standard spacing
        ul: (props) => <ul className="list-disc pl-6 my-2 space-y-1 marker:text-[var(--text-secondary)]" {...props} />,
        ol: (props) => <ol className="list-decimal pl-6 my-2 space-y-1 marker:text-[var(--text-secondary)]" {...props} />,
        li: ({ children, ...props }) => {
            const isTaskItem = Array.isArray(children) && children[0]?.type === 'input';
            return (
                <li className={`pl-1 leading-relaxed ${isTaskItem ? 'list-none' : ''}`} {...props}>
                    {isTaskItem ? (
                        <div className="flex items-start gap-2">
                            {children[0]}
                            <span className="flex-1">{children.slice(1)}</span>
                        </div>
                    ) : (
                        children
                    )}
                </li>
            );
        },

        // Task list checkbox input
        input: (props) => {
            if (props.type === 'checkbox') {
                return (
                    <input
                        type="checkbox"
                        checked={props.checked || false}
                        disabled
                        className="w-4 h-4 mt-1 accent-[var(--brand-primary)] cursor-not-allowed flex-shrink-0"
                        aria-label="Task list item"
                    />
                );
            }
            return <input {...props} />;
        },

        // Links
        a: ({ href, children, ...rest }) => {
            const isMailto = href?.startsWith('mailto:');
            const isTel = href?.startsWith('tel:');
            const isExternal = href?.startsWith('http://') || href?.startsWith('https://');

            return (
                <a
                    href={href}
                    className="text-[var(--brand-primary)] hover:underline font-medium break-all cursor-pointer transition-colors duration-150 hover:opacity-80"
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    onClick={(e) => {
                        if (onLinkClick && href && !isMailto && !isTel) {
                            e.preventDefault();
                            onLinkClick(href);
                        }
                    }}
                    {...rest}
                >
                    {children}
                </a>
            );
        },

        // Code blocks
        code: ({ className, children, inline, ...rest }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = Boolean(match) || className?.includes('language-');
            const language = match?.[1] || '';

            return isBlock ? (
                <div className="relative my-4 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                    <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)] font-mono uppercase tracking-wide">
                        <span>{language || 'code'}</span>
                    </div>
                    <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">
                        <code className={className} {...rest}>
                            {children}
                        </code>
                    </div>
                </div>
            ) : (
                <code className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-1.5 py-0.5 rounded text-sm font-mono border border-[var(--border-color)] break-words" {...rest}>
                    {children}
                </code>
            );
        },

        // Blockquotes
        blockquote: (props) => (
            <blockquote className="border-l-4 border-[var(--brand-primary)] pl-4 py-2 my-3 text-[var(--text-secondary)] italic bg-[var(--bg-tertiary)]/30 rounded-r" {...props} />
        ),

        // Strikethrough
        del: (props) => (
            <del className="line-through opacity-70" {...props} />
        ),

        // Emphasis
        em: (props) => <em className="italic" {...props} />,

        // Strong
        strong: (props) => <strong className="font-semibold" {...props} />,

        // Tables
        table: ({ children, ...rest }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-[var(--border-color)]">
                <table className="w-full text-sm" {...rest}>{children}</table>
            </div>
        ),
        thead: (props) => <thead className="bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold" {...props} />,
        tbody: (props) => <tbody className="divide-y divide-[var(--border-color)]" {...props} />,
        tr: (props) => <tr className="hover:bg-[var(--bg-tertiary)]/50 transition-colors" {...props} />,
        th: (props) => <th className="px-5 py-3 text-left font-semibold" {...props} />,
        td: (props) => <td className="px-5 py-3 align-top" {...props} />,

        // Paragraphs - Standard spacing
        p: (props) => <p className="mb-4 last:mb-0 whitespace-pre-wrap" {...props} />,

        // Hard line breaks
        br: () => <br />,

        // Horizontal Rule
        hr: () => <hr className="my-6 border-[var(--border-color)]" />,

        // Images
        img: ({ src, alt, title, ...rest }) => (
            <div className="my-4 rounded-lg overflow-hidden">
                <img
                    src={src}
                    alt={alt || 'Image'}
                    title={title}
                    className="max-w-full h-auto border border-[var(--border-color)] rounded"
                    {...rest}
                />
                {alt && <p className="text-xs text-[var(--text-secondary)] mt-2 italic">{alt}</p>}
            </div>
        ),
    }), [onLinkClick]);

    return (
        <div className="message-content text-[var(--text-primary)] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
};


export const TypingMessage = ({ content, onComplete, onTyping, onLinkClick }) => {
    const [displayedContent, setDisplayedContent] = useState("");
    const indexRef = useRef(0);

    // Typing speed control for streaming effect
    // 2 chars per frame at 60fps = ~120 chars/sec
    // Adjust CHARS_PER_FRAME to control smoothness/speed:
    // - Lower values (0.5-1): Slower, smoother animation
    // - Higher values (3-5): Faster animation, less smooth
    // - Typical range: 1-3
    const CHARS_PER_FRAME = 2;

    const ensureClosedMarkdown = (text) => {
        if (!text) return text;
        let fixedText = text;

        // === PHASE 1: Handle code blocks (highest priority - skip all other checks inside them) ===
        const codeBlockCount = (fixedText.match(/```/g) || []).length;
        const inCodeBlock = codeBlockCount % 2 !== 0;

        if (inCodeBlock) {
            fixedText += '\n```';
        }

        // === PHASE 2: Skip formatting checks if inside unclosed code block ===
        if (!inCodeBlock) {
            // === PHASE 2A: Inline code (backticks) ===
            // Count backticks that are not part of triple backticks
            const singleBacktickCount = (fixedText.match(/(?<!`)`(?!``)/g) || []).length;
            if (singleBacktickCount % 2 !== 0) {
                fixedText += '`';
            }

            // === PHASE 2B: Bold (**) ===
            // Count ** not preceded by \ (escape)
            const boldCount = (fixedText.match(/(?<!\\)\*\*(?!\*)/g) || []).length;
            if (boldCount % 2 !== 0) {
                fixedText += '**';
            }

            // === PHASE 2C: Italic (*) ===
            // Count single * (not ** or ***)
            // This is tricky - count all *, subtract ** doubles, check if remainder is odd
            const allAsterisks = (fixedText.match(/(?<!\\)\*/g) || []).length;
            const doubleAsterisks = (fixedText.match(/(?<!\\)\*\*/g) || []).length;
            const singleAsterisks = allAsterisks - (doubleAsterisks * 2);
            // If odd number of single asterisks remain, we have unclosed italic
            if (singleAsterisks % 2 !== 0 && boldCount % 2 === 0) {
                fixedText += '*';
            }

            // === PHASE 2D: Italic underscore (_) ===
            const underscoreCount = (fixedText.match(/(?<!\\)_(?!_)/g) || []).length;
            if (underscoreCount % 2 !== 0) {
                fixedText += '_';
            }

            // === PHASE 2E: Strikethrough (~~) ===
            const strikeCount = (fixedText.match(/(?<!\\)~~/g) || []).length;
            if (strikeCount % 2 !== 0) {
                fixedText += '~~';
            }
        }

        // === PHASE 3: Links and images (work regardless of code block status) ===
        // Check for unclosed image syntax: ![text](url
        if (/!\[[^\]]*\]\([^)]*$/.test(fixedText)) {
            fixedText += ')';
        }
        // Check for unclosed image text: ![text
        else if (/!\[[^\]]*$/.test(fixedText)) {
            fixedText += ']()';
        }
        // Check for unclosed link: [text](url
        else if (/(?<!\!)\[[^\]]+\]\([^)]*$/.test(fixedText)) {
            fixedText += ')';
        }
        // Check for unclosed link text: [text (but not ![)
        else if (/(?<!\!)\[[^\]]*$/.test(fixedText)) {
            fixedText += ']()';
        }

        // === PHASE 4: Blockquotes (ensure proper closure) ===
        // If line ends with > without proper closure
        const lines = fixedText.split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine.startsWith('>') && !lastLine.endsWith('\n')) {
            // Blockquote is already properly formatted by ReactMarkdown
        }

        return fixedText;
    };

    useEffect(() => {
        let animationFrameId;

        const animate = () => {
            // If we have caught up, stop.
            if (indexRef.current >= content.length) {
                setDisplayedContent(ensureClosedMarkdown(content));
                onComplete?.();
                return;
            }

            // Type forward gracefully
            // We use a float for indexRef to allow sub-integer speeds if needed, 
            // but Math.floor for slicing.
            indexRef.current = Math.min(indexRef.current + CHARS_PER_FRAME, content.length);
            const sliced = content.slice(0, Math.floor(indexRef.current));
            setDisplayedContent(ensureClosedMarkdown(sliced));

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