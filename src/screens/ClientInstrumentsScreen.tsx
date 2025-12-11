import type {
	InstrumentId,
	InstrumentInfo,
	InstrumentsPhase,
	ServerEvent,
} from "@mikiwikipolvoron/wilco-lib/events";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInstrumentActions } from "../lib/controllers/useInstrumentActions";
import { useSocketStore } from "../lib/stores/useSocketStore";

const FALLBACK_INSTRUMENTS: Record<InstrumentId, InstrumentInfo> = {
	drums: {
		id: "drums",
		name: "Drums",
		hint: "Big arm hits",
		tool: "Drumsticks",
		color: "#ef4444",
	},
	maracas: {
		id: "maracas",
		name: "Maracas",
		hint: "Shake",
		tool: "Maracas",
		color: "#f59e0b",
	},
	guitar: {
		id: "guitar",
		name: "Guitar",
		hint: "Strum",
		tool: "Guitar pick",
		color: "#22d3ee",
	},
	violin: {
		id: "violin",
		name: "Violin",
		hint: "Bow",
		tool: "Violin bow",
		color: "#a855f7",
	},
};

const INSTRUMENT_IMAGES: Partial<Record<InstrumentId, string>> = {
	drums: `${import.meta.env.BASE_URL}assets/drumstick.png`,
	maracas: `${import.meta.env.BASE_URL}assets/maraca.png`,
	guitar: `${import.meta.env.BASE_URL}assets/guitarpick.png`,
	violin: `${import.meta.env.BASE_URL}assets/violinbow.png`,
};

export default function InstrumentsScreen() {
	const { connect, socket } = useSocketStore();
	const { sendMotion } = useInstrumentActions();

	const [phase, setPhase] = useState<InstrumentsPhase>("demo");
	const [demoInstrument, setDemoInstrument] = useState<InstrumentInfo | null>(
		null,
	);
	const [assignedInstrument, setAssignedInstrument] =
		useState<InstrumentInfo | null>(null);
	const [glow, setGlow] = useState(false);
	const lastSentRef = useRef(0);
	const glowTimeout = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		connect();
	}, [connect]);

	useEffect(() => {
		if (!socket) return;
		const handleServerEvent = (event: ServerEvent) => {
			switch (event.type) {
				case "instruments_phase":
					setPhase(event.phase);
					break;
				case "instruments_demo_step":
					setDemoInstrument(event.instrument);
					setAssignedInstrument(event.instrument);
					break;
				case "instruments_assignment": {
					const info = FALLBACK_INSTRUMENTS[event.instrument];
					setAssignedInstrument(info);
					break;
				}
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
		const handler = (event: DeviceMotionEvent) => {
			const acc = event.accelerationIncludingGravity ?? event.acceleration;
			if (!acc) return;
			const magnitude = Math.max(
				0,
				Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2) -
					9.81,
			);
			if (magnitude < 1) return;
			const now = Date.now();
			if (now - lastSentRef.current < 120) return;
			lastSentRef.current = now;
			sendMotion(magnitude, now);
			triggerGlow();
		};
		window.addEventListener("devicemotion", handler);
		return () => window.removeEventListener("devicemotion", handler);
	}, [sendMotion]);

	function triggerGlow(): void {
		setGlow(true);
		if (glowTimeout.current) clearTimeout(glowTimeout.current);
		glowTimeout.current = setTimeout(() => setGlow(false), 400);
	}

	const infoToShow =
		assignedInstrument ?? demoInstrument ?? FALLBACK_INSTRUMENTS.drums;
	const toolImage = INSTRUMENT_IMAGES[infoToShow.id];
	const bg = useMemo(
		() => (phase === "demo" ? "#0f172a" : infoToShow.color),
		[phase, infoToShow],
	);

	return (
		<div
			className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-white"
			style={{ background: phase === "finale" ? infoToShow.color + "33" : bg }}
		>
			<div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/50 p-6 text-center">
				<div className="text-sm uppercase tracking-wide text-slate-200 mb-1">
					{phase === "demo" ? "Watch & copy" : "Your part"}
				</div>
				<div className="text-3xl font-extrabold">{infoToShow.name}</div>
				<div className="text-lg text-slate-200 mt-1">{infoToShow.hint}</div>
				<div className="mt-6">
					<div
						className={`mx-auto w-40 h-40 rounded-2xl border-4 border-white/30 grid place-items-center text-xl font-bold transition-all ${
							glow
								? "scale-105 shadow-[0_0_30px_rgba(255,255,255,0.6)]"
								: "shadow-none"
						}`}
						style={{ backgroundColor: infoToShow.color, overflow: "hidden" }}
					>
						{toolImage ? (
							<img
								src={toolImage}
								alt="Maracas"
								className="w-full h-full object-contain pointer-events-none select-none"
							/>
						) : (
							infoToShow.tool
						)}
					</div>
				</div>
				{phase === "finale" && (
					<div className="mt-6 text-base text-slate-100">
						Keep moving your {infoToShow.tool}! Glow pulses confirm your
						movement.
					</div>
				)}
			</div>
		</div>
	);
}
