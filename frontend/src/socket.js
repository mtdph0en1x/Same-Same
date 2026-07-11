import { io } from 'socket.io-client';

// Use environment variable for production (e.g., set in Vercel/EAS), fallback to local dev
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:4000';

export const socket = io(SERVER_URL, {
  autoConnect: false,
});
