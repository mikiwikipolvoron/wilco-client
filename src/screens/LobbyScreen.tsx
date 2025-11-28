import { EmojiPicker } from "frimousse";
import { useState } from "react";
import { useServerStore } from "../lib/stores/useServerStore";
import { useSocketStore } from "../lib/stores/useSocketStore";

function LobbyScreen() {
	const { nickname } = useServerStore();
	const { emit } = useSocketStore();
	const [hearts, setHearts] = useState(0);
	const [praying, setPraying] = useState(0);
	const [dolphin, setDolphin] = useState(0);
	const [floatingEmojis, setFloatingEmojis] = useState<
		{ id: number; emoji: string; x: number; y: number; drift: number }[]
	>([]);

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
			className={`min-h-screen w-full flex flex-col align-middle items-center justify-center pt-0 pl-4 pr-4 overflow-y-auto overflow-x-hidden font-sans box-border`}
		>
			<div style={{ textAlign: "center", width: "100%", maxWidth: "600px" }}>
				<h1 className="mt-4">More activities in a few moments!</h1>
				<h2 className="mt-4">
					Show the crowd how you like the games, {nickname}!
				</h2>
				<div className="flex flex-row flex-nowrap justify-center items-center align-middle gap-4 mt-6 relative w-full">
					{/* 💖 */}
					<div style={{ padding: "0.5rem" }}>
						<button
							type="button"
							onClick={(event) => {
								setHearts(hearts + 1);
								spawnFloatingEmoji("💖", event);

								emit({
									type: "reaction",
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

								emit({
									type: "reaction",
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

								emit({
									type: "reaction",
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
			</div>
			<div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
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

export default LobbyScreen;
