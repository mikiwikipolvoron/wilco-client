import { io, type Socket } from "socket.io-client";
import type { ClientEvent } from "wilco-msgs";
import { create } from "zustand";

interface SocketStore {
	socket: Socket | null;
	connect: (url: string) => void;
	disconnect: () => void;
	emit: (event: string, data: ClientEvent) => void;
}

const useSocketStore = create<SocketStore>((set, get) => ({
	socket: null,

	connect: (url: string) => {
		const socket = io(url);
		set({ socket });
	},

	disconnect: () => {
		const socket = get().socket;
		if (socket) {
			socket.disconnect();
			set({ socket: null });
		}
	},

	emit: (event, data) => {
		get().socket?.emit(event, data);
	},
}));

export { useSocketStore };
