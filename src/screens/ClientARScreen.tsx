import { useEffect, useRef, useState } from "react";
import { useARStore } from "../lib/stores/useARStore";
import { useSocketStore } from "../lib/stores/useSocketStore";
import { useARSync } from "../lib/hooks/useARSync";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function ClientARScreen() {
	const { phase, isAnchored, items } = useARStore();
	const socket = useSocketStore((state) => state.socket);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [cameraReady, setCameraReady] = useState(false);
	const [gyroReady, setGyroReady] = useState(false);
	const [debugInfo, setDebugInfo] = useState<string>("Initializing...");
	const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
	const [calibratedHeading, setCalibratedHeading] = useState<number | null>(null);
	const [calibratedBeta, setCalibratedBeta] = useState<number | null>(null); // Surface level (tilt)
	const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(false);

	// Three.js refs
	const sceneRef = useRef<THREE.Scene | null>(null);
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const itemMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());

	// Sync with server
	useARSync();

	// Animate item removal (poof effect)
	const animateItemRemoval = (mesh: THREE.Object3D, onComplete: () => void) => {
		const startScale = mesh.scale.clone();
		const startTime = Date.now();
		const duration = 300; // 300ms animation

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Scale down and fade out
			const scale = startScale.x * (1 - progress);
			mesh.scale.set(scale, scale, scale);

			// Rotate while disappearing
			mesh.rotation.y += 0.2;

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				onComplete();
			}
		};

		animate();
	};

	// Request camera permissions and start video feed
	useEffect(() => {
		console.log("[ARScreen] Requesting camera access...");
		setDebugInfo("Requesting camera...");

		const startCamera = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: "environment",
						width: { ideal: 1280 },
						height: { ideal: 720 }
					}
				});

				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					await videoRef.current.play();
					console.log("[ARScreen] ✅ Camera started!");
					setCameraReady(true);
					setDebugInfo("Camera ready!");
				}
			} catch (error) {
				console.error("[ARScreen] ❌ Camera error:", error);
				setDebugInfo("Camera denied!");
			}
		};

		startCamera();

		return () => {
			// Cleanup camera
			if (videoRef.current && videoRef.current.srcObject) {
				const stream = videoRef.current.srcObject as MediaStream;
				stream.getTracks().forEach(track => track.stop());
			}
		};
	}, []);

	// Request gyroscope permissions and start orientation tracking
	useEffect(() => {
		console.log("[ARScreen] Setting up gyroscope...");

		const requestGyroPermission = async () => {
			// iOS 13+ requires permission
			if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
				try {
					const permission = await (DeviceOrientationEvent as any).requestPermission();
					if (permission === 'granted') {
						console.log("[ARScreen] ✅ Gyroscope permission granted!");
						setGyroReady(true);
						startOrientationTracking();
					} else {
						console.error("[ARScreen] ❌ Gyroscope permission denied");
						setDebugInfo("Gyroscope denied!");
					}
				} catch (error) {
					console.error("[ARScreen] ❌ Gyroscope error:", error);
					setDebugInfo("Gyroscope error!");
				}
			} else {
				// Android and older iOS - no permission needed
				console.log("[ARScreen] ✅ Gyroscope available (no permission needed)");
				setGyroReady(true);
				startOrientationTracking();
			}
		};

		const startOrientationTracking = () => {
			const handleOrientation = (event: DeviceOrientationEvent) => {
				setOrientation({
					alpha: event.alpha || 0,  // Z-axis rotation (0-360)
					beta: event.beta || 0,    // X-axis rotation (-180 to 180)
					gamma: event.gamma || 0   // Y-axis rotation (-90 to 90)
				});
			};

			window.addEventListener('deviceorientation', handleOrientation);
			setDebugInfo("Gyroscope active!");

			return () => {
				window.removeEventListener('deviceorientation', handleOrientation);
			};
		};

		// Auto-request on Android, wait for user button on iOS
		if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
			requestGyroPermission();
		}

		// Store the permission function for later use (iOS button click)
		(window as any).requestGyroPermission = requestGyroPermission;

	}, []);

	// Initialize Three.js scene
	useEffect(() => {
		if (!canvasRef.current) return;

		console.log("[ARScreen] Initializing Three.js scene...");

		// Create scene
		const scene = new THREE.Scene();
		sceneRef.current = scene;

		// Create camera (FOV, aspect, near, far)
		// Using 45° FOV (standard for AR apps) instead of 75° to reduce perspective distortion
		const camera = new THREE.PerspectiveCamera(
			45,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		camera.position.set(0, 0, 0);
		cameraRef.current = camera;

		// Create renderer with transparent background
		const renderer = new THREE.WebGLRenderer({
			canvas: canvasRef.current,
			alpha: true,
			antialias: true
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(0x000000, 0); // Transparent
		rendererRef.current = renderer;

		// Add lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(5, 10, 5);
		scene.add(directionalLight);

		console.log("[ARScreen] ✅ Three.js scene initialized!");

		// Handle window resize
		const handleResize = () => {
			if (cameraRef.current && rendererRef.current) {
				cameraRef.current.aspect = window.innerWidth / window.innerHeight;
				cameraRef.current.updateProjectionMatrix();
				rendererRef.current.setSize(window.innerWidth, window.innerHeight);
			}
		};
		window.addEventListener('resize', handleResize);

		// Animation loop
		const animate = () => {
			requestAnimationFrame(animate);
			if (rendererRef.current && sceneRef.current && cameraRef.current) {
				rendererRef.current.render(sceneRef.current, cameraRef.current);
			}
		};
		animate();

		return () => {
			window.removeEventListener('resize', handleResize);
			renderer.dispose();
		};
	}, []);

	// Update camera rotation based on device orientation
	// Items are FIXED in world space and don't move
	// Only the camera rotates to look around
	useEffect(() => {
		if (!cameraRef.current || !gyroReady) return;

		const camera = cameraRef.current;

		// Camera stays at origin (0, 0, 0) and only rotates
		// Items are positioned in world space and stay fixed
		camera.position.set(0, 0, 0);

		// Convert device orientation to Three.js camera rotation
		// Alpha (Z) = compass direction (0-360)
		// Beta (X) = front-to-back tilt (-180 to 180)
		// Gamma (Y) = left-to-right tilt (-90 to 90)

		const alphaRad = THREE.MathUtils.degToRad(orientation.alpha);
		const betaRad = THREE.MathUtils.degToRad(orientation.beta);
		const gammaRad = THREE.MathUtils.degToRad(orientation.gamma);

		// Apply rotations to camera only - items stay in place
		camera.rotation.set(betaRad, alphaRad, -gammaRad, 'YXZ');

	}, [orientation, gyroReady]);

	// Spawn 3D items randomly around the player (not in a circle)
	useEffect(() => {
		if (!sceneRef.current) return;
		if (!calibratedHeading || calibratedBeta === null) return; // Don't spawn until calibrated
		if (items.length === 0) return;

		console.log("[ARScreen] Spawning", items.length, "items in 360° space");

		const scene = sceneRef.current;
		const loader = new GLTFLoader();

		// ONLY SPAWN ONE ITEM AT A TIME - find the first new item
		const newItem = items.find((item) => !itemMeshesRef.current.has(item.id));
		if (!newItem) {
			// All items already spawned, check for removal
			itemMeshesRef.current.forEach((mesh, id) => {
				const stillExists = items.some(item => item.id === id);
				if (!stillExists) {
					// Animate removal (poof effect)
					animateItemRemoval(mesh, () => {
						scene.remove(mesh);
						itemMeshesRef.current.delete(id);
					});
				}
			});
			return;
		}

		// LIVE tilt restriction (must be between 40° and 110°)
		if (orientation.beta < 40 || orientation.beta > 110) {
			console.warn(`[AR] Skipping spawn — LIVE beta = ${orientation.beta.toFixed(1)}°`);
			return;
		}


		// Spawn only the new item
		const item = newItem;

		loader.load(
			"/models/snickers/scene.gltf",
			(gltf) => {
				const model = gltf.scene;

				let x: number, y: number, z: number;
				// Restrict NORMAL item spawning to beta 40–110°
				if (item.type !== "boss") {
					if (calibratedBeta < 40 || calibratedBeta > 110) {
						console.warn(`[AR] Skip spawn — calibrated beta ${calibratedBeta.toFixed(1)}° outside 40–110°`);
						return;
					}
				}

				if (item.type === "boss") {
					// Boss: ALWAYS at Y=0 (chest height), toward calibrated stage direction
					// FIXED: Use proper compass-to-Three.js coordinate conversion
					const distance = 40; // 15 meters toward stage

					// Convert compass heading to Three.js coordinates
					const angleInThreeJS = -THREE.MathUtils.degToRad(calibratedHeading) + Math.PI / 2;

					x = Math.cos(angleInThreeJS) * distance;
					y = 0; // ALWAYS at chest height (Y=0)
					z = Math.sin(angleInThreeJS) * distance;

					console.log(`[ARScreen] Boss positioned at Y=0, compass ${calibratedHeading.toFixed(0)}° at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
				} else {
				// LIVE tilt restriction — only spawn when beta is between 40° and 110°
				if (orientation.beta < 40 || orientation.beta > 110) {
					console.warn(`[AR] Skipping spawn — Current beta = ${orientation.beta.toFixed(1)}°`);
					return;
				}

				// DEPTH — biased probability
				let minRadius, maxRadius;
				const r = Math.random();

				if (r < 0.7) {
					// 70% far range
					minRadius = 50;
					maxRadius = 90;
				} else {
					// 30% medium range
					minRadius = 40;
					maxRadius = 80;
				}

				const radius = minRadius + Math.random() * (maxRadius - minRadius);

				// Horizontal placement
				const randomAngle = Math.random() * Math.PI * 2;
				x = radius * Math.cos(randomAngle);
				z = radius * Math.sin(randomAngle);

				// TILT-MAPPED VERTICAL Y placement (20 → 40)
				const betaNorm = (calibratedBeta - 40) / (110 - 40);
				y = 20 + betaNorm * 20; // always between 20 and 40 meters
				}

				model.position.set(x, y, z);

				// Scale model - Boss: 0.5x, Regular: 0.3x
				const scale = item.type === "boss" ? 2.0 : 1.2;
				model.scale.set(scale, scale, scale);

				// Rotate to face player
				model.lookAt(0, y, 0);

				// Store user data for raycasting
				model.userData = { itemId: item.id, itemType: item.type };
				model.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.userData = { itemId: item.id, itemType: item.type };
					}
				});

				// Add to scene
				scene.add(model);
				itemMeshesRef.current.set(item.id, model);

				console.log(`[ARScreen] Spawned ${item.type} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
			},
			undefined,
			(error) => {
				console.error("[ARScreen] Error loading model:", error);
			}
		);

	}, [items, calibratedHeading, calibratedBeta]);

	// Handle tapping on items using raycasting
	const handleScreenTap = (event: React.MouseEvent | React.TouchEvent) => {
		if (!cameraRef.current || !sceneRef.current || items.length === 0) return;

		// Get tap coordinates
		let clientX: number, clientY: number;
		if ('touches' in event) {
			// Touch event
			if (event.touches.length === 0) return;
			clientX = event.touches[0].clientX;
			clientY = event.touches[0].clientY;
		} else {
			// Mouse event
			clientX = event.clientX;
			clientY = event.clientY;
		}

		// Convert to normalized device coordinates (-1 to +1)
		const mouse = new THREE.Vector2();
		mouse.x = (clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(clientY / window.innerHeight) * 2 + 1;

		// Create raycaster
		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, cameraRef.current);

		// Get all meshes from items
		const meshes: THREE.Object3D[] = [];
		itemMeshesRef.current.forEach((mesh) => {
			meshes.push(mesh);
		});

		// Check for intersections
		const intersects = raycaster.intersectObjects(meshes, true);

		if (intersects.length > 0) {
			// Find the item ID from the intersected object
			let itemId: string | null = null;
			let current = intersects[0].object;

			// Traverse up to find the item ID
			while (current && !itemId) {
				if (current.userData && current.userData.itemId) {
					itemId = current.userData.itemId;
				}
				current = current.parent as THREE.Object3D;
			}

			if (itemId) {
				console.log("[ARScreen] Tapped item:", itemId);

				const mesh = itemMeshesRef.current.get(itemId);
				if (!mesh) return;

				const itemType = mesh.userData?.itemType;

				// Only animate removal for regular items, not boss
				if (itemType !== "boss") {
					animateItemRemoval(mesh, () => {
						// Animation complete - item will be removed when server updates
					});
				} else {
					// Boss: Play damage animation (red flash + shake)
					const originalScale = mesh.scale.clone();
					const originalPosition = mesh.position.clone();
					const startTime = Date.now();
					const duration = 300;

					// Store original materials to restore later
					const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
					mesh.traverse((child) => {
						if (child instanceof THREE.Mesh) {
							originalMaterials.set(child, child.material);
							// Flash red
							child.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
						}
					});

					const hitAnimate = () => {
						const elapsed = Date.now() - startTime;
						const progress = Math.min(elapsed / duration, 1);

						if (progress < 0.5) {
							// First half: shake and flash red
							const shake = Math.sin(progress * Math.PI * 20) * 0.5;
							mesh.position.set(
								originalPosition.x + shake,
								originalPosition.y + shake,
								originalPosition.z + shake
							);

							// Pulse scale
							const scaleFactor = 1 + Math.sin(progress * Math.PI * 2) * 0.15;
							mesh.scale.set(
								originalScale.x * scaleFactor,
								originalScale.y * scaleFactor,
								originalScale.z * scaleFactor
							);
						} else {
							// Second half: restore materials
							mesh.traverse((child) => {
								if (child instanceof THREE.Mesh && originalMaterials.has(child)) {
									child.material = originalMaterials.get(child)!;
								}
							});
						}

						if (progress < 1) {
							requestAnimationFrame(hitAnimate);
						} else {
							// Restore everything
							mesh.position.copy(originalPosition);
							mesh.scale.copy(originalScale);
							mesh.traverse((child) => {
								if (child instanceof THREE.Mesh && originalMaterials.has(child)) {
									child.material = originalMaterials.get(child)!;
								}
							});
						}
					};

					hitAnimate();
					console.log("[ARScreen] Boss hit! Damage dealt!");
				}

				// Notify server (can tap boss multiple times)
				if (socket) {
					socket.emit("client_event", { type: "tap_item", itemId });
				}
			}
		}
	};

	// Show calibration prompt when gyroscope is ready
	useEffect(() => {
		if (gyroReady && !isAnchored && !calibratedHeading) {
			setShowCalibrationPrompt(true);
			setDebugInfo("Point phone at entertainer screen and tap Calibrate");
		}
	}, [gyroReady, isAnchored, calibratedHeading]);

	// Handle calibration button click
	const handleCalibrate = () => {
		if (!gyroReady) return;

		// Check if phone is held upright (beta between 40-110 degrees)
		const currentBeta = orientation.beta;
		if (currentBeta < 40 || currentBeta > 110) {
			setDebugInfo(`Please hold phone upright! Beta: ${currentBeta.toFixed(0)}° (need 40-110°)`);
			console.warn(`[ARScreen] Cannot calibrate - phone not upright. Beta: ${currentBeta.toFixed(0)}°`);
			return;
		}

		// Save current compass heading AND surface level (beta) as reference
		const currentHeading = orientation.alpha;

		setCalibratedHeading(currentHeading);
		setCalibratedBeta(currentBeta); // Save phone tilt angle during calibration
		setShowCalibrationPrompt(false);

		console.log(`[ARScreen] Calibrated! Stage: ${currentHeading.toFixed(0)}°, Beta (tilt): ${currentBeta.toFixed(0)}°`);
		setDebugInfo(`Calibrated to ${currentHeading.toFixed(0)}°`);

		// Anchor the player
		if (socket) {
			useARStore.getState().setAnchored(true);
			socket.emit("client_event", { type: "anchor_success" });
		}
	};

	return (
		<div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
			{/* Video feed background */}
			<video
				ref={videoRef}
				autoPlay
				playsInline
				muted
				className="absolute inset-0 w-full h-full object-cover"
				style={{ zIndex: 1 }}
			/>

			{/* Three.js canvas overlay */}
			<canvas
				ref={canvasRef}
				className="absolute inset-0 w-full h-full pointer-events-none"
				style={{ zIndex: 10 }}
			/>

			{/* Tap detection overlay */}
			<div
				className="absolute inset-0 w-full h-full"
				style={{ zIndex: 20 }}
				onClick={handleScreenTap}
				onTouchStart={handleScreenTap}
			/>

			{/* Debug overlay */}
			<div
				className="bg-black/80 text-white text-xs p-2 rounded max-w-xs pointer-events-none"
				style={{
					position: "fixed",
					top: "10px",
					left: "10px",
					zIndex: 99999,
					maxHeight: "40vh",
					overflowY: "auto"
				}}
			>

				<p>Calibrated: {calibratedHeading !== null ? "✅" : "❌"}</p>
				<p className="mt-1">Phase: {phase}</p>
				<p>Items: {items.length}</p>

								<p className="mt-2 font-semibold text-yellow-300">Tilt Debug:</p>
				<p className="text-xs">
					Live Beta: {orientation.beta.toFixed(1)}°  
				</p>
				<p className="text-xs">
					Calibrated Beta: {calibratedBeta !== null ? calibratedBeta.toFixed(1) : "—"}°  
				</p>
				<p className="text-xs">
					Beta Norm: {
						calibratedBeta !== null 
							? ((calibratedBeta - 40) / (110 - 40)).toFixed(2) 
							: "—"
					}
				</p>

				<p className="mt-1 font-semibold">Orientation:</p>
				<p className="text-xs">Alpha (compass): {orientation.alpha.toFixed(0)}°</p>
				<p className="text-xs">Beta (tilt): {orientation.beta.toFixed(0)}°</p>
				<p className="text-xs">Gamma (roll): {orientation.gamma.toFixed(0)}°</p>

				{calibratedHeading !== null && (
					<>
						<p className="mt-1 font-semibold">Calibration:</p>
						<p className="text-xs">Stage: {calibratedHeading.toFixed(0)}°</p>
						{calibratedBeta !== null && (
							<p className="text-xs">Level: {calibratedBeta.toFixed(0)}°</p>
						)}
					</>
				)}

				{items.length > 0 && (
					<>
						<p className="mt-1 font-semibold">Spawned Items:</p>
						{Array.from(itemMeshesRef.current.entries()).map(([id, mesh]) => {
							const pos = mesh.position;
							const itemData = items.find(i => i.id === id);
							return (
								<p key={id} className="text-xs">
									{itemData?.type === "boss" ? "🔥BOSS" : "📦"}:
									X={pos.x.toFixed(0)} Y={pos.y.toFixed(0)} Z={pos.z.toFixed(0)}
								</p>
							);
						})}
					</>
				)}
			</div>

			{/* Crosshair for aiming */}
			{gyroReady && phase === "hunting" && (
				<div
					className="absolute pointer-events-none"
					style={{
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						zIndex: 30
					}}
				>
					<div className="w-8 h-8 border-2 border-white rounded-full opacity-70" />
					<div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2" />
				</div>
			)}

			{/* UI Overlays */}
			<div
				className="flex flex-col items-center justify-center pointer-events-none"
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					width: "100vw",
					height: "100vh",
					zIndex: 9999
				}}
			>
				{!cameraReady && (
					<div className="bg-black/70 text-white px-8 py-6 rounded-xl text-center max-w-md">
						<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
						<h2 className="text-3xl font-bold mb-3">Starting Camera...</h2>
						<p className="text-xl">Please allow camera access</p>
					</div>
				)}

				{cameraReady && !gyroReady && typeof (DeviceOrientationEvent as any).requestPermission === 'function' && (
					<div className="bg-black/70 text-white px-8 py-6 rounded-xl text-center max-w-md pointer-events-auto">
						<h2 className="text-3xl font-bold mb-3">Enable Motion Sensors</h2>
						<p className="text-xl mb-6">Tap to allow gyroscope access</p>
						<button
							className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl"
							onClick={() => (window as any).requestGyroPermission()}
						>
							Enable Gyroscope
						</button>
					</div>
				)}

				{showCalibrationPrompt && (
					<div className="bg-black/80 text-white px-8 py-6 rounded-xl text-center max-w-md pointer-events-auto">
						<h2 className="text-3xl font-bold mb-3">📍 Calibrate Direction</h2>
						<p className="text-xl mb-4">Point your phone at the entertainer screen</p>
						<p className="text-base mb-6 opacity-80">This helps position items correctly</p>
						<button
							className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl"
							onClick={handleCalibrate}
						>
							Calibrate
						</button>
					</div>
				)}

				{phase === "anchoring" && isAnchored && (
					<div className="bg-green-600/90 text-white px-8 py-6 rounded-xl text-center max-w-md animate-pulse">
						<h2 className="text-4xl font-bold mb-3">✅ Ready!</h2>
						<p className="text-xl">Waiting for activity to start...</p>
					</div>
				)}

				{phase === "hunting" && items.length === 0 && (
					<div className="bg-black/70 text-white px-8 py-6 rounded-xl text-center max-w-md">
						<h2 className="text-3xl font-bold mb-3">🎯 Look Around!</h2>
						<p className="text-xl">Rotate your phone to find items</p>
					</div>
				)}

				{phase === "hunting" && items.length > 0 && (
					<div className="bg-black/70 text-white px-6 py-4 rounded-xl text-center">
						{items.some(item => item.type === "boss") ? (
							<>
								<p className="text-2xl font-bold text-red-400">🔥 BOSS APPEARED!</p>
								<p className="text-lg mt-2">Point toward entertainer screen!</p>
								<p className="text-sm mt-1">Everyone must attack together!</p>
							</>
						) : (
							<>
								<p className="text-2xl font-bold">Rotate to find items!</p>
								<p className="text-lg mt-2">Tap directly on any item you see</p>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
