import { encoding_for_model, TiktokenModel } from "tiktoken";
import { fetchConversationMessages } from "./conversationUtils";

interface TokenCount {
    totalTokens: number;
    messageTokens: { messageId: string; tokens: number }[];
}

export async function countConversationTokens(
    conversationId: string,
    model: TiktokenModel = "gpt-3.5-turbo",
): Promise<TokenCount> {
    // Fetch messages first
    const messages = await fetchConversationMessages(conversationId);

    // Get the appropriate encoding for the model
    const encoder = encoding_for_model(model);

    const messageTokens = messages.map((message) => {
        // Combine all parts into a single string
        const text = message.parts.join(" ");

        // Count tokens for the message content
        const tokens = encoder.encode(text).length;

        // Add tokens for message metadata (role, etc.)
        // Adding 4 tokens: 2 for role, 2 for message markers
        const totalTokens = tokens + 4;

        return {
            messageId: message.id,
            tokens: totalTokens,
        };
    });

    // Calculate total tokens
    const totalTokens = messageTokens.reduce(
        (sum, message) => sum + message.tokens,
        0,
    );

    // Free the encoder to prevent memory leaks
    encoder.free();

    return {
        totalTokens,
        messageTokens,
    };
}

// Usage example:
/*
const tokenCount = await countConversationTokens(
    "conversation-id",
    "gpt-3.5-turbo"
);

console.log(`Total tokens: ${tokenCount.totalTokens}`);
console.log("Per message breakdown:", tokenCount.messageTokens);
*/
