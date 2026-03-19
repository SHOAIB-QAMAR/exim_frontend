const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
    WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || (window.location.protocol === 'https:' ? 'wss://localhost:8080' : 'ws://localhost:8080'),
    endpoints: {
        THREAD: "/api/thread",
        CHAT_WS: "/ws/chat",
        UPLOAD: "/api/upload"
    },
    SOCKET_IO_URL: "https://eximgptlivekitnew.devapi.zipaworld.com"
};

export default API_CONFIG;