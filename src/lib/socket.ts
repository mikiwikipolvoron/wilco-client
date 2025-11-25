import type { ClientEvent, ServerEvent } from 'shared-types';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io("http://192.168.0.7:4000", {
    transports: ["websocket"],  // ⭐ prevents duplicate fallbacks
  });

  }
  return socket;
}

export function emitClientEvent(event: ClientEvent) {
  const s = getSocket();
  s.emit('client_event', event);
}

export function onServerEvent(handler: (event: ServerEvent) => void) {
  const s = getSocket();
  s.on('server_event', handler);
}
