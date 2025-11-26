import { useEffect, useState } from "react";
import { useBeatsSync } from "../lib/hooks/useBeatsSync";
import { useBeatsStore } from "../lib/stores/useBeatsStore";
import { useServerStore } from "../lib/stores/useServerStore";
import { useSocketStore } from "../lib/stores/useSocketStore";

// Team color mapping
const TEAM_COLORS = {
	A: "#ec4899", // pink
	B: "#3b82f6", // blue
	C: "#f97316", // orange
	D: "#22c55e", // green
};

export default function TapBeatsScreen() {
	useBeatsSync();
	const { phase, round, personalAccuracy, teamAccuracy } = useBeatsStore();
	const { emit } = useSocketStore();
	const players = useServerStore((state) => state.players);
	const socket = useSocketStore((state) => state.socket);
	const [tapAnimation, setTapAnimation] = useState(false);

	// Get current player's group
	const myPlayerId = socket?.id;
	const myPlayer = myPlayerId ? players[myPlayerId] : null;
	const myGroupId = myPlayer?.groupId || "A";
	const myColor = TEAM_COLORS[myGroupId as keyof typeof TEAM_COLORS];

	const handleTap = () => {
		const timestamp = performance.now();

		// Send tap to server
		emit({
			type: "tap",
			timestamp,
		});

		// Trigger visual feedback
		setTapAnimation(true);
		setTimeout(() => setTapAnimation(false), 200);
	};

	if (phase === "instructions") {
		return <InstructionsPhase teamColor={myColor} teamId={myGroupId} />;
	}

	if (phase === "results") {
		return (
			<ResultsPhase
				personalAccuracy={personalAccuracy}
				teamAccuracy={teamAccuracy}
				teamColor={myColor}
			/>
		);
	}

	// beat_on or beat_off phases
	return (
		<div
			className="w-screen h-screen flex flex-col items-center justify-center p-8 relative"
			style={{ backgroundColor: "#1a1a2e" }}
		>
			{/* Round indicator */}
			<div className="absolute top-8 text-white text-2xl font-bold">
				Round {round}/3
			</div>

			{/* Main tap button */}
			<div className="flex-1 flex items-center justify-center">
				<button
					type="button"
					onClick={handleTap}
					className="rounded-full transition-all duration-200 flex items-center justify-center text-white text-8xl font-bold shadow-2xl active:scale-95 border-4 border-white"
					style={{
						width: tapAnimation ? "320px" : "300px",
						height: tapAnimation ? "320px" : "300px",
						backgroundColor: myColor,
						boxShadow: tapAnimation
							? `0 0 60px ${myColor}, 0 0 100px ${myColor}`
							: `0 0 30px ${myColor}`,
					}}
				>
					TAP
				</button>
			</div>

			{/* Stats display */}
			<div className="absolute bottom-12 w-full px-8">
				<div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
					<div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
						<div className="text-white/60 text-sm mb-2">Your Accuracy</div>
						<div className="text-white text-4xl font-bold">
							{Math.round(personalAccuracy * 100)}%
						</div>
					</div>
					<div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
						<div className="text-white/60 text-sm mb-2">Team {myGroupId}</div>
						<div className="text-white text-4xl font-bold">
							{Math.round(teamAccuracy * 100)}%
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function InstructionsPhase({
	teamColor,
	teamId,
}: {
	teamColor: string;
	teamId: string;
}) {
	const [showColor, setShowColor] = useState(true);

	useEffect(() => {
		// Show team color for 8 seconds, then fade to instructions
		const timer = setTimeout(() => {
			setShowColor(false);
		}, 8000);

		return () => clearTimeout(timer);
	}, []);

	if (showColor) {
		return (
			<div
				className="w-screen h-screen flex items-center justify-center transition-all duration-1000"
				style={{ backgroundColor: teamColor }}
			>
				<div className="text-white text-9xl font-bold animate-pulse">
					{teamId}
				</div>
			</div>
		);
	}

	return (
		<div
			className="w-screen h-screen flex flex-col items-center justify-center text-white p-8"
			style={{ backgroundColor: "#1a1a2e" }}
		>
			<div className="max-w-2xl text-center space-y-6">
				<div className="text-6xl font-bold mb-8" style={{ color: teamColor }}>
					You are Team {teamId}
				</div>
				<div className="text-3xl leading-relaxed">
					Look at the entertainer screen for instructions
				</div>
				<div className="text-5xl font-bold animate-pulse mt-12">
					Get ready...
				</div>
			</div>
		</div>
	);
}

function ResultsPhase({
	personalAccuracy,
	teamAccuracy,
	teamColor,
}: {
	personalAccuracy: number;
	teamAccuracy: number;
	teamColor: string;
}) {
	const isAboveTeamAverage = personalAccuracy >= teamAccuracy;

	return (
		<div
			className="w-screen h-screen flex flex-col items-center justify-center text-white p-8"
			style={{ backgroundColor: "#1a1a2e" }}
		>
			<div className="text-center space-y-12">
				<div className="text-7xl font-bold mb-8">Results</div>

				<div className="text-9xl font-bold mb-4" style={{ color: teamColor }}>
					{Math.round(personalAccuracy * 100)}%
				</div>

				<div className="text-3xl">Your Accuracy</div>

				<div className="mt-16 bg-white/10 backdrop-blur-sm rounded-2xl p-8">
					<div className="text-2xl mb-4">Team Average</div>
					<div className="text-6xl font-bold">
						{Math.round(teamAccuracy * 100)}%
					</div>
					<div className="text-xl mt-6">
						{isAboveTeamAverage ? (
							<span className="text-green-400">✓ Above team average!</span>
						) : (
							<span className="text-yellow-400">Below team average</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
