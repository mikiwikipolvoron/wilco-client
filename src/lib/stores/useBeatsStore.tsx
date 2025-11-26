import { create } from "zustand";
import type { BeatsPhase } from "wilco-msgs/src/beats";

interface BeatsStore {
	// Current state
	phase: BeatsPhase;
	round: number;
	bpm: number;

	// Personal performance
	personalAccuracy: number;
	teamAccuracy: number;
	taps: number[];

	// Actions
	setPhase: (phase: BeatsPhase, round: number, bpm: number) => void;
	addTap: (timestamp: number) => void;
	updateAccuracy: (personal: number, team: number) => void;
	reset: () => void;
}

const initialState = {
	phase: "instructions" as BeatsPhase,
	round: 0,
	bpm: 120,
	personalAccuracy: 0,
	teamAccuracy: 0,
	taps: [] as number[],
};

export const useBeatsStore = create<BeatsStore>((set) => ({
	...initialState,

	setPhase: (phase, round, bpm) => set({ phase, round, bpm }),

	addTap: (timestamp) => set((state) => ({
		taps: [...state.taps, timestamp]
	})),

	updateAccuracy: (personal, team) => set({
		personalAccuracy: personal,
		teamAccuracy: team
	}),

	reset: () => set(initialState),
}));
