// hooks/useClientActions.ts - CLIENT ONLY

import type { ClientGlobalEvent, ClientServiceEvent } from "@mikiwikipolvoron/wilco-lib/events";
import { useSocketStore } from "../stores/useSocketStore";
import { getDeviceId } from "../utils/deviceId";
import { getSessionIdFromUrl } from "../utils/sessionId";

export function useClientActions() {
	const socket = useSocketStore();

	return {
		// Service actions
		register: (nickname: string) => {
			const sessionId = getSessionIdFromUrl();
			const deviceId = getDeviceId();

			const event: ClientServiceEvent = {
				type: "register",
				nickname,
				role: "client",
				sessionId: sessionId || undefined,
				deviceId,
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
