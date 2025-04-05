// ./packages/shared/src/index.ts
export * from "./theme";

export type MessageType = "GREETING" | "FAREWELL";

export interface MessagePayload {
    type: MessageType;
    text: string;
}

export function createGreeting(name: string): MessagePayload {
    return { type: "GREETING", text: `Hello, ${name}!` };
}

export const VERSION = "1.0.0";
