import type {
	EnergizerPhase,
	ServerEvent,
} from "@mikiwikipolvoron/wilco-lib/events";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEnergizerActions } from "../lib/controllers/useEnergizerActions";
import { useServerStore } from "../lib/stores/useServerStore";
import { useSocketStore } from "../lib/stores/useSocketStore";

type LocalPhase = EnergizerPhase | "sequence_show" | "sequence_input" | "idle";

export default function EnergizerScreen() {
	const { connect, socket } = useSocketStore();
	const { sendMotion, sendSwipe, sendSequence } = useEnergizerActions();

	const [permissionGranted, setPermissionGranted] = useState(false);
	const [phase, setPhase] = useState<LocalPhase>("idle");
	const [charge, setCharge] = useState(0);
	const [idle, setIdle] = useState(false);
	const [spotlight, setSpotlight] = useState(false);
	const [lastShake, setLastShake] = useState(0);
	const [sequenceAllowed, setSequenceAllowed] = useState(false);
	const [currentSlide, setCurrentSlide] = useState(0);
	const [sequencePalette] = useState([
		"#ff63c3",
		"#ffa347",
		"#44a0ff",
		"#3ed17a",
	]);
	const [gridRows, setGridRows] = useState(2);
	const [gridCols, setGridCols] = useState(4);
	const [selectedColor, setSelectedColor] = useState<string | null>(null);
	const [selection, setSelection] = useState<Map<number, string>>(new Map());
	const [leverProgress, setLeverProgress] = useState(0);
	const [leverLocked, setLeverLocked] = useState(false);
	const [isSwiping, setIsSwiping] = useState(false);
	const [idleWarning, setIdleWarning] = useState(false);
	const palette = useMemo(
		() => ["#ff63c3", "#ffa347", "#44a0ff", "#3ed17a"],
		[],
	);
	const nickname = useServerStore((s) => s.nickname);
	const fillColor = useMemo(() => {
		if (!nickname) return palette[2];
		const idx =
			nickname
				.split("")
				.map((c) => c.charCodeAt(0))
				.reduce((a, b) => a + b, 0) % palette.length;
		return palette[idx];
	}, [nickname, palette]);

	const lastSentRef = useRef(0);
	const swipeStartY = useRef<number | null>(null);
	const swipeRef = useRef<HTMLDivElement | null>(null);
	const sliderTrackRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		connect();
	}, [connect]);

	useEffect(() => {
		if (!socket) return;

		const handleServerEvent = (event: ServerEvent) => {
			switch (event.type) {
				case "energizer_phase_change":
					setPhase(event.phase);
					if (event.phase === "sequence_input") {
						setSequenceAllowed(true);
					} else if (event.phase === "sequence_show") {
						setSequenceAllowed(false);
					}
					break;
				case "energizer_instruction":
					if (
						event.phase === "instructions1" ||
						event.phase === "instructions2"
					) {
						setPhase(event.phase);
						setCurrentSlide(event.slide);
					}
					break;
				case "energizer_player_update":
					setCharge(event.charge);
					setIdle(event.idle);
					if (event.idle) {
						setIdleWarning(true);
						setTimeout(() => setIdleWarning(false), 5000);
					}
					break;
				case "energizer_spotlight":
					setSpotlight(event.active);
					break;
				case "energizer_sequence_show":
					setPhase("sequence_show");
					setGridRows(event.pattern.rows);
					setGridCols(event.pattern.cols);
					setSequenceAllowed(false);
					setSelection(new Map());
					break;
				case "energizer_sequence_hide":
					setSequenceAllowed(true);
					setPhase("sequence_input");
					break;
				case "energizer_sequence_result":
					setSequenceAllowed(false);
					setPhase("results");
					setSelection(new Map());
					break;
				default:
					break;
			}
		};

		socket.on("server_event", handleServerEvent);
		return () => {
			socket.off("server_event", handleServerEvent);
		};
	}, [socket]);

	useEffect(() => {
		if (!permissionGranted || phase !== "movement") return;

		const handler = (event: DeviceMotionEvent) => {
			const acc = event.accelerationIncludingGravity ?? event.acceleration;
			if (!acc) return;

			const magnitude = Math.max(
				0,
				Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2) -
					9.81,
			);

			const now = Date.now();
			if (now - lastSentRef.current < 120) return;
			lastSentRef.current = now;

			setLastShake(magnitude);
			sendMotion(magnitude, now);
		};

		window.addEventListener("devicemotion", handler);

		return () => {
			window.removeEventListener("devicemotion", handler);
		};
	}, [permissionGranted, phase, sendMotion]);

	useEffect(() => {
		if (idle && "vibrate" in navigator) {
			navigator.vibrate?.(120);
		}
	}, [idle]);

	async function enableMotion(): Promise<void> {
		if (
			typeof DeviceMotionEvent !== "undefined" &&
			"requestPermission" in DeviceMotionEvent
		) {
			try {
				const result = await (
					DeviceMotionEvent as typeof DeviceMotionEvent & {
						requestPermission?: () => Promise<PermissionState>;
					}
				).requestPermission?.();
				setPermissionGranted(result === "granted");
			} catch (error) {
				console.error("Motion permission error", error);
				setPermissionGranted(false);
			}
		} else {
			setPermissionGranted(true);
		}
	}

	const chargePercent = useMemo(() => Math.round(charge * 100), [charge]);

	const selectionArray = useMemo(
		() =>
			Array.from(selection.entries()).map(([index, color]) => ({
				index,
				color,
			})),
		[selection],
	);

	function handleCellTap(index: number) {
		if (!sequenceAllowed || !selectedColor) return;
		setSelection((prev) => {
			const next = new Map(prev);
			if (next.get(index) === selectedColor) {
				next.delete(index);
			} else {
				next.set(index, selectedColor);
			}
			return next;
		});
	}

	function submitSequence() {
		if (!sequenceAllowed || selectionArray.length === 0) return;
		sendSequence(selectionArray);
		setSequenceAllowed(false);
	}

	function handleSwipeStart(clientY: number) {
		if (leverLocked || phase !== "send_energy") return;
		swipeStartY.current = clientY;
		setIsSwiping(true);
	}

	function updateLeverFromPointer(clientY: number) {
		if (!isSwiping || leverLocked || phase !== "send_energy") return;
		const trackRect = sliderTrackRef.current?.getBoundingClientRect();
		const containerRect = swipeRef.current?.getBoundingClientRect();
		const height =
			trackRect?.height ?? containerRect?.height ?? window.innerHeight * 0.6;
		const top = trackRect?.top ?? swipeStartY.current ?? clientY;
		const bottom = top + height;
		const clampedY = Math.min(Math.max(clientY, top), bottom);
		const progress = Math.min(1, Math.max(0, 1 - (clampedY - top) / height));
		setLeverProgress(progress);
		if (progress >= 0.98) {
			setLeverLocked(true);
			setLeverProgress(1);
			sendSwipe(charge);
		}
	}

	function handleSwipeMove(clientY: number) {
		updateLeverFromPointer(clientY);
	}

	function handleSwipeEnd() {
		if (isSwiping && !leverLocked) {
			setLeverProgress(0);
		}
		setIsSwiping(false);
		swipeStartY.current = null;
	}

	useEffect(() => {
		if (phase !== "send_energy") {
			setLeverProgress(0);
			setLeverLocked(false);
			setIsSwiping(false);
		}
	}, [phase]);

	return (
		<div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 p-6 text-white bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
			{phase === "instructions1" || phase === "instructions2" ? (
				<div className="text-center space-y-2">
					<h1 className="text-2xl font-semibold">Energizer</h1>
					<p className="text-base text-slate-200">
						Look at the entertainer screen now for instructions.
					</p>
				</div>
			) : phase === "sequence_show" || phase === "sequence_input" ? (
				<div className="text-center space-y-2">
					<h1 className="text-2xl font-semibold">Energizer</h1>
					<p className="text-base text-slate-200">
						{phase === "sequence_show"
							? "Memorize the pattern on the entertainer screen."
							: "Enter the pattern on your phone. Use the colors shown earlier."}
					</p>
				</div>
			) : null}

			{phase === "instructions1" && currentSlide >= 4 && (
				<button
					type="button"
					onClick={enableMotion}
					disabled={permissionGranted}
					className="px-4 py-2 rounded bg-blue-600 text-white disabled:bg-slate-500"
				>
					{permissionGranted ? "Movement accepted" : "Accept Movement"}
				</button>
			)}

			{phase === "movement" && (
				<div
					className={`relative w-full h-[80vh] max-h-[780px] max-w-md rounded-3xl overflow-hidden border ${
						spotlight
							? "border-yellow-500 bg-yellow-300"
							: "border-cyan-400/40 bg-slate-900"
					}`}
				>
					<div
						className={`absolute inset-0 ${
							spotlight
								? "bg-yellow-300"
								: "bg-gradient-to-b from-slate-900 via-slate-950 to-black"
						}`}
					/>
					<div
						className="absolute inset-4 rounded-2xl border border-white/30 overflow-hidden"
						style={{
							boxShadow: spotlight
								? "0 0 55px rgba(234,179,8,0.55)"
								: "0 0 30px rgba(56,189,248,0.25)",
						}}
					>
						<div
							className="absolute inset-0 transition-all duration-300"
							style={{
								background: spotlight
									? "linear-gradient(180deg, #000000, #000000ee)"
									: `linear-gradient(180deg, ${fillColor}, ${fillColor}cc)`,
								height: `${chargePercent}%`,
								top: "auto",
                                opacity: "50%",
								bottom: 0,
								left: 0,
								right: 0,
								transformOrigin: "bottom",
								zIndex: 1,
							}}
						/>
						{/* Electricity sparkle animation */}
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								height: `${chargePercent}%`,
								top: "auto",
								bottom: 0,
							zIndex: 2,
							}}
						>
							<ElectricitySparkles color={fillColor} />
						</div>
					</div>
					<div className="absolute inset-0 flex items-center justify-center text-5xl font-extrabold tracking-wide mix-blend-screen z-1 text-black drop-shadow-lg px-4 text-center">
						<p>{spotlight ? "SPOTLIGHT BONUS" : `${chargePercent}%`}</p>
						<p>
							<ComboLevelDisplay percentage={chargePercent} />
						</p>
					</div>
					{idleWarning && (
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="bg-amber-500/90 text-black font-bold text-2xl px-4 py-3 rounded-xl shadow-lg text-center">
								DON'T STOP, KEEP MOVING!
							</div>
						</div>
					)}
				</div>
			)}

			{phase === "send_energy" && (
				<div
					ref={swipeRef}
					className="w-full h-[80vh] max-h-[750px] max-w-sm sm:max-w-md relative rounded-3xl bg-slate-900 border border-emerald-400/60 overflow-hidden flex items-end justify-center px-4 pb-6"
					onPointerDown={(e) => handleSwipeStart(e.clientY)}
					onPointerMove={(e) => handleSwipeMove(e.clientY)}
					onPointerUp={() => handleSwipeEnd()}
					onPointerCancel={() => handleSwipeEnd()}
					onTouchStart={(e) => handleSwipeStart(e.touches[0]?.clientY ?? 0)}
					onTouchMove={(e) => handleSwipeMove(e.touches[0]?.clientY ?? 0)}
					onTouchEnd={() => handleSwipeEnd()}
					onTouchCancel={() => handleSwipeEnd()}
					style={{ touchAction: "none" }}
				>
					<div className="absolute inset-0 bg-gradient-to-b from-emerald-900/60 via-slate-950 to-black" />
					<div className="absolute top-4 w-full text-center text-xl font-semibold">
						{leverLocked ? "" : "Swipe up to transfer charge"}
					</div>
					{!leverLocked && (
						<div
							ref={sliderTrackRef}
							className="w-20 h-[82%] rounded-full bg-slate-800/90 border-4 border-emerald-300/60 relative overflow-hidden flex items-end justify-center backdrop-blur-sm mt-10"
						>
							<div
								className="absolute bottom-0 left-0 right-0 bg-emerald-400/80 transition-[height] duration-150 ease-out"
								style={{ height: `${leverProgress * 100}%` }}
							/>
							<div
								className="absolute w-14 h-14 rounded-full bg-white text-black font-bold grid place-items-center shadow-xl border border-emerald-400/70"
								style={{
									bottom: `${leverProgress * 100}%`,
									transform: "translateY(50%)",
									transition: "bottom 150ms ease-out",
								}}
							>
								GO
							</div>
						</div>
					)}
					{leverLocked && (
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="px-5 py-4 rounded-2xl bg-emerald-500 text-black font-bold text-2xl shadow-lg">
								Charge sent!
							</div>
						</div>
					)}
				</div>
			)}

			{(phase === "sequence_show" || phase === "sequence_input") && (
				<SequenceGrid
					rows={gridRows}
					cols={gridCols}
					palette={sequencePalette}
					interactive={sequenceAllowed}
					selectedColor={selectedColor}
					onSelectColor={setSelectedColor}
					selection={selection}
					onCellTap={handleCellTap}
					onSubmit={submitSequence}
				/>
			)}

			{phase === "movement" && idle && (
				<div className="text-sm text-amber-300">
					Don't stop, keep moving! Your phone will vibrate when idle.
				</div>
			)}
		</div>
	);
}

