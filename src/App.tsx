import { useState } from "react";
import { emitClientEvent } from "./lib/socket";

function App() {
	// 1) React state: we remember the current nickname
	const [nickname, setNickname] = useState("");
	const [hasJoined, setHasJoined] = useState(false);
	const [hearts, setHearts] = useState(0);
	const [praying, setPraying] = useState(0);
	const [dolphin, setDolphin] = useState(0);
	const [floatingEmojis, setFloatingEmojis] = useState<
		{ id: number; emoji: string; x: number; y: number; drift: number }[]
	>([]);

	// 2) This function will run when the form is submitted
	function handleJoin(event: React.FormEvent) {
		event.preventDefault(); // stop the page from reloading
		console.log("Joining as:", nickname);
		alert(`Joining as: ${nickname}`); // temporary feedback
		setHasJoined(true);
	}

	function spawnFloatingEmoji(
		emoji: string,
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
	) {
		const rect = event.currentTarget.getBoundingClientRect();

		setFloatingEmojis((prev) => [
			...prev,
			{
				id: Date.now() + Math.random(),
				emoji,
				x: rect.left + rect.width / 2,
				y: rect.top,
				drift: (Math.random() - 0.5) * 40, // random gentle drift: -20px to +20px
			},
		]);
	}

	return (
		<div
			className={`min-h-screen w-full flex flex-col align-middle items-center justify-center ${hasJoined ? "justify-start pt-40%" : "justify-center pt-0"} pl-4 pr-4 overflow-y-auto overflow-x-hidden font-sans box-border`}
		>
			<div style={{ textAlign: "center", width: "100%", maxWidth: "600px" }}>
				{hasJoined ? (
					<>
						<h1 style={{ marginTop: "1rem" }}>Welcome, {nickname}!</h1>
						<p style={{ fontSize: "1.25rem", marginTop: "0.5rem" }}>
							Please look at the entertainer screen for instructions.
						</p>

						<div
							style={{
								display: "flex",
								flexDirection: "row",
								flexWrap: "nowrap",
								justifyContent: "center",
								alignItems: "center",
								gap: "1rem",
								marginTop: "1.5rem",
								position: "relative",
								width: "100%",
							}}
						>
							{/* 💖 */}
							<div style={{ padding: "0.5rem" }}>
								<button
									type="button"
									onClick={(event) => {
										setHearts(hearts + 1);
										spawnFloatingEmoji("💖", event);

										emitClientEvent({
											type: "tap_reaction",
											emoji: "💖",
										});
									}}
									style={{
										fontSize: "3rem",
										background: "transparent",
										border: "none",
										padding: 0,
										margin: 0,
										lineHeight: 1,
										cursor: "pointer",
										outline: "none",
										WebkitTapHighlightColor: "transparent",
									}}
								>
									💖
								</button>
							</div>

							{/* 🐬 */}
							<div style={{ padding: "0.5rem" }}>
								<button
									type="button"
									onClick={(event) => {
										setDolphin(dolphin + 1);
										spawnFloatingEmoji("🐬", event);

										emitClientEvent({
											type: "tap_reaction",
											emoji: "🐬",
										});
									}}
									style={{
										fontSize: "3rem",
										background: "transparent",
										border: "none",
										padding: 0,
										margin: 0,
										lineHeight: 1,
										cursor: "pointer",
										outline: "none",
										WebkitTapHighlightColor: "transparent",
									}}
								>
									🐬
								</button>
							</div>

							{/* 🙏 */}
							<div style={{ padding: "0.5rem" }}>
								<button
									type="button"
									onClick={(event) => {
										setPraying(praying + 1);
										spawnFloatingEmoji("🙏", event);

										emitClientEvent({
											type: "tap_reaction",
											emoji: "🙏",
										});
									}}
									style={{
										fontSize: "3rem",
										background: "transparent",
										border: "none",
										padding: 0,
										margin: 0,
										lineHeight: 1,
										cursor: "pointer",
										outline: "none",
										WebkitTapHighlightColor: "transparent",
									}}
								>
									🙏
								</button>
							</div>
						</div>
					</>
				) : (
					<>
						<h1>Join WILCO</h1>
						<p style={{ fontSize: "16px", marginTop: "0.5rem" }}>
							Enter a nickname to join the pre-concert experience.
						</p>

						<form onSubmit={handleJoin}>
							<input
								type="text"
								placeholder="Your nickname"
								value={nickname}
								onChange={(event) => setNickname(event.target.value)}
								style={{
									padding: "0.5rem",
									fontSize: "16px",
									minWidth: "200px",
								}}
							/>
							<div style={{ marginTop: "1rem" }}>
								<button
									type="submit"
									disabled={nickname.trim().length === 0}
									style={{
										padding: "0.5rem 1rem",
										fontSize: "16px",
										cursor: "pointer",
									}}
								>
									Join
								</button>
							</div>
						</form>
					</>
				)}
			</div>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					pointerEvents: "none",
					overflow: "hidden",
				}}
			>
				{floatingEmojis.map((item) => (
					<div
						key={item.id}
						style={{
							position: "absolute",
							left: item.x + item.drift,
							top: item.y,
							fontSize: "2.5rem",
							animation: "floatUp 1.5s ease-out forwards",
							pointerEvents: "none",
						}}
					>
						{item.emoji}
					</div>
				))}
			</div>
		</div>
	);
}

export default App;
