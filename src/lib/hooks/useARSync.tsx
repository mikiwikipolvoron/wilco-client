import type { ServerEvent } from "@mikiwikipolvoron/wilco-lib/events";
import { useEffect } from "react";
import { useARStore } from "../stores/useARStore";
import { useSocketStore } from "../stores/useSocketStore";

export function useARSync() {
	const socket = useSocketStore((state) => state.socket);

	useEffect(() => {
		if (!socket) return;

		function handleServerEvent(event: ServerEvent) {
			console.log("[ARSync] Received event:", event);

			switch (event.type) {
				case "ar_phase_change":
					useARStore.getState().setPhase(event.phase);
					break;

				case "ar_instruction":
					useARStore.getState().setPhase(event.phase);
					useARStore.getState().setCurrentSlide(event.slide);
					break;

				case "ar_items_update":
					useARStore.getState().updateItems(event.items);
					break;

				case "ar_boss_health":
					useARStore.getState().updateBossHealth(event.health, event.maxHealth);
					break;

				case "ar_item_collected":
					console.log(
						`[ARSync] Item collected! Total: ${event.tapCount}/${event.tapsNeeded}`,
					);
					useARStore
						.getState()
						.updateProgress(event.tapCount, event.tapsNeeded);
					break;

				case "ar_results":
					useARStore
						.getState()
						.setResults(event.totalTaps, event.participatingPlayers);
					break;
			}
		}

		socket.on("server_event", handleServerEvent);

		return () => {
			socket.off("server_event", handleServerEvent);
		};
	}, [socket]);
}
