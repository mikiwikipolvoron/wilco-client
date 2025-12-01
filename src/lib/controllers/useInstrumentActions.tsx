import type { ClientInstrumentsEvent } from "@mikiwikipolvoron/wilco-lib/events";
import { useCallback } from "react";
import { useSocketStore } from "../stores/useSocketStore";

export function useInstrumentActions() {
	const socket = useSocketStore();

	const sendMotion = useCallback(
		(magnitude: number, timestamp: number) => {
			const event: ClientInstrumentsEvent = {
				type: "instrument_motion",
				magnitude,
				timestamp,
			};
			socket.emit(event);
		},
		[socket],
	);

	return { sendMotion };
}
