import type { ClientBeatsEvent, ClientGlobalEvent, ClientServiceEvent } from "@wilco/shared/events";
import { useSocketStore } from "../stores/useSocketStore";

export function useClientActions() {
	const socket = useSocketStore();

	return {
		// Service actions
        tap: () => {
            const event: ClientBeatsEvent = { type: "tap", timestamp: Date.now() };
            socket.emit(event);
        }

	};
}
