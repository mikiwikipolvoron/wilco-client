import type {
	ActivityId,
	GroupDefinitions,
	Player,
	ServerState,
} from "wilco-msgs";
import { create } from "zustand";

interface ServerStore extends ServerState {
	currentActivity: ActivityId;
	players: Record<string, Player>;
	groups?: GroupDefinitions;
    connected: boolean;

    _handlePlayerJoined: (player: Player) => void;
    _handlePlayerLeft: (playerId: string) => void;
    _handleActivityStarted: (activity: ActivityId) => void;
    _handleGroupsUpdated: (groups: GroupDefinitions) => void;
    _setConnected: (connected: boolean) => void;
}

const initialState = {
    currentActivity: "lobby" as ActivityId,
    players: {},
    groups: undefined,
    connected: false,
    lastReaction: undefined,
};

export const useServerStore = create<ServerStore>((set) => ({
    ...initialState,
    
    _handlePlayerJoined: (player) => set((state) => ({
        players: { ...state.players, [player.id]: player },
    })),

    _handlePlayerLeft: (playerId) => set((state) => {
        const { [playerId]: _removed, ...players } = state.players;
        return { players };
    }),

    _handleActivityStarted: (activity) => set({ currentActivity: activity }),

    _handleGroupsUpdated: (groups) => set({ groups }),
    
    _setConnected: (connected) => set({ connected }),
}))
