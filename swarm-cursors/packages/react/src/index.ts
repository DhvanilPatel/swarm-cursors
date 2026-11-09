import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createSwarm, type Swarm, type SwarmEventMap, type SwarmEventName, type SwarmOptions } from "swarm-cursors";
import type { SwarmListener } from "swarm-cursors";

const SwarmContext = createContext<Swarm | null>(null);
const SwarmProviderContext = createContext(false);

export interface SwarmProviderProps {
  options?: SwarmOptions;
  children?: ReactNode;
}

export interface SwarmRebuildProps {
  options?: SwarmOptions;
  children?: ReactNode;
}

export function SwarmProvider({ options, children }: SwarmProviderProps) {
  const [swarm, setSwarm] = useState<Swarm | null>(null);

  useEffect(() => {
    const instance = createSwarm(options);
    setSwarm(instance);
    if (options?.animation?.autoplay !== false) instance.start();
    return () => {
      instance.destroy();
    };
  }, [options]);

  return createElement(
    SwarmProviderContext.Provider,
    { value: true },
    createElement(SwarmContext.Provider, { value: swarm }, children),
  );
}

export function SwarmRebuild({ options, children }: SwarmRebuildProps) {
  const parentSwarm = useContext(SwarmContext);
  const insideProvider = useContext(SwarmProviderContext);
  const [localSwarm, setLocalSwarm] = useState<Swarm | null>(null);

  useEffect(() => {
    if (parentSwarm || insideProvider) return;
    const instance = createSwarm(options);
    setLocalSwarm(instance);
    if (options?.animation?.autoplay !== false) instance.start();
    return () => {
      instance.destroy();
    };
  }, [options, parentSwarm, insideProvider]);

  return createElement(
    SwarmProviderContext.Provider,
    { value: true },
    createElement(SwarmContext.Provider, { value: parentSwarm || localSwarm }, children ?? null),
  );
}

export function useSwarm(): Swarm | null {
  return useContext(SwarmContext);
}

export type SwarmEventHandlers = {
  [T in SwarmEventName]?: SwarmListener<T>;
};

export function useSwarmEvents(swarm: Swarm | null, handlers: SwarmEventHandlers): void {
  useEffect(() => {
    if (!swarm) return;
    const unsubscribers = (Object.keys(handlers) as SwarmEventName[]).map((name) => {
      const listener = handlers[name] as SwarmListener<typeof name> | undefined;
      return listener ? swarm.on(name, listener as (event: SwarmEventMap[typeof name]) => void) : () => {};
    });
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [swarm, handlers]);
}
