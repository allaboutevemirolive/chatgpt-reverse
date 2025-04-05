// packages/service-worker/src/service/conversationUtils.ts
import { fetchConversation } from "@/service/chatGptUtils";

interface ConversationNode {
    message?: {
        id: string;
        author: {
            role: string;
        };
        content: {
            parts: string[];
            model_set_context?: string | null;
        };
    };
}

// interface ConversationResponse {
//     mapping: Record<string, ConversationNode>;
// }

interface AuthorCounts {
    user: number;
    assistant: number;
}

interface ContextInfo {
    id: string;
    role: string;
    model_set_context: string | null;
}

interface ConversationMessageIds {
    id: string;
    author: string;
}

interface MessageInfo {
    id: string;
    role: string;
    parts: string[];
}

// Generic type for message transformation
type MessageTransformer<T> = (
    message: NonNullable<ConversationNode["message"]>,
) => T;

// Predicate types for different message filtering scenarios
const isStandardMessage = (
    message: NonNullable<ConversationNode["message"]>,
): boolean =>
    Boolean(
        message.id &&
        message.author?.role &&
        message.content?.parts &&
        ["user", "assistant"].includes(message.author.role),
    );

const isContextMessage = (
    message: NonNullable<ConversationNode["message"]>,
): boolean =>
    Boolean(
        message.id &&
        message.author &&
        message.content?.model_set_context !== undefined,
    );

const isAuthorCountableMessage = (
    message: NonNullable<ConversationNode["message"]>,
): boolean =>
    Boolean(
        message.author?.role &&
        ["user", "assistant"].includes(message.author.role),
    );

// Generic conversation fetcher
async function fetchConversationData<T>(
    conversationId: string,
    transformer: MessageTransformer<T>,
    filterPredicate: (
        message: NonNullable<ConversationNode["message"]>,
    ) => boolean,
): Promise<T[]> {
    try {
        const response = await fetchConversation(conversationId);
        console.log("Conversation fetched successfully:", response);

        const messages: T[] = [];

        if (response?.mapping) {
            for (const key in response.mapping) {
                const node = response.mapping[key];
                if (node.message && filterPredicate(node.message)) {
                    messages.push(transformer(node.message));
                }
            }
        }

        return messages;
    } catch (error) {
        console.error("Failed to fetch conversation:", error);
        throw error;
    }
}

// Specific transformers for different use cases
const messageIdsTransformer: MessageTransformer<ConversationMessageIds> = (
    message,
) => ({
    id: message.id,
    author: message.author.role,
});

const messageInfoTransformer: MessageTransformer<MessageInfo> = (message) => ({
    id: message.id,
    role: message.author.role,
    parts: message.content.parts,
});

const contextInfoTransformer: MessageTransformer<ContextInfo> = (message) => ({
    id: message.id,
    role: message.author.role,
    model_set_context: message.content.model_set_context ?? null,
});

const authorCountsTransformer: MessageTransformer<keyof AuthorCounts> = (
    message,
) => message.author.role as keyof AuthorCounts;

// Export functions using the generic implementation with specific predicates
export async function fetchConversationMessageIds(
    conversationId: string,
): Promise<ConversationMessageIds[]> {
    return fetchConversationData(
        conversationId,
        messageIdsTransformer,
        isStandardMessage,
    );
}

export async function fetchConversationMessages(
    conversationId: string,
): Promise<MessageInfo[]> {
    return fetchConversationData(
        conversationId,
        messageInfoTransformer,
        isStandardMessage,
    );
}

export async function fetchConversationContext(
    conversationId: string,
): Promise<ContextInfo[]> {
    return fetchConversationData(
        conversationId,
        contextInfoTransformer,
        isContextMessage,
    );
}

export async function fetchConversationAuthorCounts(
    conversationId: string,
): Promise<AuthorCounts> {
    const authorRoles = await fetchConversationData(
        conversationId,
        authorCountsTransformer,
        isAuthorCountableMessage,
    );

    return authorRoles.reduce(
        (counts, role) => {
            counts[role]++;
            return counts;
        },
        { user: 0, assistant: 0 },
    );
}
