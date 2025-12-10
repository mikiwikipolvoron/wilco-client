import { Howl } from "howler";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useARSync } from "../lib/hooks/useARSync";
import { useARStore } from "../lib/stores/useARStore";
import { useSocketStore } from "../lib/stores/useSocketStore";

type BossHit = { id: number; value: number; x: number; y: number };

export default function ClientARScreen() {
	const {
		phase,
		isAnchored,
		items,
		currentSlide,
		calibratedHeading,
		calibratedBeta,
		setCalibration,
	} = useARStore();
	const socket = useSocketStore((state) => state.socket);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [cameraReady, setCameraReady] = useState(false);
	const [gyroReady, setGyroReady] = useState(false);
	const [_debugInfo, setDebugInfo] = useState<string>("Initializing...");
	const [orientation, setOrientation] = useState({
		alpha: 0,
		beta: 0,
		gamma: 0,
	});
	const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(false);
	const [playerTapCount, setPlayerTapCount] = useState(0); // Track player's personal tap count
	const [bossHits, setBossHits] = useState<BossHit[]>([]);

	// Sound effects
	const itemTapSoundRef = useRef<Howl | null>(null);
	const bossTapSoundRef = useRef<Howl | null>(null);

	// Three.js refs
	const sceneRef = useRef<THREE.Scene | null>(null);
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
	const itemMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());

	// Sync with server
	useARSync();

	// Initialize sound effects
	useEffect(() => {
		// Load item tap sound (use a pop/collect sound)
		itemTapSoundRef.current = new Howl({
			src: ["/sounds/beam_sound-103367.mp3"],
			volume: 0.8,
			preload: true,
		});

		// Load boss tap sound (use a hit/damage sound)
		bossTapSoundRef.current = new Howl({
			src: ["/sounds/damage.mp3"],
			volume: 0.6,
			preload: true,
		});

		return () => {
			itemTapSoundRef.current?.unload();
			bossTapSoundRef.current?.unload();
		};
	}, []);

	// Animate item removal with explosion effect
	const animateItemRemoval = useCallback(
		(mesh: THREE.Object3D, onComplete: () => void) => {
			const startScale = mesh.scale.clone();
			const startPosition = mesh.position.clone();
			const startTime = Date.now();
			const duration = 400; // 400ms animation

			// Create particle explosion effect
			const particleCount = 8;
			const particles: THREE.Mesh[] = [];
			const particleVelocities: THREE.Vector3[] = [];

			if (sceneRef.current) {
				for (let i = 0; i < particleCount; i++) {
					const geometry = new THREE.SphereGeometry(0.3, 8, 8);
					const material = new THREE.MeshBasicMaterial({
						color: 0xffaa00,
						transparent: true,
						opacity: 1,
					});
					const particle = new THREE.Mesh(geometry, material);
					particle.position.copy(startPosition);

					// Random velocity in all directions
					const angle = (i / particleCount) * Math.PI * 2;
					const speed = 3 + Math.random() * 2;
					particleVelocities.push(
						new THREE.Vector3(
							Math.cos(angle) * speed,
							Math.random() * speed * 0.5,
							Math.sin(angle) * speed,
						),
					);

					sceneRef.current.add(particle);
					particles.push(particle);
				}
			}

			const animate = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / duration, 1);

				// Main item: expand then shrink with rotation
				if (progress < 0.3) {
					// First 30%: quick expand
					const expandScale = 1 + progress * 3;
					mesh.scale.set(
						startScale.x * expandScale,
						startScale.y * expandScale,
						startScale.z * expandScale,
					);
				} else {
					// Then shrink rapidly
					const shrinkProgress = (progress - 0.3) / 0.7;
					const scale = startScale.x * (1 - shrinkProgress);
					mesh.scale.set(scale, scale, scale);
				}

				// Fast rotation
				mesh.rotation.y += 0.3;
				mesh.rotation.x += 0.2;

				// Animate particles
				particles.forEach((particle, i) => {
					const velocity = particleVelocities[i];
					particle.position.add(
						velocity.clone().multiplyScalar(0.016 * (1 - progress)),
					);
					(particle.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
				});

				if (progress < 1) {
					requestAnimationFrame(animate);
				} else {
					// Cleanup particles
					particles.forEach((particle) => {
						sceneRef.current?.remove(particle);
						particle.geometry.dispose();
						(particle.material as THREE.Material).dispose();
					});
					onComplete();
				}
			};

			animate();
		},
		[],
	);

	// Request camera permissions and start video feed
	useEffect(() => {
		// Only start camera when on slide 3 (calibration instruction) or in anchoring phase
		if (phase === "instructions" && currentSlide < 3) {
			return;
		}

		console.log("[ARScreen] Requesting camera access...");
		setDebugInfo("Requesting camera...");

		const startCamera = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: "environment",
						width: { ideal: 1280 },
						height: { ideal: 720 },
					},
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
			if (videoRef.current?.srcObject) {
				const stream = videoRef.current.srcObject as MediaStream;
				// biome-ignore lint/suspicious/useIterableCallbackReturn: howler type issue?
				stream.getTracks().forEach((track) => track.stop());
			}
		};
	}, [phase, currentSlide]);

	// Request gyroscope permissions and start orientation tracking
	useEffect(() => {
		console.log("[ARScreen] Setting up gyroscope...");

		const requestGyroPermission = async () => {
			// iOS 13+ requires permission
			if (
				// biome-ignore lint: any
				typeof (DeviceOrientationEvent as any).requestPermission === "function"
			) {
				try {
					const permission = await // biome-ignore lint: any
					(DeviceOrientationEvent as any).requestPermission();
					if (permission === "granted") {
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
					alpha: event.alpha || 0, // Z-axis rotation (0-360)
					beta: event.beta || 0, // X-axis rotation (-180 to 180)
					gamma: event.gamma || 0, // Y-axis rotation (-90 to 90)
				});
			};

			window.addEventListener("deviceorientation", handleOrientation);
			setDebugInfo("Gyroscope active!");

			return () => {
				window.removeEventListener("deviceorientation", handleOrientation);
			};
		};

		// Auto-request on Android, wait for user button on iOS
		if (
			typeof (DeviceOrientationEvent as any).requestPermission !== "function"
		) {
			requestGyroPermission();
		}

		// Store the permission function for later use (iOS button click)
		(window as any).requestGyroPermission = requestGyroPermission;
	}, []);

	// Initialize Three.js scene
	useEffect(() => {
		if (!canvasRef.current) return;
		if (sceneRef.current) return; // Already initialized, don't recreate

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
			1000,
		);
		camera.position.set(0, 0, 0);
		cameraRef.current = camera;

		// Create renderer with transparent background
		const renderer = new THREE.WebGLRenderer({
			canvas: canvasRef.current,
			alpha: true,
			antialias: true,
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
		window.addEventListener("resize", handleResize);

		// Animation loop
		const animate = () => {
			requestAnimationFrame(animate);
			if (rendererRef.current && sceneRef.current && cameraRef.current) {
				rendererRef.current.render(sceneRef.current, cameraRef.current);
			}
		};
		animate();

		return () => {
			window.removeEventListener("resize", handleResize);
			renderer.dispose();
		};
	}, [phase]); // Re-run when phase changes so scene initializes when canvas appears

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
		camera.rotation.set(betaRad, alphaRad, -gammaRad, "YXZ");
	}, [orientation, gyroReady]);

	// Spawn 3D items randomly around the player (not in a circle)
	useEffect(() => {
		if (!sceneRef.current) {
			console.log("[AR] Items not spawned: scene not ready");
			return;
		}
		if (!calibratedHeading || calibratedBeta === null) {
			console.log(
				"[AR] Items not spawned: not calibrated yet. Items in store:",
				items.length,
			);
			return;
		}
		if (items.length === 0) {
			console.log("[AR] Items not spawned: no items from server");
			return;
		}

		console.log("[AR] Spawning items:", items.length);

		const scene = sceneRef.current;
		const loader = new GLTFLoader();

		// ONLY SPAWN ONE ITEM AT A TIME - find the first new item
		const newItem = items.find((item) => !itemMeshesRef.current.has(item.id));
		if (!newItem) {
			// All items already spawned, check for removal
			itemMeshesRef.current.forEach((mesh, id) => {
				const stillExists = items.some((item) => item.id === id);
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

		// Spawn only the new item
		const item = newItem;

		loader.load(
			"/models/orchid/scene.gltf",
			(gltf) => {
				const model = gltf.scene;

				let x: number, y: number, z: number;

				if (item.type === "boss") {
					// Boss: Spawn at EXACT calibrated angle and height
					// Use shorter distance for beta 85-90° (very steep angle)
					const bossDistance = 5; // Much closer to keep Y reasonable

					// CRITICAL: The camera rotation uses alphaRad directly for Y-axis rotation
					// So the boss position must be calculated with the calibrated alpha as-is
					// When camera.rotation.y = calibratedAlpha (in radians), boss should be straight ahead (on -Z axis)
					const calibratedAlphaRad =
						THREE.MathUtils.degToRad(calibratedHeading);

					// Position boss in world space so it's straight ahead when camera is at calibrated angle
					// At calibrated angle, we want boss at (0, y, -distance) in camera view
					// This means in world space: rotate (0, 0, -distance) by calibrated alpha around Y axis
					x = -Math.sin(calibratedAlphaRad) * bossDistance;
					z = -Math.cos(calibratedAlphaRad) * bossDistance;

					// Calculate Y based on calibrated beta tilt
					// Use the same ratio as regular items for consistency: Y/distance ≈ 0.933
					// This ensures boss appears at similar viewing angle as regular items
					// At beta ~85-90°, this gives the right height
					// For beta 90° (perpendicular), y/distance ≈ 0. For beta 87°, y/distance = tan(3°) ≈ 0.052
					// Boss spawns at calibrated beta (typically 87-90°)
					// Using formula: beta = atan(y/distance)
					// For beta 87° at distance 5m: y = 5 * tan(87°) ≈ 95m
					const calibratedBetaToUse = calibratedBeta ?? 90;
					y =
						bossDistance *
						Math.tan(THREE.MathUtils.degToRad(calibratedBetaToUse));

					console.log(
						`[ARScreen] Boss spawned at EXACT calibration: Compass=${calibratedHeading.toFixed(0)}° (${calibratedAlphaRad.toFixed(2)} rad), Beta=${(calibratedBeta ?? 90).toFixed(0)}° → Position (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`,
					);
				} else {
					// Regular items: spawn based on perfect ratio (X=7, Y=28, Z=30)
					// Distance = sqrt(7² + 30²) ≈ 30.8m, Height = 28m
					// This ratio gives optimal viewing angle (beta ~85°)

					// Use consistent distance matching the perfect example
					// Random position within working ranges: X(2-5), Y(25-50), Z(1-2)
					x = 2 + Math.random() * 3; // X: 2-5
					z = 1 + Math.random() * 1; // Z: 1-2
					y = 25 + Math.random() * 25; // Y: 25-50

					// Randomize alpha compass angle (360° around user)
					const randomAlphaOffset = Math.random() * Math.PI * 2; // 0-360°

					// Rotate the X,Z position around Y axis
					const tempX = x;
					const tempZ = z;
					x =
						tempX * Math.cos(randomAlphaOffset) -
						tempZ * Math.sin(randomAlphaOffset);
					z =
						tempX * Math.sin(randomAlphaOffset) +
						tempZ * Math.cos(randomAlphaOffset);

					// Calculate horizontal distance and expected beta
					const horizontalDist = Math.sqrt(x * x + z * z);
					const calculatedBeta = THREE.MathUtils.radToDeg(
						Math.atan(y / horizontalDist),
					);

					console.log(
						`[ARScreen] Item spawn: X=${x.toFixed(1)}, Y=${y.toFixed(1)}, Z=${z.toFixed(1)} | Horizontal=${horizontalDist.toFixed(1)}m | EXPECTED BETA=${calculatedBeta.toFixed(0)}° | Alpha offset=${THREE.MathUtils.radToDeg(randomAlphaOffset).toFixed(0)}°`,
					);
				}

				model.position.set(x, y, z);

				// Scale model - Boss: larger, Regular: larger
				const scale = item.type === "boss" ? 4.0 : 3.0;
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

				console.log(
					`[ARScreen] Spawned ${item.type} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`,
				);
			},
			undefined,
			(error) => {
				console.error("[ARScreen] Error loading model:", error);
			},
		);
	}, [items, calibratedHeading, calibratedBeta, animateItemRemoval]);

	// Handle tapping on items using raycasting
	const handleScreenTap = () => {
		if (!cameraRef.current || !sceneRef.current || items.length === 0) return;

		// Create raycaster from center of screen (the aim square)
		const raycaster = new THREE.Raycaster();
		const centerMouse = new THREE.Vector2(0, 0); // Center of screen
		raycaster.setFromCamera(centerMouse, cameraRef.current);

		// Get all meshes from items
		const meshes: THREE.Object3D[] = [];
		itemMeshesRef.current.forEach((mesh) => {
			meshes.push(mesh);
		});

		// Check for intersections at center (aim square)
		const intersects = raycaster.intersectObjects(meshes, true);

		if (intersects.length > 0) {
			// Find the item ID from the intersected object
			let itemId: string | null = null;
			let current = intersects[0].object;

			// Traverse up to find the item ID
			while (current && !itemId) {
				if (current.userData?.itemId) {
					itemId = current.userData.itemId;
				}
				current = current.parent as THREE.Object3D;
			}

			if (itemId) {
				console.log("[ARScreen] Item centered in aim square:", itemId);

				const mesh = itemMeshesRef.current.get(itemId);
				if (!mesh) return;

				const itemType = mesh.userData?.itemType;

				// Only animate removal for regular items, not boss
				if (itemType !== "boss") {
					// Play item tap sound
					itemTapSoundRef.current?.play();

					// Increment player tap count
					setPlayerTapCount((prev) => Math.min(prev + 1, 10));

					animateItemRemoval(mesh, () => {
						// Animation complete - item will be removed when server updates
					});
				} else {
					// Play boss hit sound
					bossTapSoundRef.current?.play();
					// Boss: Play damage animation (red flash + shake)
					const originalScale = mesh.scale.clone();
					const originalPosition = mesh.position.clone();
					const startTime = Date.now();
					const duration = 300;

					// Store original materials to restore later
					const originalMaterials = new Map<
						THREE.Mesh,
						THREE.Material | THREE.Material[]
					>();
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
								originalPosition.z + shake,
							);

							// Pulse scale
							const scaleFactor = 1 + Math.sin(progress * Math.PI * 2) * 0.15;
							mesh.scale.set(
								originalScale.x * scaleFactor,
								originalScale.y * scaleFactor,
								originalScale.z * scaleFactor,
							);
						} else {
							// Second half: restore materials
							mesh.traverse((child) => {
								if (
									child instanceof THREE.Mesh &&
									originalMaterials.has(child)
								) {
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
								if (
									child instanceof THREE.Mesh &&
									originalMaterials.has(child)
								) {
									child.material = originalMaterials.get(child)!;
								}
							});
						}
					};

					hitAnimate();
					console.log("[ARScreen] Boss hit! Damage dealt!");

					// Floating damage text
					const dmgValue = 8 + Math.floor(Math.random() * 7); // 8-14
					const id = Date.now();
					const x = 35 + Math.random() * 30; // percentage across screen
					const y = 30 + Math.random() * 30;
					setBossHits((prev: BossHit[]) => [
						...prev,
						{ id, value: dmgValue, x, y },
					]);
					setTimeout(() => {
						setBossHits((prev: BossHit[]) =>
							prev.filter((hit: BossHit) => hit.id !== id),
						);
					}, 900);
				}

				// Notify server (can tap boss multiple times)
				if (socket) {
					socket.emit("client_event", { type: "tap_item", itemId });
				}
			}
		}
	};

	const handleTapOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handleScreenTap();
		}
	};

	// Show calibration prompt when gyroscope is ready AND on slide 3 or anchoring phase
	useEffect(() => {
		const shouldShowCalibration =
			gyroReady &&
			!isAnchored &&
			!calibratedHeading &&
			(phase === "anchoring" ||
				(phase === "instructions" && currentSlide >= 3));

		if (shouldShowCalibration) {
			setShowCalibrationPrompt(true);
			setDebugInfo("Point phone at entertainer screen and tap Calibrate");
		} else {
			setShowCalibrationPrompt(false);
		}
	}, [gyroReady, isAnchored, calibratedHeading, phase, currentSlide]);

	// Handle calibration button click
	const handleCalibrate = () => {
		if (!gyroReady) return;

		// Check if phone is held upright (beta between 40-110 degrees)
		const currentBeta = orientation.beta;
		const currentHeading = orientation.alpha;

		if (currentBeta < 40 || currentBeta > 110) {
			setDebugInfo(
				`Please hold phone upright! Beta: ${currentBeta.toFixed(0)}° (need 40-110°)`,
			);
			console.warn(
				`[ARScreen] Cannot calibrate - phone not upright. Beta: ${currentBeta.toFixed(0)}°`,
			);
			return;
		}

		// Store in Zustand (not component state)
		setCalibration(currentHeading, currentBeta);
		setShowCalibrationPrompt(false);

		console.log(`[AR] Calibrated and sent anchor_success:`, {
			heading: currentHeading,
			beta: currentBeta,
		});
		setDebugInfo(`Calibrated to ${currentHeading.toFixed(0)}°`);

		// Anchor the player and send calibration data to server
		if (socket) {
			useARStore.getState().setAnchored(true);
			socket.emit("client_event", {
				type: "anchor_success",
				alpha: currentHeading,
				beta: currentBeta,
			});
		}
	};

	return (
		<div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
			{/* Instructions waiting screen */}
			{phase === "instructions" && (
				<div
					className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900"
					style={{ zIndex: 100 }}
				>
					<div className="bg-black/70 backdrop-blur-sm text-white px-12 py-8 rounded-2xl text-center max-w-lg border-2 border-white/30">
						<h2 className="text-4xl font-bold mb-4">
							📺 AR Dressing Room Challenge
						</h2>
						<p className="text-2xl mb-2">
							Please look at the entertainer screen
						</p>
						<p className="text-xl opacity-80">
							Follow the instructions on the main screen
						</p>
					</div>
				</div>
			)}

			{/* Video feed background */}
			{phase !== "results" && phase !== "instructions" && (
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted
					className="absolute inset-0 w-full h-full object-cover"
					style={{ zIndex: 1 }}
				/>
			)}

			{/* Three.js canvas overlay */}
			{phase !== "results" && phase !== "instructions" && (
				<canvas
					ref={canvasRef}
					className="absolute inset-0 w-full h-full pointer-events-none"
					style={{ zIndex: 10 }}
				/>
			)}

			{/* Tap detection overlay */}
			{phase !== "results" && phase !== "instructions" && (
				<div
					className="absolute inset-0 w-full h-full"
					style={{ zIndex: 20 }}
					onClick={handleScreenTap}
					onTouchStart={handleScreenTap}
					onKeyDown={handleTapOverlayKeyDown}
					role="button"
					tabIndex={0}
					aria-label="Tap to attack"
				/>
			)}

			{/* Boss damage overlays */}
			{phase !== "results" &&
				bossHits.map((hit) => (
					<div
						key={hit.id}
						className="absolute text-4xl font-extrabold text-red-400 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] animate-[floatUp_0.9s_ease-out_forwards] pointer-events-none select-none"
						style={{
							left: `${hit.x}%`,
							top: `${hit.y}%`,
							zIndex: 25,
						}}
					>
						-{hit.value}
					</div>
				))}

			{/* DEBUG: Show actual rendered item count */}
			{(phase === "hunting" || phase === "boss" || phase === "anchoring") && (
				<div
					className="absolute top-4 right-4 bg-black/90 text-white p-3 rounded-lg font-mono text-xs leading-relaxed"
					style={{ zIndex: 100 }}
				>
					<div className="font-bold mb-2 text-yellow-400">🔍 DEBUG</div>
					<div>Store items: {items.length}</div>
					<div className="font-bold text-green-400">
						RENDERED: {itemMeshesRef.current.size}
					</div>
					<div>Scene: {sceneRef.current ? "✅" : "❌"}</div>
					<div>
						Calibrated:{" "}
						{calibratedHeading !== null && calibratedBeta !== null
							? "✅"
							: "❌"}
					</div>
					{calibratedHeading !== null && (
						<div className="text-[10px] mt-1 opacity-80">
							H:{calibratedHeading.toFixed(0)}° B:{calibratedBeta?.toFixed(0)}
							°
						</div>
					)}
				</div>
			)}

			{/* Item Counter - Top of screen */}
			{gyroReady &&
				phase === "hunting" &&
				!items.some((item) => item.type === "boss") && (
					<div
						className="absolute top-6 left-1/2 transform -translate-x-1/2 pointer-events-none"
						style={{ zIndex: 30 }}
					>
						<div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-white/50">
							<p className="text-white text-2xl font-bold">
								{playerTapCount}/10
							</p>
						</div>
					</div>
				)}

			{/* Aim Square - Center targeting reticle */}
			{gyroReady && phase === "hunting" && (
				<div
					className="absolute pointer-events-none"
					style={{
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						zIndex: 30,
					}}
				>
					{/* Aim square box */}
					<div className="relative w-32 h-32 border-4 border-white/80 rounded-lg">
						{/* Corner accents */}
						<div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-400" />
						<div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-400" />
						<div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-400" />
						<div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-400" />

						{/* Center dot */}
						<div className="absolute top-1/2 left-1/2 w-2 h-2 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
					</div>

					{/* Instruction text below aim square */}
					<p className="text-white text-sm font-semibold text-center mt-4 drop-shadow-lg">
						Center item to tap
					</p>
				</div>
			)}

			{/* UI Overlays - only show when NOT in instructions phase OR when camera not ready (allow camera permission during instructions) */}
			{(phase !== "instructions" || !cameraReady) && (
				<div
					className="flex flex-col items-center justify-center pointer-events-none"
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						width: "100vw",
						height: "100vh",
						zIndex: 9999,
					}}
				>
					{!cameraReady && (
						<div className="bg-black/70 text-white px-8 py-6 rounded-xl text-center max-w-md">
							<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
							<h2 className="text-3xl font-bold mb-3">Starting Camera...</h2>
							<p className="text-xl">Please allow camera access</p>
						</div>
					)}

					{cameraReady &&
						!gyroReady &&
						typeof (DeviceOrientationEvent as any).requestPermission ===
							"function" && (
							<div className="bg-black/70 text-white px-8 py-6 rounded-xl text-center max-w-md pointer-events-auto">
								<h2 className="text-3xl font-bold mb-3">
									Enable Motion Sensors
								</h2>
								<p className="text-xl mb-6">Tap to allow gyroscope access</p>
								<button
									type="button"
									className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl"
									onClick={() => (window as any).requestGyroPermission()}
								>
									Enable Gyroscope
								</button>
							</div>
						)}

					{!isAnchored && showCalibrationPrompt && (
						<div className="bg-black/80 text-white px-8 py-6 rounded-xl text-center max-w-md pointer-events-auto">
							<h2 className="text-3xl font-bold mb-3">
								📍 Calibrate Direction
							</h2>
							<p className="text-xl mb-4">
								Point your phone at the entertainer screen
							</p>
							<p className="text-base mb-6 opacity-80">
								This helps position items correctly
							</p>
							<button
								type="button"
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
							{items.some((item) => item.type === "boss") ? (
								<>
									<p className="text-2xl font-bold text-red-400">
										🔥 BOSS APPEARED!
									</p>
									<p className="text-lg mt-2">
										Point toward entertainer screen!
									</p>
									<p className="text-sm mt-1">Everyone must attack together!</p>
								</>
							) : (
								<>
									<p className="text-2xl font-bold">Rotate to find items!</p>
									<p className="text-lg mt-2">
										Tap directly on any item you see
									</p>
								</>
							)}
						</div>
					)}
					{phase === "results" && (
						<div className="bg-black/70 text-white px-6 py-4 rounded-xl text-center">
							<p className="text-2xl font-bold text-red-400">
								👑 BOSS DEFEATED 👑!
							</p>
							<p className="text-lg mt-2">Point toward entertainer screen!</p>
							<p className="text-sm mt-1">Everyone must attack together!</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
