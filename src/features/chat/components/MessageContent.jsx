import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import ImageOverlay from '../../../components/common/ImageOverlay';
import { FaFilePdf, FaDownload } from 'react-icons/fa6';

/**
 * MessageContent Component
 * 
 * Renders raw markdown text into safe, stylized HTML components.
 * Configured with Github Flavored Markdown (GFM) and sanitized via rehype-sanitize.
 * 
 * @param {Object} props
 * @param {string} props.content - The raw markdown text to render
 * @param {Function} props.onLinkClick - Callback fired when a link is clicked
 */
const MessageContent = ({ content, onLinkClick }) => {
    const [previewImage, setPreviewImage] = useState(null);

    // Memoize the custom markdown component overrides so ReactMarkdown doesn't unnecessarily remount the entire DOM tree on every single keystroke or stream chunk.
    const components = useMemo(() => ({

        // Custom Anchor (Link) Handler
        a: ({ href, children, ...rest }) => {
            const isMailto = href?.startsWith('mailto:');
            const isTel = href?.startsWith('tel:');
            const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
            const isPdf = href?.toLowerCase().split('?')[0].endsWith('.pdf');

            // Security check: Actively block javascript: and data: protocol URLs from executing, this is a secondary line of defense behind rehypeSanitize
            if (href?.match(/^(javascript|data|vbscript):/i)) {
                return <span>{children}</span>;
            }

            if (isPdf) {
                return (
                    <div
                        className="flex items-center gap-3 p-3 bg-black/10 border border-[var(--border-color)]/20 rounded-xl my-3 cursor-pointer hover:bg-black/20 transition-all group/pdf w-full max-w-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            setPreviewImage(href);
                        }}
                    >
                        <div className="w-10 h-10 bg-[#f83c3c] rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover/pdf:scale-105">
                            <FaFilePdf className="text-white text-xl" />
                        </div>
                        <div className="flex flex-col min-w-0 overflow-hidden pr-2 flex-1">
                            <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                                {children || 'Document.pdf'}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="p-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:bg-black/20 rounded-full transition-all"
                            onClick={async (e) => {
                                e.stopPropagation();
                                e.preventDefault();

                                try {
                                    const response = await fetch(href);
                                    const blob = await response.blob();
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = blobUrl;
                                    // Use the children text as filename if available
                                    const fileName = (typeof children === 'string' ? children : 'Document.pdf').replace(/\s+/g, '_');
                                    link.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(blobUrl);
                                } catch (error) {
                                    console.error('Download failed:', error);
                                    // Fallback to opening in new tab if direct download fails
                                    window.open(href, '_blank');
                                }
                            }}
                            title="Download PDF"
                        >
                            <FaDownload className="text-base" />
                        </button>
                    </div>
                );
            }

            return (
                <a
                    href={href}
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

        // Custom Image Handler - ✅ FIXED: removed stray backtick and brace
        img: ({ src, alt, ...rest }) => (
            <button
                type="button"
                className="block w-full text-left border-none bg-transparent p-0 mt-2 mb-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] rounded-md"
                onClick={() => setPreviewImage(src)}
                title="Click to expand"
                aria-label="Expand image"
            >
                <img
                    src={src}
                    alt={alt}
                    className="cursor-pointer max-w-full rounded-md hover:opacity-90 transition-opacity border border-[var(--border-color)]/50 shadow-sm"
                    {...rest}
                />
            </button>
        ),

        // Custom List Item Handler (Adding styling support for Github-style Task Lists)
        li: ({ children, ...props }) => {
            // Check if the rendered list item contains a checkbox <input> as its exact first child
            const isTaskItem = Array.isArray(children) && children[0]?.type === 'input';
            return (
                <li {...props} style={isTaskItem ? { listStyle: 'none', marginLeft: '-1em' } : {}}>
                    {children}
                </li>
            );
        },

        // Custom Input Handler (Specifically targeting checkbox inputs generated within Task Lists)
        input: (props) => {
            if (props.type === 'checkbox') {
                return (
                    <input
                        type="checkbox"
                        checked={props.checked || false}
                        disabled // Force checkboxes to be visually read-only in the chat log
                        style={{ marginRight: '0.5em', cursor: 'not-allowed' }}
                        aria-label="Completed step (read-only)"
                    />
                );
            }
            // For any other unexpected input types that slip through, just render them natively
            return <input {...props} />;
        }
    }), [onLinkClick]);

    return (
        <div className="response-section relative">
            <div className="response-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
                    {content}
                </ReactMarkdown>
            </div>

            <ImageOverlay
                isOpen={!!previewImage}
                imageUrl={previewImage}
                onClose={() => setPreviewImage(null)}
            />
        </div>
    );
};


