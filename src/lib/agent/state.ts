import { EventEmitter } from "events";

// Global event emitter for SSE streaming (typing, refresh events)
export const agentEvents = new EventEmitter();

// In-memory map of active runs and their AbortControllers
export const runControllers = new Map<number, AbortController>();