function ComboLevelDisplay({ percentage }: { percentage: number }) {
	return (
		<>
			{percentage > 0 && percentage <= 25
				? "1X COMBO"
				: percentage > 25 && percentage <= 50
					? "2X COMBO"
					: percentage > 50 && percentage <= 75
						? "2X COMBO"
						: percentage > 75 && percentage <= 100
							? "2X COMBO"
							: percentage > 100
								? "unreachable"
								: "unreachable"}
		</>
	);
}

function OrbitingParticles({ spotlight }: { spotlight: boolean }) {
	return null;
}

function SequenceGrid({
	rows,
	cols,
	palette,
	interactive,
	selectedColor,
	onSelectColor,
	selection,
	onCellTap,
	onSubmit,
}: {
	rows: number;
	cols: number;
	palette: string[];
	interactive: boolean;
	selectedColor: string | null;
	onSelectColor: (color: string | null) => void;
	selection: Map<number, string>;
	onCellTap: (index: number) => void;
	onSubmit: () => void;
}) {
	const cells = useMemo(
		() => Array.from({ length: rows * cols }, (_, idx) => idx),
		[rows, cols],
	);

	return (
		<div className="w-full max-w-md space-y-3">
			<div className="text-center text-sm text-slate-200">
				{interactive
					? "Tap cells to match the pattern."
					: "Memorize the pattern shown on entertainer screen."}
			</div>
			<div
				className="grid gap-2"
				style={{
					gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
				}}
			>
				{cells.map((cell) => (
					<div
						key={cell}
						className="aspect-square rounded-lg border flex items-center justify-center text-xs text-slate-300 transition-colors"
						style={{
							opacity: interactive ? 1 : 0.7,
							borderColor: selection.has(cell) ? "#fff" : "rgb(51 65 85)",
							backgroundColor: selection.get(cell) ?? "rgb(30 41 59)",
						}}
						onClick={() => onCellTap(cell)}
					>
						{interactive ? "Tap" : ""}
					</div>
				))}
			</div>
			{interactive && (
				<>
					<div className="flex gap-2 justify-center">
						{palette.map((color) => (
							<button
								key={color}
								type="button"
								className="w-10 h-10 rounded-full border-2"
								style={{
									backgroundColor: color,
									borderColor: selectedColor === color ? "#fff" : "#94a3b8",
								}}
								onClick={() => onSelectColor(color)}
							/>
						))}
					</div>
					<div className="flex justify-center">
						<button
							type="button"
							onClick={onSubmit}
							className="px-4 py-2 rounded bg-emerald-500 text-white"
							disabled={selection.size === 0}
						>
							Submit pattern
						</button>
					</div>
				</>
			)}
		</div>
	);
}

