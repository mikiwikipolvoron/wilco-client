import type { ARItem, ARPhase } from "@mikiwikipolvoron/wilco-lib/data";
import { create } from "zustand";

interface ARState {
	// Anchoring
	isAnchored: boolean;
	markerDetected: boolean;

	// Phase & Items
	phase: ARPhase;
	items: ARItem[];
	currentSlide: number;

	// Progress
	totalTaps: number;
	tapsNeeded: number;

	// Boss
	bossHealth: number;
	bossMaxHealth: number;

	// Results
	participatingPlayers: number;

	// Actions
	setAnchored: (anchored: boolean) => void;
	setMarkerDetected: (detected: boolean) => void;
	setPhase: (phase: ARPhase) => void;
	setCurrentSlide: (slide: number) => void;
	updateItems: (items: ARItem[]) => void;
	updateProgress: (totalTaps: number, tapsNeeded: number) => void;
	updateBossHealth: (health: number, maxHealth: number) => void;
	setResults: (totalTaps: number, participatingPlayers: number) => void;
	reset: () => void;
}

export const useARStore = create<ARState>((set) => ({
	isAnchored: false,
	markerDetected: false,
	phase: "instructions",
	items: [],
	currentSlide: 0,
	totalTaps: 0,
	tapsNeeded: 0,
	bossHealth: 0,
	bossMaxHealth: 30,
	participatingPlayers: 0,

	setAnchored: (anchored) => set({ isAnchored: anchored }),
	setMarkerDetected: (detected) => set({ markerDetected: detected }),
	setPhase: (phase) => set({ phase }),
	setCurrentSlide: (slide) => set({ currentSlide: slide }),
	updateItems: (items) => set({ items }),
	updateProgress: (totalTaps, tapsNeeded) => set({ totalTaps, tapsNeeded }),
	updateBossHealth: (health, maxHealth) =>
		set({ bossHealth: health, bossMaxHealth: maxHealth }),
	setResults: (totalTaps, participatingPlayers) =>
		set({ totalTaps, participatingPlayers }),
	reset: () =>
		set({
			isAnchored: false,
			markerDetected: false,
			phase: "instructions",
			items: [],
			currentSlide: 0,
			totalTaps: 0,
			tapsNeeded: 0,
			bossHealth: 0,
			participatingPlayers: 0,
		}),
}));
