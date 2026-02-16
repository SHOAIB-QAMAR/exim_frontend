import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MessageContent = ({ content, onLinkClick }) => {

    const components = useMemo(() => ({

        a: ({ href, children, ...rest }) => {
            const isMailto = href?.startsWith('mailto:');
            const isTel = href?.startsWith('tel:');
            const isExternal = href?.startsWith('http://') || href?.startsWith('https://');

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

        // Task list support
        li: ({ children, ...props }) => {
            const isTaskItem = Array.isArray(children) && children[0]?.type === 'input';
            return (
                <li {...props} style={isTaskItem ? { listStyle: 'none', marginLeft: '-1em' } : {}}>
                    {children}
                </li>
            );
        },

        input: (props) => {
            if (props.type === 'checkbox') {
                return (
                    <input
                        type="checkbox"
                        checked={props.checked || false}
                        disabled
                        style={{ marginRight: '0.5em', cursor: 'not-allowed' }}
                        aria-label="Task list item"
                    />
                );
            }
            return <input {...props} />;
        }
    }), [onLinkClick]);

    return (
        <div className="response-section">
            <div className="response-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {content}
                </ReactMarkdown>
            </div>
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
        // Check for unclosed link: [text](url)
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