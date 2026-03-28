const API_CONFIG = {
    // API server base for chat and auth
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "https://eximmcpbackend.devapi.zipaworld.com",

    // WebSocket Service for LiveKit
    SOCKET_IO_URL: import.meta.env.VITE_SOCKET_IO_URL || "https://eximmcpbackend.devapi.zipaworld.com"
};

export default API_CONFIG;