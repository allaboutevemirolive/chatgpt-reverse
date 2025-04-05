// src/service/markdownExporter.ts

import { ChatGptApiClient } from "./ChatGptApiClient";

/**
 * Fetches a conversation and formats it as Markdown content.
 * This function is intended to be called from the Service Worker.
 * @param conversationId - The ID of the conversation to export.
 * @returns A promise resolving to an object containing the markdown content, creation time, and title.
 */
export async function exportConversationAsMarkdown(
    conversationId: string,
): Promise<{ markdownContent: string; createTime: number; title: string }> {
    try {
        // Get the ChatGptApiClient instance (initialized in the Service Worker)
        const apiClient = ChatGptApiClient.getInstance();
        const response = await apiClient.getConversation(conversationId);

        console.log(
            "Service Worker: Conversation fetched successfully for Markdown export:",
            conversationId,
        );

        // Rest of the function remains the same...
        const { title, mapping, create_time, update_time } = response;

        if (!mapping || typeof mapping !== "object") {
            throw new Error(
                "Invalid conversation data received: 'mapping' is missing or not an object.",
            );
        }
        if (
            typeof title !== "string" ||
            typeof create_time !== "number" ||
            typeof update_time !== "number"
        ) {
            console.warn(
                "Service Worker: Conversation data might be missing title or timestamps.",
                { title, create_time, update_time },
            );
            // Proceed anyway, but log the warning
        }

        const markdownContent = generateMarkdown(
            title || "Untitled Conversation",
            mapping,
            create_time || 0,
            update_time || 0,
        );

        // Return the content and necessary metadata for the content script
        return {
            markdownContent,
            createTime: create_time || Date.now() / 1000, // Provide fallback createTime
            title: title || "Untitled Conversation", // Provide fallback title
        };
    } catch (error) {
        console.error(
            `Service Worker: Failed to fetch/format conversation ${conversationId} for Markdown:`,
            error,
        );
        // Re-throw the error so the calling function in the SW can handle it
        throw error;
    }
}

// --- Helper Functions ---
// (generateMarkdown, capitalizeFirstLetter, generateMarkdownFileName remain unchanged)

/**
 * Generates the Markdown string from conversation data.
 */
function generateMarkdown(
    title: string,
    mapping: Record<string, any>,
    create_time: number,
    update_time: number,
): string {
    const createTimeISO = new Date(create_time * 1000)
        .toISOString()
        .split("T")[0];
    const updateTimeISO = new Date(update_time * 1000)
        .toISOString()
        .split("T")[0];
    const participants = new Set<string>();

    const sortedNodes = Object.values(mapping)
        .filter((node) => node.message && node.message?.create_time)
        .sort(
            (a, b) =>
                (a.message.create_time || 0) - (b.message.create_time || 0),
        );

    const nodesWithoutTime = Object.values(mapping).filter(
        (node) => node.message && !node.message?.create_time,
    );

    const messageMarkdown = [...sortedNodes, ...nodesWithoutTime]
        .filter(
            (node) => node.message && node.message.author?.role !== "system",
        )
        .map(({ message }: any) => {
            const role = message.author?.role
                ? capitalizeFirstLetter(message.author.role)
                : "Unknown";
            participants.add(role);
            const content =
                message.content?.parts?.join("\n") || "[No Content]";
            const messageCreateTime = message.create_time
                ? new Date(message.create_time * 1000)
                : new Date();
            const timeStr = messageCreateTime.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });

            const formattedContent = content
                .split("```")
                .map((part: string, index: number) => {
                    if (index % 2 === 0) {
                        return part.trim();
                    } else {
                        const lines = part.split("\n");
                        const language = lines[0].trim();
                        const code = lines.slice(1).join("\n");
                        return "```" + language + "\n" + code.trim() + "\n```";
                    }
                })
                .filter((part: string) => part.length > 0)
                .join("\n\n");

            return [
                `### ${role} (${timeStr})`,
                "",
                formattedContent,
                "",
                "---",
                "",
            ].join("\n");
        })
        .join("");

    const messageCount = Object.values(mapping).filter(
        (node) => node.message,
    ).length;

    const metadata = [
        `# ${title}`,
        "",
        "## Conversation Summary",
        "",
        `**Create Time:** ${createTimeISO}`,
        `**Update Time:** ${updateTimeISO}`,
        `**Total Messages:** ${messageCount}`,
        `**Participants:** ${Array.from(participants).join(", ")}`,
        "",
        "---",
        "",
    ].join("\n");

    const footer = [
        "",
        "---",
        "",
        "## End of Conversation",
        "",
        "_This conversation export was generated by the Chrome Extension._",
        `_Generated on: ${new Date().toLocaleString()}_`,
    ].join("\n");

    return metadata + messageMarkdown + footer;
}

/**
 * Capitalizes the first letter of a string.
 */
function capitalizeFirstLetter(text: string): string {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Generates a filename for the Markdown export based on creation time.
 * This function is intended to be called by the Content Script or popup.
 * @param create_time - The conversation creation timestamp (in seconds).
 * @param title - Optional title to include in the filename.
 * @returns A formatted filename string.
 */
export function generateMarkdownFileName(
    create_time: number,
    title?: string,
): string {
    const date = new Date(create_time * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    // Sanitize title part if provided
    const sanitizedTitle = title
        ? title
            .replace(/[/\\?%*:|"<>]/g, "-") // Remove illegal characters
            .replace(/\s+/g, "_") // Replace spaces with underscores
            .substring(0, 50) // Limit length
            .replace(/_+$/, "") // Remove trailing underscores
        : "";

    const datePart = `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
    const baseName =
        sanitizedTitle && sanitizedTitle.length > 0
            ? `chatgpt_${sanitizedTitle}_${datePart}`
            : `chatgpt_conv_${datePart}`;

    return `${baseName}.md`;
}
