import type { ClientEvent } from "@mikiwikipolvoron/wilco-lib/events";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";

// const SERVER_URL = `http://localhost:4000`;
const SERVER_URL = `https://ws.tardy.sh`;
console.debug(SERVER_URL)
interface SocketStore {
	socket: Socket | null;
	connect: () => void;
	disconnect: () => void;
	emit: (data: ClientEvent) => void;
}

let socketInstance: Socket | null = null;

const useSocketStore = create<SocketStore>((set, get) => ({
	socket: null,

	connect: () => {
		if (socketInstance?.connected) {
			console.log("[Socket] Reusing existing connection");
			set({ socket: socketInstance });
			return;
		}

		if (socketInstance) {
			socketInstance.disconnect();
		}

		socketInstance = io(SERVER_URL);
		set({ socket: socketInstance });
	},

	disconnect: () => {
		if (socketInstance) {
			socketInstance?.disconnect();
			socketInstance = null;
			set({ socket: null });
		}
	},

	emit: (data) => {
		get().socket?.emit("client_event", data);
	},
}));

export { useSocketStore };
