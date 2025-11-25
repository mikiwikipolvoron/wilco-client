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
                        <h1 className="mt-4">Welcome, {nickname}!</h1>
						<p className="text-xl mt-2">
							Please look at the entertainer screen for instructions.
						</p>

						<div
                            className="flex flex-row flex-nowrap justify-center items-center align-middle gap-4 mt-6 relative w-full"
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
                                    className="text-5xl bg-transparent border-none p-0 m-0 cursor-pointer outline-none"
									style={{
										lineHeight: 1,
										WebkitTapHighlightColor: "transparent",
									}}
								>
									💖
								</button>
							</div>

							{/* 🐬 */}
							<div className="p-2">
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
                                    className="text-5xl bg-transparent border-none p-0 m-0 cursor-pointer outline-none"
									style={{
										lineHeight: 1,
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
                                    className="text-5xl bg-transparent border-none p-0 m-0 cursor-pointer outline-none"
									style={{
										lineHeight: 1,
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
						<p className="text-base mt-2">
							Enter a nickname to join the pre-concert experience.
						</p>

						<form onSubmit={handleJoin}>
							<input
								type="text"
								placeholder="Your nickname"
								value={nickname}
								onChange={(event) => setNickname(event.target.value)}
                                className="text-base p-2 min-w-[200px]"
							/>
							<div style={{ marginTop: "1rem" }}>
								<button
									type="submit"
									disabled={nickname.trim().length === 0}
                                    className="pt-2 pb-2 pr-4 pl-4 text-base cursor-pointer"
								>
									Join
								</button>
							</div>
						</form>
					</>
				)}
			</div>
			<div
                className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"
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
