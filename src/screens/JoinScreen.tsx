import { useClientActions } from "../lib/controllers/useClientActions";
import { useServerStore } from "../lib/stores/useServerStore";
import { useSocketStore } from "../lib/stores/useSocketStore";

function JoinScreen() {
	// 1) React state: we remember the current nickname
	const { nickname, setNickname } = useServerStore();
	const socket = useSocketStore();
	const act = useClientActions();

	// 2) This function will run when the form is submitted
	function handleJoin(event: React.FormEvent) {
		if (!nickname) return;
		event.preventDefault();
		socket.connect();
		act.register(nickname);
		console.log("Joining as:", nickname);
	}

	return (
		<div
			className={`min-h-screen w-full flex flex-col align-middle items-center justify-center pt-0 pl-4 pr-4 overflow-y-auto overflow-x-hidden font-sans box-border`}
		>
			<div style={{ textAlign: "center", width: "100%", maxWidth: "600px" }}>
				<h1>Join WILCO</h1>
				<p className="text-base mt-2">
					Enter a nickname to join the pre-concert experience.
				</p>

				<form onSubmit={handleJoin}>
					<input
						type="text"
						placeholder="Your nickname"
						value={nickname || ""}
						onChange={(event) => setNickname(event.target.value)}
						className="text-base p-2 min-w-[200px]"
					/>
					<div style={{ marginTop: "1rem" }}>
						<button
							type="submit"
							disabled={!nickname || nickname.trim().length === 0}
							className="pt-2 pb-2 pr-4 pl-4 text-base cursor-pointer"
						>
							Join
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default JoinScreen;
