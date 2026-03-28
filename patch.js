const fs = require('fs');
let content = fs.readFileSync('src/features/chat/hooks/useWebSocket.js', 'utf8');
content = content.replace("pendingChunksRef.current[threadId] = (pendingChunksRef.current[threadId] || '') + chunkToAppend;",
"pendingChunksRef.current[threadId] = (pendingChunksRef.current[threadId] || '') + chunkToAppend; console.log('[UI Debounce] Intercepted chunk:', chunkToAppend, 'Current pending:', pendingChunksRef.current[threadId]);");
fs.writeFileSync('src/features/chat/hooks/useWebSocket.js', content);
