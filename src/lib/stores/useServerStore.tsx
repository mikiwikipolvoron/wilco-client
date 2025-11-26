import type {
	ActivityId,
	GroupDefinitions,
	Player,
	ServerState,
} from "@wilco/shared/data";
import { create } from "zustand";

interface ServerStore extends ServerState {
	currentActivity: ActivityId;
	players: Record<string, Player>;
	groups?: GroupDefinitions;
    connected: boolean;

    // UI-side state
    nickname?: string;

    _handlePlayerJoined: (player: Player) => void;
    _handlePlayerLeft: (playerId: string) => void;
    _handleActivityStarted: (activity: ActivityId) => void;
    _handleGroupsUpdated: (groups: GroupDefinitions) => void;
    _setConnected: (connected: boolean) => void;
    setNickname: (nickname: string) => void;
}

const initialState = {
    currentActivity: "lobby" as ActivityId,
    players: {},
    groups: undefined,
    connected: false,
    lastReaction: undefined,
    nickname: undefined,
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

    setNickname: (nickname) => set({nickname: nickname}),
}))
