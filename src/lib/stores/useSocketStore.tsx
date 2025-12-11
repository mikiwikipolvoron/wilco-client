import type { ClientEvent } from "@mikiwikipolvoron/wilco-lib/events";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";

// Allow override via environment variable for devtunnel/custom server
const SERVER_URL =
	import.meta.env.VITE_SERVER_URL ||
	(import.meta.env.MODE === "production"
		? "https://ws.tardy.sh"
        // : "http://192.168.0.144:4000");
        : "https://id-4000.euw.devtunnels.ms");
console.debug("[Socket] Connecting to:", SERVER_URL);
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

		console.log("[Socket] Creating new connection to:", SERVER_URL);
		socketInstance = io(SERVER_URL, {
			transports: ["websocket", "polling"],
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
		});

		// Add connection event listeners for debugging
		socketInstance.on("connect", () => {
			console.log("[Socket] ✅ Connected! Socket ID:", socketInstance?.id);
		});

		socketInstance.on("connect_error", (error) => {
			console.error("[Socket] ❌ Connection error:", error.message);
			console.error("[Socket] Full error:", error);
		});

		socketInstance.on("disconnect", (reason) => {
			console.log("[Socket] Disconnected. Reason:", reason);
		});

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
