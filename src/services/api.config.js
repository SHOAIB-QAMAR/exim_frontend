/**
 * API Configuration Constants
 * 
 * Centralizes the base URLs for the backend services, including the main REST API
 * and the specialized WebSocket/LiveKit servers.
 */
const API_CONFIG = {
    /**
     * @constant {string} API_BASE_URL - The primary endpoint for chat management and authentication.
     */
    // API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "https://finance.devapi.zipaworld.com",
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "https://eximmcpbackend.devapi.zipaworld.com",

    /**
     * @constant {string} AUTH_BASE_URL - Dedicated endpoint for authentication (kept on the legacy domain as requested).
     */
    AUTH_BASE_URL: "https://finance.devapi.zipaworld.com",


    /**
     * @constant {string} SOCKET_IO_URL - The endpoint for the multiplexed WebSocket / LiveKit service.
     */
    // SOCKET_IO_URL: import.meta.env.VITE_SOCKET_IO_URL || "https://eximgptlivekitnew.devapi.zipaworld.com"
    SOCKET_IO_URL: import.meta.env.VITE_SOCKET_IO_URL || "https://eximmcpbackend.devapi.zipaworld.com"

};

export default API_CONFIG;