import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket] = useState(() =>
    io(SOCKET_URL, {
      autoConnect: true
    })
  );
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleState = (nextState) => {
      setRoomState(nextState);
      setError("");
    };

    const handleError = (message) => {
      setError(message);
    };

    socket.on("room:state", handleState);
    socket.on("room:error", handleError);

    return () => {
      socket.off("room:state", handleState);
      socket.off("room:error", handleError);
    };
  }, [socket]);

  const value = {
    socket,
    roomState,
    error
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
