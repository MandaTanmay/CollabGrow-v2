import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function useProjectChatSocket(
  projectId: string, 
  onMessage: (msg: any) => void,
  onHistory?: (messages: any[]) => void
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!projectId) {
      console.log('⚠️ No projectId provided to socket')
      return;
    }
    
    console.log('🔌 Connecting to socket at:', SOCKET_URL)
    console.log('📍 Joining room:', projectId)
    
    // Include credentials (JWT cookie) with Socket.IO connection
    const socket = io(SOCKET_URL, { 
      transports: ["websocket"],
      withCredentials: true,  // Send cookies with WebSocket connection
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id)
      console.log('✅ Socket authenticated successfully')
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error)
      console.error('Error message:', error.message)
      
      // Handle specific authentication error
      if (error.message === 'Authentication required') {
        console.error('🔒 Socket authentication failed - user may not be logged in')
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error)
    });

    socket.emit("joinRoom", projectId);

    socket.on("chatHistory", (messages) => {
      console.log('📜 Received chat history:', messages.length, 'messages')
      console.log('📋 First message sample:', messages[0])
      // If onHistory callback provided, replace all messages. Otherwise append each one.
      if (onHistory) {
        onHistory(messages);
      } else {
        messages.forEach(onMessage);
      }
    });
    
    socket.on("chatMessage", (msg) => {
      console.log('💬 Received new message:', msg)
      onMessage(msg);
    });

    return () => {
      console.log('🔌 Disconnecting socket')
      socket.disconnect();
    };
  }, [projectId, onMessage]);

  const sendMessage = (msg: any) => {
    if (socketRef.current) {
      console.log('📤 Emitting message via socket:', msg)
      socketRef.current.emit("chatMessage", msg);
    } else {
      console.error('❌ Socket not initialized, cannot send message')
    }
  };

  return { sendMessage, socket: socketRef.current };
}
