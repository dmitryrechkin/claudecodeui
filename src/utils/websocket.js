import { useState, useEffect, useRef } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const connect = async () => {
    try {
      // Fetch server configuration to get the correct WebSocket URL
      let wsBaseUrl;
      try {
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;
        
        // If the config returns localhost but we're not on localhost, use current host with same port
        if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          console.warn('Config returned localhost, using current host instead');
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          // Extract port from the config URL if available
          const configUrl = new URL(wsBaseUrl);
          const configPort = configUrl.port || (configUrl.protocol === 'wss:' ? '443' : '80');
          wsBaseUrl = `${protocol}//${window.location.hostname}:${configPort}`;
        }
      } catch (error) {
        console.warn('Could not fetch server config, WebSocket connection may fail');
        // Don't assume any specific port mapping - this should be handled by proper server config
        throw new Error('Unable to determine WebSocket server URL. Please ensure the server is running and accessible.');
      }
      
      const wsUrl = `${wsBaseUrl}/ws`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        setIsConnected(true);
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, data]);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        setIsConnected(false);
        setWs(null);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };

  const sendMessage = (message) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  };

  return {
    ws,
    sendMessage,
    messages,
    isConnected
  };
}