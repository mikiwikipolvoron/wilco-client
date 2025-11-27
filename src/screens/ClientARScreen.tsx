import { useEffect, useRef, useState } from "react";
import { useARStore } from "../lib/stores/useARStore";
import { useSocketStore } from "../lib/stores/useSocketStore";
import { useARSync } from "../lib/hooks/useARSync";

export default function ClientARScreen() {
	const { phase, isAnchored, items } = useARStore();
	const socket = useSocketStore((state) => state.socket);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "pending">("pending");
	const [error, setError] = useState<string | null>(null);
	const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

	// Sync with server
	useARSync();

	// Handle tapping an item
	const handleTapItem = (itemId: string) => {
		if (!socket) return;

		console.log("[ARScreen] Tapping item:", itemId);
		socket.emit("client_event", { type: "tap_item", itemId });
	};

	// Request camera permission
	useEffect(() => {
		console.log("[ARScreen] Requesting camera permission");
		setDebugInfo("Requesting camera access...");

		navigator.mediaDevices
			.getUserMedia({
				video: {
					facingMode: "environment",
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			})
			.then((stream) => {
				console.log("[ARScreen] ✅ Camera granted", stream);
				streamRef.current = stream;
				setCameraPermission("granted");
				setDebugInfo("Camera granted!");

				if (videoRef.current) {
					const video = videoRef.current;
					video.srcObject = stream;

					video.onloadedmetadata = () => {
						console.log("[ARScreen] Video metadata loaded");
						console.log("[ARScreen] Video dimensions:", video.videoWidth, "x", video.videoHeight);
						console.log("[ARScreen] Video readyState:", video.readyState);
						setDebugInfo(`Video ready: ${video.videoWidth}x${video.videoHeight}`);
					};

					video.oncanplay = () => {
						console.log("[ARScreen] Video can play");
						setDebugInfo("Video can play!");
					};

					video.onplaying = () => {
						console.log("[ARScreen] Video is actually playing NOW");
						console.log("[ARScreen] Video style:", video.style.cssText);
						console.log("[ARScreen] Video computed style:", window.getComputedStyle(video).display);
						console.log("[ARScreen] Video srcObject:", video.srcObject);
						console.log("[ARScreen] Stream active:", streamRef.current?.active);
						setDebugInfo("Video playing now!");
					};

					video.play()
						.then(() => {
							console.log("[ARScreen] Play() promise resolved");
							setDebugInfo("Play started!");
						})
						.catch(err => {
							console.error("[ARScreen] Video play error:", err);
							setError(`Video play error: ${err.message}`);
						});
				}
			})
			.catch((err) => {
				console.error("[ARScreen] ❌ Camera error:", err);
				setCameraPermission("denied");
				setError(`Camera error: ${err.message}`);
				setDebugInfo(`Error: ${err.name}`);
			});

		return () => {
			// Cleanup
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(track => track.stop());
			}
		};
	}, []);

	// Simulate marker detection with a timer (no AR.js)
	useEffect(() => {
		if (cameraPermission !== "granted" || !socket) return;

		console.log("[ARScreen] Setting up marker detection (simulated)");
		setDebugInfo("Point at marker to anchor...");

		// Simulate marker detection after 5 seconds
		// TODO: Replace with real marker detection later
		const detectionTimer = setTimeout(() => {
			console.log("[ARScreen] Marker detected (simulated)");

			// Update local state
			useARStore.getState().setMarkerDetected(true);
			setDebugInfo("Marker detected! Anchored!");

			// Notify server
			console.log("[ARScreen] Sending anchor_success to server");
			socket.emit("client_event", { type: "anchor_success" });
		}, 5000);

		return () => {
			clearTimeout(detectionTimer);
		};
	}, [cameraPermission, socket]);

	// Loading state
	if (cameraPermission === "pending") {
		return (
			<div className="w-full h-screen flex items-center justify-center bg-gray-900">
				<div className="text-center text-white">
					<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
					<p className="text-xl mb-2">{debugInfo}</p>
					<p className="text-sm text-gray-400">Please allow camera access</p>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="w-full h-screen flex items-center justify-center bg-red-100 p-4">
				<div className="text-center">
					<p className="text-red-600 text-xl font-bold mb-2">Camera Error</p>
					<p className="text-red-600">{error}</p>
					<p className="text-gray-600 mt-2 text-sm">{debugInfo}</p>
				</div>
			</div>
		);
	}

	// Main AR view - just video for now
	return (
		<div className="relative w-full h-screen overflow-hidden bg-black">
			{/* Video feed - full screen */}
			<video
				ref={videoRef}
				autoPlay
				playsInline
				muted
				className="w-full h-full object-cover"
			/>

			{/* Debug overlay */}
			<div className="absolute top-4 left-4 bg-black/70 text-white text-sm p-3 rounded max-w-xs z-50">
				<p className="font-bold">Debug Info:</p>
				<p>{debugInfo}</p>
				<p className="mt-1">Phase: {phase}</p>
				<p>Anchored: {isAnchored ? "✅" : "❌"}</p>
				<p>Items: {items.length}</p>
			</div>

			{/* AR Items - tappable overlays */}
			{phase === "hunting" && items.length > 0 && (
				<div className="absolute inset-0 pointer-events-none">
					{items.map((item) => {
						// Convert 3D position to 2D screen position (simplified)
						// In real AR, this would use camera projection
						// For now, distribute items across the screen
						const screenX = (item.position.x + 1) * 50; // -1 to 1 → 0% to 100%
						const screenY = (item.position.y + 1) * 50; // -1 to 1 → 0% to 100%

						const isBoss = item.type === "boss";

						return (
							<button
								key={item.id}
								onClick={() => handleTapItem(item.id)}
								onTouchEnd={(e) => {
									e.preventDefault();
									handleTapItem(item.id);
								}}
								className="absolute pointer-events-auto"
								style={{
									left: `${screenX}%`,
									top: `${screenY}%`,
									transform: 'translate(-50%, -50%)',
								}}
							>
								<div
									className={`
										${isBoss ? 'w-32 h-32 text-6xl' : 'w-20 h-20 text-4xl'}
										bg-white/90 rounded-full
										flex items-center justify-center
										shadow-2xl
										transition-transform active:scale-90
										${isBoss ? 'animate-pulse border-4 border-red-500' : 'border-2 border-blue-500'}
									`}
								>
									{isBoss ? '🎸' : '🎤'}
								</div>
							</button>
						);
					})}
				</div>
			)}

			{/* UI Overlay */}
			<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
				{phase === "anchoring" && !isAnchored && (
					<div className="bg-black/70 text-white px-8 py-6 rounded-xl text-center max-w-md">
						<h2 className="text-3xl font-bold mb-3">📷 Scan the Marker</h2>
						<p className="text-xl">Point camera at entertainer's screen</p>
					</div>
				)}

				{phase === "anchoring" && isAnchored && (
					<div className="bg-green-600/90 text-white px-8 py-6 rounded-xl text-center max-w-md animate-pulse">
						<h2 className="text-4xl font-bold mb-3">✅ You've Been Anchored!</h2>
						<p className="text-xl">Waiting for activity to start...</p>
					</div>
				)}

				{phase === "hunting" && items.length === 0 && (
					<div className="bg-black/70 text-white px-8 py-6 rounded-xl text-center max-w-md">
						<h2 className="text-3xl font-bold mb-3">🎯 Find Items!</h2>
						<p className="text-xl">Look around for items to collect</p>
					</div>
				)}
			</div>
		</div>
	);
}