/**
 * ensureClosedMarkdown
 * 
 * Helper Utility for Partial Markdown Parsing.
 * Ensures partially-streamed markdown is visually stable by artificially closing unclosed syntax.
 * Prevents flickering or raw asterisk display during live streaming.
 * 
 * @param {string} text - The raw, potentially incomplete markdown string
 * @returns {string} - The repaired markdown string with closed tags
 */
const ensureClosedMarkdown = (text) => {
    if (!text) return text;
    let fixedText = text;

    // === PHASE 1: Handle code blocks (highest priority) ===
    // Check if we are inside a code block by counting occurrences of triple backticks
    const codeBlockCount = (fixedText.match(/(?<!\\)```/g) || []).length;
    // If the count is odd, we haven't received the closing backticks yet
    const inCodeBlock = codeBlockCount % 2 !== 0;

    if (inCodeBlock) {
        fixedText += '\n```';
    }

    // === PHASE 2: Handle inline formatting (only if NOT in a code block) ===
    if (!inCodeBlock) {
        // 1. Single Backticks (Inline Code)
        // Match ` but not `` or ```
        const singleBacktickCount = (fixedText.match(/(?<!`)`(?!`)/g) || []).length;
        if (singleBacktickCount % 2 !== 0) fixedText += '`';

        // 2. Bold and Italic combinations (***text*** or ___text___)
        const tripleAsteriskCount = (fixedText.match(/(?<!\\)\*\*\*/g) || []).length;
        if (tripleAsteriskCount % 2 !== 0) {
            fixedText += '***';
        } else {
            // 3. Bold (**text**)
            const boldAsteriskCount = (fixedText.match(/(?<!\\)\*\*(?!\*)/g) || []).length;
            if (boldAsteriskCount % 2 !== 0) fixedText += '**';

            // 4. Italic (*text*)
            const allAsterisks = (fixedText.match(/(?<!\\)\*/g) || []).length;
            const doubleAsterisks = (fixedText.match(/(?<!\\)\*\*/g) || []).length;
            // Subtract characters used in ** from total * to get standalone *
            const singleAsterisks = allAsterisks - (doubleAsterisks * 2);
            // Only close single * if we aren't already closing a ** (to prevent rendering artifacts)
            if (singleAsterisks % 2 !== 0 && boldAsteriskCount % 2 === 0) fixedText += '*';
        }

        // 5. Underscores (Bold/Italic alternative)
        const tripleUnderscoreCount = (fixedText.match(/(?<!\\)___/g) || []).length;
        if (tripleUnderscoreCount % 2 !== 0) {
            fixedText += '___';
        } else {
            const doubleUnderscoreCount = (fixedText.match(/(?<!\\)__(?!_)/g) || []).length;
            if (doubleUnderscoreCount % 2 !== 0) fixedText += '__';

            const singleUnderscoreCount = (fixedText.match(/(?<!\\)_(?!_)/g) || []).length;
            if (singleUnderscoreCount % 2 !== 0 && doubleUnderscoreCount % 2 === 0) fixedText += '_';
        }

        // 6. Strikethrough (~~text~~)
        const strikeCount = (fixedText.match(/(?<!\\)~~/g) || []).length;
        if (strikeCount % 2 !== 0) fixedText += '~~';

        // 7. Highlight (==text==) if supported by the parser
        const highlightCount = (fixedText.match(/(?<!\\)==/g) || []).length;
        if (highlightCount % 2 !== 0) fixedText += '==';
    }

    // === PHASE 3: Links and Images ===
    // If the stream cuts off while building a Markdown hyperlink, append the necessary closing brackets.
    // 1. Partial Image Link: ![alt](url
    if (/!\[[^\]]*\]\([^)]*$/.test(fixedText)) fixedText += ')';
    // 2. Partial Image Bracket: ![alt
    else if (/!\[[^\]]*$/.test(fixedText)) fixedText += ']()';
    // 3. Partial Text Link: [text](url
    else if (/(?<!!)\[[^\]]+\]\([^)]*$/.test(fixedText)) fixedText += ')';
    // 4. Partial Text Bracket: [text
    else if (/(?<!!)\[[^\]]*$/.test(fixedText)) fixedText += ']()';

    return fixedText;
};

/**
 * TypingMessage Component
 * 
 * Word-by-word streaming animation wrapper.
 * Gradually reveals content to simulate a typing effect, with adaptive speed 
 * to keep up with high-throughput streams.
 * 
 * @param {Object} props
 * @param {string} props.content - Full content to reveal
 * @param {boolean} props.isStreaming - Whether the source stream is still active
 * @param {Function} props.onComplete - Callback when final word is revealed
 * @param {Function} props.onTyping - Callback fired on every reveal tick (used for auto-scroll)
 * @param {Function} props.onLinkClick - Link click handler passed to MessageContent
 */
export const TypingMessage = ({ content, isStreaming, onComplete, onTyping, onLinkClick }) => {
    // We initialize our `displayedContent` progress exactly where the stream currently is.
    const [displayedContent, setDisplayedContent] = useState(() => ensureClosedMarkdown(content));

    // Index tracking how many characters we have actually rendered to the screen
    const indexRef = useRef(content.length);

    // Use mutable refs for parent callbacks to avoid re-triggering the requestAnimationFrame effect loop every time the parent component happens to re-render.
    const onCompleteRef = useRef(onComplete);
    const onTypingRef = useRef(onTyping);

    useEffect(() => {
        onCompleteRef.current = onComplete;
        onTypingRef.current = onTyping;
    }, [onComplete, onTyping]);

    // ── ANIMATION LOOP EFFECT ──
    useEffect(() => {
        let rafId;
        let lastTickTime = 0;

        // ~33 ticks/sec → ~33 words/sec base speed
        // We want the animation to pause for EXACTLY 30 milliseconds between printing each word
        const TICK_MS = 30;

        // Core animation loop driven by `requestAnimationFrame` for 60fps smoothness
        const animate = (timestamp) => {
            // If 30ms haven't passed since the last word was printed, it simply skips this frame and tries again later.
            if (timestamp - lastTickTime < TICK_MS) {
                rafId = requestAnimationFrame(animate);
                return;
            }
            lastTickTime = timestamp;

            const totalLen = content.length;
            const pos = indexRef.current;

            // Base Case: Caught up to all available streamed content
            if (pos >= totalLen) {
                setDisplayedContent(ensureClosedMarkdown(content));
                if (!isStreaming) {
                    // Scenario: Network stream closed + animation hit the end → broadcast completion
                    onCompleteRef.current?.();
                    return;
                }
                // Scenario: We reached the end of the current buffer, but network stream is still active → Keep the loop alive passively waiting for more chunks
                rafId = requestAnimationFrame(animate);
                return;
            }

            // ── SMOOTH CHARACTER SPEED LOGIC ──
            // To ensure buttery smooth streaming, we increment by characters instead of whole words.
            const buffered = totalLen - pos;
            let charsThisTick = 1;

            // If the Web Socket stream is sending chunks faster than our 30ms ticker, we dynamically
            // increase the characters-per-frame to catch up gracefully without huge visual jumps.
            if (buffered > 500) charsThisTick = 15;        // Severely behind -> rapid but smooth flush
            else if (buffered > 200) charsThisTick = 8;    // Behind -> fast catch-up
            else if (buffered > 50) charsThisTick = 3;     // Slightly behind -> normal smooth reading

            let newPos = Math.min(totalLen, pos + charsThisTick);

            // Commit visual update
            indexRef.current = newPos;
            setDisplayedContent(ensureClosedMarkdown(content.slice(0, newPos)));
            onTypingRef.current?.(); // Broadcast visually-changed event (used by ChatMessages to auto-scroll)

            // Loop again on the next available browser paint frame
            rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);

        // Cleanup function preventing memory leaks and runaway phantom paint loops
        return () => cancelAnimationFrame(rafId);
    }, [content, isStreaming]);

    return <MessageContent content={displayedContent} onLinkClick={onLinkClick} />;
};

export default MessageContent;