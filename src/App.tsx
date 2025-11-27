import { useServerSync } from "./lib/hooks/useServerSync";
import { useServerStore } from "./lib/stores/useServerStore";
import JoinScreen from "./screens/JoinScreen";
import LobbyScreen from "./screens/LobbyScreen";
import TapBeatsScreen from "./screens/TapBeatsScreen";
import ClientARScreen from "./screens/ClientARScreen";

function App() {
	// 1) React state: we remember the current nickname
	const { connected, currentActivity } = useServerStore();
	useServerSync();

	return (
		<>
			{!connected && <JoinScreen />}
			{connected && currentActivity === "lobby" && <LobbyScreen />}
			{connected && currentActivity === "beats" && <TapBeatsScreen />}
			{connected && currentActivity === "ar" && <ClientARScreen />}
		</>
	);
}

export default App;
