import type { FloatingEmoji } from "@mikiwikipolvoron/wilco-lib/display";
import { create } from "zustand";

interface LobbyStore {
	// Server-side values
	secondsRemaining: number;
	emojis: FloatingEmoji[];

	decreaseSecondsRemaining: () => void;
	addFloatingEmoji: (emoji: string) => void;
}

const initialState = {
	secondsRemaining: 60,
	emojis: [],
};

export const useLobbyStore = create<LobbyStore>((set) => ({
	...initialState,

	decreaseSecondsRemaining: () => {
		set((state) => ({ secondsRemaining: state.secondsRemaining - 1 }));
	},

	addFloatingEmoji: (emoji) => {
		const x = Math.random() * window.innerWidth;
		const y = window.innerHeight - 50;
		set((state) => ({
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
	},
}));
