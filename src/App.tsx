import { useServerSync } from "./lib/hooks/useServerSync";
import { useServerStore } from "./lib/stores/useServerStore";
import ClientARScreen from "./screens/ClientARScreen";
import JoinScreen from "./screens/JoinScreen";
import LobbyScreen from "./screens/LobbyScreen";
import StartScreen from "./screens/StartScreen";
import TapBeatsScreen from "./screens/TapBeatsScreen";

function App() {
	// 1) React state: we remember the current nickname
	const { connected, currentActivity } = useServerStore();
	useServerSync();

	return (
		<>
			{!connected && <JoinScreen />}
			{connected && currentActivity === "start" && <StartScreen />}
			{connected && currentActivity === "lobby" && <LobbyScreen />}
			{connected && currentActivity === "beats" && <TapBeatsScreen />}
			{connected && currentActivity === "ar" && <ClientARScreen />}
		</>
	);
}

export default App;
