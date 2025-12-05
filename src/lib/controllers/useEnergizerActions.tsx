import type {
	ClientEnergizerEvent,
	EnergizerCell,
} from "@mikiwikipolvoron/wilco-lib/events";
import { useCallback } from "react";
import { useSocketStore } from "../stores/useSocketStore";

export function useEnergizerActions() {
	const socket = useSocketStore();

	const sendMotion = useCallback(
		(magnitude: number, timestamp: number) => {
			socket.emit({
				type: "energizer_motion",
				magnitude,
				timestamp,
			} satisfies ClientEnergizerEvent);
		},
		[socket],
	);

	const sendSwipe = useCallback(
		(charge: number) => {
			socket.emit({
				type: "energizer_swipe_send",
				charge,
			} satisfies ClientEnergizerEvent);
		},
		[socket],
	);

	const sendSequence = useCallback(
		(cells: EnergizerCell[]) => {
			socket.emit({
				type: "energizer_sequence_submit",
				cells,
			} satisfies ClientEnergizerEvent);
		},
		[socket],
	);

	return { sendMotion, sendSwipe, sendSequence };
}
