// hooks/useClientActions.ts - CLIENT ONLY

import type { ClientGlobalEvent, ClientServiceEvent } from "@wilco/shared/events";
import { useSocketStore } from "../stores/useSocketStore";

export function useClientActions() {
	const socket = useSocketStore();

	return {
		// Service actions
		register: (nickname: string) => {
			const event: ClientServiceEvent = {
				type: "register",
				nickname,
				role: "client",
			};
            socket.emit(event);
		},

		requestState: () => {
			const event: ClientServiceEvent = { type: "request_state" };
			socket.emit(event);
		},

		// Global actions
		sendReaction: (emoji: string) => {
			const event: ClientGlobalEvent = { type: "reaction", emoji };
			socket.emit(event);
		},
	};
}
