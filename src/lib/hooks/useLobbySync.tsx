import type { FloatingEmoji } from "@mikiwikipolvoron/wilco/display";
import type { ServerEvent } from "@mikiwikipolvoron/wilco/events";
import { useEffect } from "react";
import { useLobbyStore } from "../stores/useLobbyStore";
import { useSocketStore } from "../stores/useSocketStore";

/** Hook to keep server state synchronized with our own state
 *
 *  Uses `useServerStore` to actually set the state, and `useSocketStore` to
 *  register handlers.
 *
 *  Add all messages under `ServerServiceEvent` type here
 *  (message-types/src/service.ts)
 */
export function useLobbySync() {
	const socket = useSocketStore((s) => s.socket);
	useEffect(() => {
		if (!socket) return;
		const timer = setInterval(() => {
			useLobbyStore.setState((s) => ({
				secondsRemaining: s.secondsRemaining - 1,
			}));
		}, 1000);

		return () => clearInterval(timer); // Cleanup
	}, [socket]);

	useEffect(() => {
		if (!socket) return;

		function handler(event: ServerEvent) {
			if (event.type === "reaction") {
				const x = Math.random() * window.innerWidth;
				const y = window.innerHeight - 50;
				const emoji = event.emoji;
				useLobbyStore.setState((state) => ({
					emojis: [
						...state.emojis,
						{
							id: Date.now() + Math.random(),
							emoji,
							x,
							y,
							drift: (Math.random() - 0.5) * 80,
							scale: 0.8 + Math.random() * 0.6, // between 0.8 and 1.4
							duration: 6.8 + Math.random() * 2.0, // e.g. 1.8s–3.3s
							jitter: (Math.random() - 0.5) * 20, // subtle horizontal wobble
						} as FloatingEmoji,
					],
				}));
			}
		}

		socket?.on("server_event", handler);

		return () => {
			socket?.off("server_event", handler);
		};
	}, [socket]);
}
