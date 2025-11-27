import { useEffect, useRef, useState } from "react";
import { useARStore } from "../lib/stores/useARStore";
import { useARSync } from "../lib/hooks/useARSync";
import { useSocketStore } from "../lib/stores/useSocketStore";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Declare AR.js types
declare global {
	interface Window {
		THREEx: any;
	}
}

export default function ClientARScreen() {
	const {
		phase,
		items,
		isAnchored,
		bossHealth,
		bossMaxHealth,
		totalTaps,
		tapsNeeded,
		participatingPlayers,
	} = useARStore();
	const [cameraPermission, setCameraPermission] = useState<
		"granted" | "denied" | "pending"
	>("pending");
	const [error, setError] = useState<string | null>(null);
	const [arReady, setArReady] = useState(false);
	const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const sceneRef = useRef<THREE.Scene | null>(null);
	const cameraRef = useRef<THREE.Camera | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const arToolkitSourceRef = useRef<any>(null);
	const arToolkitContextRef = useRef<any>(null);
	const markerRootRef = useRef<THREE.Group | null>(null);
	const itemMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
	const gltfModelRef = useRef<THREE.Object3D | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	useARSync();

	// Request camera permission and start video
	useEffect(() => {
		console.log("[ARScreen] Starting camera initialization");
		console.log("[ARScreen] Protocol:", window.location.protocol);
		console.log("[ARScreen] MediaDevices available:", !!navigator.mediaDevices);
		console.log("[ARScreen] getUserMedia available:", !!navigator.mediaDevices?.getUserMedia);

		setDebugInfo("Checking camera access...");

		// Check if we're in a secure context
		if (!window.isSecureContext && window.location.hostname !== 'localhost') {
			const msg = "Camera requires HTTPS (secure connection)";
			console.error("[ARScreen]", msg);
			setCameraPermission("denied");
			setError(msg);
			setDebugInfo(msg);
			return;
		}

		// Check if mediaDevices API is available
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			const msg = "Camera API not available in this browser";
			console.error("[ARScreen]", msg);
			setCameraPermission("denied");
			setError(msg);
			setDebugInfo(msg);
			return;
		}

		setDebugInfo("Requesting camera permission...");
		console.log("[ARScreen] Calling getUserMedia");

		navigator.mediaDevices
			.getUserMedia({
				video: {
					facingMode: "environment",
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			})
			.then((stream) => {
				console.log("[ARScreen] ✅ Camera permission granted", stream);
				streamRef.current = stream;
				setCameraPermission("granted");
				setDebugInfo("Camera granted, loading AR...");

				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					videoRef.current.play().catch(err => {
						console.error("[ARScreen] Video play error:", err);
					});
				}
			})
			.catch((err) => {
				console.error("[ARScreen] ❌ Camera error:", err);
				console.error("[ARScreen] Error name:", err.name);
				console.error("[ARScreen] Error message:", err.message);

				setCameraPermission("denied");

				let errorMsg = "Camera access denied";
				if (err.name === "NotAllowedError") {
					errorMsg = "Camera permission denied by user";
				} else if (err.name === "NotFoundError") {
					errorMsg = "No camera found on device";
				} else if (err.name === "NotReadableError") {
					errorMsg = "Camera is in use by another app";
				} else if (err.name === "SecurityError") {
					errorMsg = "Camera requires HTTPS connection";
				}

				setError(`${errorMsg}: ${err.message}`);
				setDebugInfo(`Error: ${err.name} - ${err.message}`);
			});

		return () => {
			// Cleanup camera stream
			console.log("[ARScreen] Cleaning up camera stream");
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(track => {
					console.log("[ARScreen] Stopping track:", track.kind);
					track.stop();
				});
			}
		};
	}, []);

	// Load AR.js script
	useEffect(() => {
		if (cameraPermission !== "granted") return;

		console.log("[ARScreen] Loading AR.js");
		setDebugInfo("Loading AR.js library...");

		// Check if already loaded
		if (window.THREEx) {
			console.log("[ARScreen] AR.js already loaded");
			setArReady(true);
			setDebugInfo("AR.js loaded");
			return;
		}

		const script = document.createElement("script");
		// Use the Three.js version, not A-Frame
		script.src = "https://raw.githack.com/AR-js-org/AR.js/master/three.js/build/ar-threex.js";
		script.async = true;
		script.onload = () => {
			console.log("[ARScreen] AR.js loaded successfully");
			setArReady(true);
			setDebugInfo("AR.js loaded");
		};
		script.onerror = (err) => {
			console.error("[ARScreen] Failed to load AR.js:", err);
			setError("Failed to load AR library");
			setDebugInfo("Failed to load AR.js");
		};
		document.body.appendChild(script);

		return () => {
			if (document.body.contains(script)) {
				document.body.removeChild(script);
			}
		};
	}, [cameraPermission]);

	// Initialize Three.js + AR.js
	useEffect(() => {
		if (!arReady || !videoRef.current || !canvasRef.current) {
			console.log("[ARScreen] Not ready:", { arReady, video: !!videoRef.current, canvas: !!canvasRef.current });
			return;
		}

		console.log("[ARScreen] Initializing AR scene");
		setDebugInfo("Setting up AR scene...");

		// Three.js setup
		const scene = new THREE.Scene();
		sceneRef.current = scene;

		const camera = new THREE.Camera();
		cameraRef.current = camera;
		scene.add(camera);

		const renderer = new THREE.WebGLRenderer({
			canvas: canvasRef.current,
			antialias: true,
			alpha: true,
		});
		rendererRef.current = renderer;
		renderer.setClearColor(new THREE.Color(0x000000), 0);
		renderer.setSize(window.innerWidth, window.innerHeight);

		// Lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		scene.add(ambientLight);
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
		directionalLight.position.set(0, 1, 0);
		camera.add(directionalLight);

		console.log("[ARScreen] Setting up AR.js");
		const THREEx = window.THREEx;

		// AR.js source (from video element)
		const arToolkitSource = new THREEx.ArToolkitSource({
			sourceType: "webcam",
			sourceWidth: 1280,
			sourceHeight: 720,
			displayWidth: window.innerWidth,
			displayHeight: window.innerHeight,
		});

		arToolkitSourceRef.current = arToolkitSource;

		arToolkitSource.init(() => {
			console.log("[ARScreen] AR source initialized");
			setDebugInfo("AR source ready");
			onResize();
		}, (err: any) => {
			console.error("[ARScreen] AR source init error:", err);
			setError("AR initialization failed");
			setDebugInfo(`AR init error: ${err}`);
		});

		// AR.js context
		const arToolkitContext = new THREEx.ArToolkitContext({
			cameraParametersUrl: "/data/camera_para.dat",
			detectionMode: "mono",
		});
		arToolkitContextRef.current = arToolkitContext;

		arToolkitContext.init(() => {
			console.log("[ARScreen] AR context initialized");
			camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
			setDebugInfo("AR ready! Point at marker");
		});

		// Marker root
		const markerRoot = new THREE.Group();
		markerRootRef.current = markerRoot;
		scene.add(markerRoot);

		// Marker controls (Hiro marker)
		const markerControls = new THREEx.ArMarkerControls(
			arToolkitContext,
			markerRoot,
			{
				type: "pattern",
				patternUrl: "/data/patt.hiro",
			},
		);

		let hasAnchored = false;
		markerControls.addEventListener("markerFound", () => {
			console.log("[ARScreen] ✅ Marker detected!");
			setDebugInfo("Marker found!");
			useARStore.getState().setMarkerDetected(true);

			if (!hasAnchored && !isAnchored) {
				console.log("[ARScreen] Anchoring success!");
				hasAnchored = true;
				useARStore.getState().setAnchored(true);
				useSocketStore.getState().emit({ type: "anchor_success" });
				setDebugInfo("Anchored! Waiting for game...");
			}
		});

		markerControls.addEventListener("markerLost", () => {
			console.log("[ARScreen] Marker lost");
			setDebugInfo("Marker lost - scan again");
			useARStore.getState().setMarkerDetected(false);
		});

		// Window resize handler
		function onResize() {
			if (!arToolkitSource || !arToolkitSource.ready) return;
			arToolkitSource.onResizeElement();
			arToolkitSource.copyElementSizeTo(renderer.domElement);
			if (arToolkitContext.arController) {
				arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
			}
		}
		window.addEventListener("resize", onResize);

		// Load GLTF model
		const loader = new GLTFLoader();
		loader.load(
			"/models/scene.gltf",
			(gltf) => {
				console.log("[ARScreen] GLTF model loaded");
				gltfModelRef.current = gltf.scene;
				setDebugInfo("3D model loaded");
			},
			(progress) => {
				const percent = (progress.loaded / progress.total) * 100;
				console.log(`[ARScreen] Loading model: ${percent.toFixed(0)}%`);
			},
			(error) => {
				console.error("[ARScreen] Error loading GLTF:", error);
				setError("Failed to load 3D model");
			},
		);

		// Animation loop
		let animationId: number;
		function animate() {
			animationId = requestAnimationFrame(animate);

			if (arToolkitSource && arToolkitSource.ready) {
				arToolkitContext.update(arToolkitSource.domElement);
			}

			// Rotate items
			itemMeshesRef.current.forEach((mesh) => {
				mesh.rotation.y += 0.01;
			});

			renderer.render(scene, camera);
		}
		animate();

		// Cleanup
		return () => {
			console.log("[ARScreen] Cleaning up");
			cancelAnimationFrame(animationId);
			window.removeEventListener("resize", onResize);
			renderer.dispose();
		};
	}, [arReady, isAnchored]);

	// Update items in 3D scene
	useEffect(() => {
		if (!markerRootRef.current || !gltfModelRef.current) return;

		const markerRoot = markerRootRef.current;
		const itemMeshes = itemMeshesRef.current;

		console.log("[ARScreen] Updating items:", items);

		// Remove old items
		itemMeshes.forEach((mesh, id) => {
			if (!items.find((item) => item.id === id)) {
				markerRoot.remove(mesh);
				itemMeshes.delete(id);
			}
		});

		// Add/update items
		items.forEach((item) => {
			let mesh = itemMeshes.get(item.id);

			if (!mesh && gltfModelRef.current) {
				// Clone the GLTF model for this item
				mesh = gltfModelRef.current.clone();
				mesh.userData.itemId = item.id;
				mesh.userData.itemType = item.type;

				markerRoot.add(mesh);
				itemMeshes.set(item.id, mesh);

				console.log(`[ARScreen] Created ${item.type} item at`, item.position);
			}

			if (mesh) {
				// Update position and scale
				mesh.position.set(item.position.x, item.position.y, item.position.z);
				mesh.scale.setScalar(item.scale * 0.1);
			}
		});
	}, [items]);

	// Handle tap/click on items
	const handleTap = (event: React.TouchEvent | React.MouseEvent) => {
		if (!isAnchored || !cameraRef.current || !canvasRef.current) return;

		const rect = canvasRef.current.getBoundingClientRect();
		const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
		const clientY = "touches" in event ? event.touches[0].clientY : event.clientY;

		const x = ((clientX - rect.left) / rect.width) * 2 - 1;
		const y = -((clientY - rect.top) / rect.height) * 2 + 1;

		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

		const meshes = Array.from(itemMeshesRef.current.values());
		const intersects: THREE.Intersection<THREE.Object3D>[] = [];

		meshes.forEach((mesh) => {
			raycaster.intersectObject(mesh, true, intersects);
		});

		if (intersects.length > 0) {
			let intersectedItem: THREE.Object3D | null = intersects[0].object;
			while (intersectedItem && !intersectedItem.userData.itemId) {
				intersectedItem = intersectedItem.parent;
			}

			if (intersectedItem && intersectedItem.userData.itemId) {
				const itemId = intersectedItem.userData.itemId;
				console.log("[ARScreen] Tapped item:", itemId);

				useSocketStore.getState().emit({ type: "tap_item", itemId });

				// Visual feedback
				const originalScale = intersectedItem.scale.clone();
				intersectedItem.scale.multiplyScalar(1.2);
				setTimeout(() => {
					if (intersectedItem) {
						intersectedItem.scale.copy(originalScale);
					}
				}, 150);
			}
		}
	};

	// Render different states
	if (cameraPermission === "denied") {
		return (
			<div className="w-full h-screen flex items-center justify-center bg-red-100 p-4">
				<div className="text-center">
					<p className="text-red-600 text-xl mb-4">{error}</p>
					<p className="text-gray-600">
						Please enable camera access in your browser settings and refresh the page.
					</p>
				</div>
			</div>
		);
	}

	if (cameraPermission === "pending" || !arReady) {
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

	if (error) {
		return (
			<div className="w-full h-screen flex items-center justify-center bg-red-100 p-4">
				<div className="text-center">
					<p className="text-red-600 text-xl">{error}</p>
					<p className="text-gray-600 mt-2">{debugInfo}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative w-full h-screen overflow-hidden bg-black">
			{/* Hidden video element for camera feed */}
			<video
				ref={videoRef}
				autoPlay
				playsInline
				muted
				className="hidden"
			/>

			{/* AR Canvas */}
			<canvas
				ref={canvasRef}
				className="absolute inset-0 w-full h-full"
				onClick={handleTap}
				onTouchEnd={handleTap}
			/>

			{/* Debug info */}
			<div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded max-w-xs">
				<p>{debugInfo}</p>
				<p className="mt-1">Phase: {phase}</p>
				<p>Anchored: {isAnchored ? "✅" : "❌"}</p>
				<p>Items: {items.length}</p>
			</div>

			{/* UI Overlay */}
			<div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent text-white text-center pointer-events-none">
				{phase === "anchoring" && (
					<div>
						<h2 className="text-2xl font-bold mb-2">Scan the Marker</h2>
						<p className="text-lg">
							{isAnchored
								? "✅ Anchored! Waiting for activity to start..."
								: "📷 Point camera at the entertainer's screen"}
						</p>
					</div>
				)}

				{phase === "hunting" && (
					<div>
						<h2 className="text-2xl font-bold mb-2">Find & Tap Items!</h2>
						<p className="text-lg">
							Progress: {totalTaps} / {tapsNeeded} taps
						</p>
						<p className="text-sm mt-1">You need 10 taps minimum</p>
					</div>
				)}

				{phase === "boss" && (
					<div>
						<h2 className="text-2xl font-bold mb-2 text-red-400">
							BOSS ITEM!
						</h2>
						<div className="w-full max-w-md mx-auto bg-gray-700 h-6 rounded-full overflow-hidden">
							<div
								className="bg-red-500 h-full transition-all duration-300"
								style={{
									width: `${bossMaxHealth > 0 ? (bossHealth / bossMaxHealth) * 100 : 0}%`,
								}}
							/>
						</div>
						<p className="mt-1 text-lg">
							{bossHealth} / {bossMaxHealth} HP
						</p>
					</div>
				)}

				{phase === "results" && (
					<div>
						<h2 className="text-3xl font-bold mb-4">Item Collected!</h2>
						<p className="text-xl">Total Taps: {totalTaps}</p>
						<p>Players: {participatingPlayers}</p>
					</div>
				)}
			</div>

			{/* Crosshair */}
			{isAnchored && phase !== "results" && (
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
					<div className="w-10 h-10 border-2 border-white rounded-full" />
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />
				</div>
			)}
		</div>
	);
}
