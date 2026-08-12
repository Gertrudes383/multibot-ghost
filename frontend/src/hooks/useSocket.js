import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '@stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:9999';

export function useSocket(options = {}) {
  const { autoConnect = true, namespace = '/' } = options;
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const token = useAuthStore((s) => s.session?.token);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    socketRef.current = io(`${WS_URL}${namespace}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current.on('connect', () => setIsConnected(true));
    socketRef.current.on('disconnect', () => setIsConnected(false));
  }, [token, namespace]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) socketRef.current.emit(event, data);
  }, []);

  const on = useCallback((event, callback) => {
    socketRef.current?.on(event, callback);
  }, []);

  const off = useCallback((event, callback) => {
    socketRef.current?.off(event, callback);
  }, []);

  useEffect(() => {
    if (autoConnect && token) connect();
    return () => disconnect();
  }, [autoConnect, token, connect, disconnect]);

  return { socket: socketRef.current, isConnected, connect, disconnect, emit, on, off };
}

export default useSocket;
