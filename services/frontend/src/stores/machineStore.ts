import { useSyncExternalStore, useRef, useCallback } from "react";
import type {
  MachineState,
  MachineAction,
  Machine,
} from "../types/machine";

// Initial state
const initialState: MachineState = {
  machines: {},
  machineOrder: [],
};

// Reducer
function machineReducer(state: MachineState, action: MachineAction): MachineState {
  switch (action.type) {
    case "MACHINES_LOADED": {
      const loaded: Record<number, Machine> = {};
      for (const m of action.machines) {
        loaded[m.id] = m;
      }
      return {
        ...state,
        machines: loaded,
        machineOrder: action.machines.map((m) => m.id),
      };
    }

    case "MACHINE_ADDED":
      return {
        ...state,
        machines: { ...state.machines, [action.machine.id]: action.machine },
        machineOrder: state.machineOrder.includes(action.machine.id)
          ? state.machineOrder
          : [...state.machineOrder, action.machine.id],
      };

    case "MACHINE_UPDATED":
      return {
        ...state,
        machines: { ...state.machines, [action.machine.id]: action.machine },
      };

    case "MACHINE_REMOVED": {
      const { [action.machineId]: _removed, ...rest } = state.machines;
      return {
        ...state,
        machines: rest,
        machineOrder: state.machineOrder.filter((id) => id !== action.machineId),
      };
    }

    case "MACHINE_STATUS_CHANGED": {
      const existing = state.machines[action.machineId];
      if (!existing) return state;
      return {
        ...state,
        machines: {
          ...state.machines,
          [action.machineId]: {
            ...existing,
            status: action.status,
            ...(action.lastHealth !== undefined ? { last_health: action.lastHealth } : {}),
            ...(action.status === "online" ? { last_seen_at: new Date().toISOString() } : {}),
          },
        },
      };
    }

    case "MACHINE_HEALTH_UPDATED": {
      const existing = state.machines[action.machineId];
      if (!existing) return state;
      return {
        ...state,
        machines: {
          ...state.machines,
          [action.machineId]: {
            ...existing,
            last_health: action.health,
            last_seen_at: new Date().toISOString(),
          },
        },
      };
    }

    default:
      return state;
  }
}

// Store implementation
type Listener = () => void;

class MachineStore {
  private state: MachineState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = initialState;
  }

  getState = (): MachineState => {
    return this.state;
  };

  dispatch = (action: MachineAction): void => {
    this.state = machineReducer(this.state, action);
    this.listeners.forEach((l) => l());
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

// Singleton store
export const machineStore = new MachineStore();

// Hook: use a selected slice of state (prevents unnecessary re-renders)
export function useMachineSelector<T>(selector: (state: MachineState) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cachedRef = useRef<{ value: T; stateRef: MachineState } | null>(null);

  const getSnapshot = useCallback(() => {
    const currentState = machineStore.getState();
    if (cachedRef.current && cachedRef.current.stateRef === currentState) {
      return cachedRef.current.value;
    }
    const value = selectorRef.current(currentState);
    cachedRef.current = { value, stateRef: currentState };
    return value;
  }, []);

  return useSyncExternalStore(machineStore.subscribe, getSnapshot);
}

// Hook: get dispatch function
export function useMachineDispatch() {
  return machineStore.dispatch;
}

// Convenience selectors
export function useMachines(): Machine[] {
  return useMachineSelector((s) =>
    s.machineOrder.map((id) => s.machines[id]).filter(Boolean)
  );
}

export function useMachine(id: number | null): Machine | null {
  return useMachineSelector((s) =>
    id !== null ? s.machines[id] ?? null : null
  );
}

export function useOnlineMachines(): Machine[] {
  return useMachineSelector((s) =>
    s.machineOrder
      .map((id) => s.machines[id])
      .filter((m) => m && m.status === "online")
  );
}

export function useMachineStats(): { online: number; offline: number; pairing: number; total: number } {
  return useMachineSelector((s) => {
    let online = 0;
    let offline = 0;
    let pairing = 0;
    for (const id of s.machineOrder) {
      const m = s.machines[id];
      if (!m) continue;
      if (m.status === "online") online++;
      else if (m.status === "pairing") pairing++;
      else offline++;
    }
    return { online, offline, pairing, total: s.machineOrder.length };
  });
}
