import type { BeatsPhase } from "@wilco/shared/data";
import { create } from "zustand";

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
	updatePersonalAccuracy: (personal: number) => void;
	updateTeamAccuracy: (team: number) => void;
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

	addTap: (timestamp) =>
		set((state) => ({
			taps: [...state.taps, timestamp],
		})),

	updateTeamAccuracy: (team) =>
		set({
			teamAccuracy: team,
		}),
	updatePersonalAccuracy: (personal) =>
		set({
			personalAccuracy: personal,
		}),

	reset: () => set(initialState),
}));
