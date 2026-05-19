/// <reference types="vite/client" />

interface RageMpBridge {
  trigger(eventName: string, ...args: unknown[]): void;
}

interface Window {
  mp?: RageMpBridge;
}
