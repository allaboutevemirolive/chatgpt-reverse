export const MarkdownExport = {
    name: "MarkdownExport",
    icon: "📝",
    label: "Export to Markdown",
} as const;
export const AudioCapture = {
    name: "AudioCapture",
    icon: "🔊",
    label: "Capture Audio",
} as const;
export const ConversationCleanup = {
    name: "ConversationCleanup",
    icon: "🗑",
    label: "Clean Conversations",
} as const;
export const Advances = {
    name: "Advances",
    icon: "⚙",
    label: "Advances",
} as const;

export const tabsConfig = [
    MarkdownExport,
    AudioCapture,
    ConversationCleanup,
    Advances,
] as const;

export type TabName = (typeof tabsConfig)[number]["name"];