function ElectricitySparkles({ color }: { color: string }) {
	const sparkles = Array.from({ length: 12 }, (_, i) => i);

	return (
		<div className="absolute inset-0 overflow-hidden">
			<style>{`
				@keyframes spark {
					0%, 100% { opacity: 0; transform: scale(0) translateY(0); }
					50% { opacity: 1; transform: scale(1) translateY(-20px); }
				}
				@keyframes lightning {
					0%, 100% { opacity: 0; }
					50% { opacity: 0.4; }
				}
			`}</style>
			{sparkles.map((i) => (
				<div
					key={i}
					className="absolute"
					style={{
						left: `${Math.random() * 100}%`,
						bottom: `${Math.random() * 100}%`,
						animation: `spark ${1.5 + Math.random() * 1}s ease-in-out infinite`,
						animationDelay: `${Math.random() * 2}s`,
					}}
				>
					<div
						className="w-2 h-2 rounded-full blur-sm"
						style={{
							backgroundColor: color,
							boxShadow: `0 0 8px ${color}, 0 0 12px ${color}`,
						}}
					/>
				</div>
			))}
			{/* Lightning flashes */}
			<div
				className="absolute inset-0"
				style={{
					background: `linear-gradient(180deg, transparent, ${color}15)`,
					animation: "lightning 3s ease-in-out infinite",
				}}
			/>
		</div>
	);
}
