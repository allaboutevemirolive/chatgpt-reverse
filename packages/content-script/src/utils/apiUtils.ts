// packages/content-script/src/utils/apiUtils.ts
import { sendMessageToSW, SendMessageToSW } from "./swMessenger";
import { MSG } from "@shared"; // Import the message constants

// --- Generic API Action Caller ---

/**
 * Sends an action message to the service worker and returns the response data on success.
 * Handles potential payload building and standard SW communication errors.
 *
 * @param type The message type indicating the action to perform.
 * @param payloadBuilder A function (sync or async) that returns the payload for the message.
 * @param messageSender The function used to send messages to the service worker (dependency injection).
 * @returns A promise resolving with the data field from the service worker's successful response.
 * @throws An error if the payload builder fails, the service worker communication fails,
 *         or the service worker indicates an error in its response.
 */
export async function callServiceWorkerAction<T = any>(
    type: string, // Keep type as string here, the caller provides the constant
    payloadBuilder: () => any | Promise<any>,
    messageSender: SendMessageToSW = sendMessageToSW,
): Promise<T> {
    let payload: any;
    try {
        payload = await Promise.resolve(payloadBuilder());
        if (payload === undefined) {
            console.warn(
                `Payload builder for action "${type}" returned undefined. Sending empty payload.`,
            );
            payload = {};
        }
    } catch (error) {
        console.error(`Error building payload for action "${type}":`, error);
        throw new Error(
            `Failed to prepare data for action "${type}": ${(error as Error).message}`,
        );
    }

    try {
        // Message structure expects type and payload
        const message = { type, payload: payload ?? {} };
        const data = await messageSender<T>(message);
        return data;
    } catch (error) {
        console.error(`Error calling service worker action "${type}":`, error);
        // Re-throw the error from swMessenger, which should be structured
        throw error;
    }
}

// --- Specific API Action Wrappers ---

// -- Conversation List --
interface FetchConversationsParams {
    offset?: number | string;
    limit?: number | string;
    order?: string;
}
type ConversationSummary = {
    id: string;
    title: string;
    create_time: number;
};
type ConversationListResponse = {
    items: ConversationSummary[];
    total: number;
    limit: number;
    offset: number;
};

export async function fetchConversations(
    params: FetchConversationsParams = {},
    messageSender?: SendMessageToSW,
): Promise<ConversationListResponse> {
    const offset = Number(params.offset) || 0;
    const limit = Number(params.limit) || 28; // Default limit used by ChatGPT UI
    const order = params.order || "updated";
    const payloadBuilder = () => ({ offset, limit, order });
    console.log(
        `fetchConversations API util: Requesting with payload:`,
        payloadBuilder(),
    );
    return callServiceWorkerAction<ConversationListResponse>(
        MSG.FETCH_CONVERSATIONS, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Single Conversation --
// TODO: Replace any with specific type if known
type ConversationDetailResponse = any;

export async function fetchConversationDetail(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<ConversationDetailResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<ConversationDetailResponse>(
        MSG.FETCH_CONVERSATION, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Delete Conversation --
export async function deleteConversationById(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required to delete.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction(
        MSG.DELETE_CONVERSATION, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Share Conversation --
interface ShareConversationParams {
    conversationId: string;
    currentNodeId: string;
}
type ShareResponse = { share_url?: string;[key: string]: any };

export async function shareConversation(
    params: ShareConversationParams,
    messageSender?: SendMessageToSW,
): Promise<ShareResponse> {
    if (!params.conversationId?.trim() || !params.currentNodeId?.trim()) {
        throw new Error("Conversation ID and Current Node ID are required.");
    }
    const payloadBuilder = () => ({
        conversationId: params.conversationId.trim(),
        currentNodeId: params.currentNodeId.trim(),
    });
    return callServiceWorkerAction<ShareResponse>(
        MSG.SHARE_CONVERSATION, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Archive Conversation --
export async function archiveConversation(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required to archive.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction(
        MSG.ARCHIVE_CONVERSATION, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Rename Conversation --
export async function renameConversation(
    conversationId: string,
    newTitle: string,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!conversationId?.trim() || !newTitle?.trim()) {
        throw new Error("Conversation ID and New Title are required.");
    }
    const payloadBuilder = () => ({
        conversationId: conversationId.trim(),
        newTitle: newTitle.trim(),
    });
    return callServiceWorkerAction(
        MSG.RENAME_CONVERSATION, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Generate Autocompletions --
interface AutocompletionsParams {
    inputText: string;
    numCompletions?: number | string;
    inSearchMode?: boolean | string;
}
type AutocompletionsResponse = { completions?: string[];[key: string]: any };

export async function generateAutocompletions(
    params: AutocompletionsParams,
    messageSender?: SendMessageToSW,
): Promise<AutocompletionsResponse> {
    if (params.inputText == null) // Check for null or undefined
        throw new Error("Input text is required for autocompletions.");
    const payloadBuilder = () => ({
        inputText: params.inputText,
        numCompletions: Number(params.numCompletions) || 4,
        inSearchMode:
            params.inSearchMode === "true" || params.inSearchMode === true,
    });
    return callServiceWorkerAction<AutocompletionsResponse>(
        MSG.GENERATE_AUTOCOMPLETIONS, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Send Copy Feedback --
interface CopyFeedbackParams {
    messageId: string;
    conversationId: string;
    selectedText: string;
}

export async function sendCopyFeedback(
    params: CopyFeedbackParams,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (
        !params.messageId?.trim() ||
        !params.conversationId?.trim() ||
        params.selectedText == null // Check for null or undefined
    ) {
        throw new Error(
            "Message ID, Conversation ID, and Selected Text are required.",
        );
    }
    const payloadBuilder = () => params;
    return callServiceWorkerAction(
        MSG.SEND_COPY_FEEDBACK, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Audio (Returns Data for Download Trigger) --
interface FetchAudioParams {
    messageId: string;
    conversationId: string;
    voice?: string;
    format?: string;
}
type FetchAudioResponse = {
    dataUrl: string;
    format: string;
    messageId: string;
};

export async function fetchAudioData(
    params: FetchAudioParams,
    messageSender?: SendMessageToSW,
): Promise<FetchAudioResponse> {
    if (!params.messageId?.trim() || !params.conversationId?.trim()) {
        throw new Error("Message ID and Conversation ID are required.");
    }
    const payloadBuilder = () => ({
        messageId: params.messageId.trim(),
        conversationId: params.conversationId.trim(),
        voice: params.voice || "alloy", // Default voice
        format: params.format || "aac", // Default format
    });
    return callServiceWorkerAction<FetchAudioResponse>(
        MSG.GET_AUDIO, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Message IDs --
type ConversationMessageId = { id: string; author: string /* ... */ };
type FetchMessageIdsResponse = ConversationMessageId[];

export async function fetchConversationMessageIds(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchMessageIdsResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchMessageIdsResponse>(
        MSG.FETCH_CONVERSATION_MESSAGE_IDS, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Messages --
type MessageInfo = { id: string; role: string; parts: string[] /* ... */ };
type FetchMessagesResponse = MessageInfo[];

export async function fetchConversationMessages(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchMessagesResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchMessagesResponse>(
        MSG.FETCH_CONVERSATION_MESSAGES, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Context --
type ContextInfo = {
    id: string;
    role: string;
    model_set_context: string | null /* ... */;
};
type FetchContextResponse = ContextInfo[];

export async function fetchConversationContext(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchContextResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchContextResponse>(
        MSG.FETCH_CONVERSATION_CONTEXT, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Mark Message Thumbs Up/Down --
interface FeedbackParams {
    messageId: string;
    conversationId: string;
}

export async function markMessageThumbsUp(
    params: FeedbackParams,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!params.messageId?.trim() || !params.conversationId?.trim()) {
        throw new Error("Message ID and Conversation ID are required.");
    }
    const payloadBuilder = () => params;
    return callServiceWorkerAction(
        MSG.MARK_MESSAGE_THUMBS_UP, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

export async function markMessageThumbsDown(
    params: FeedbackParams,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!params.messageId?.trim() || !params.conversationId?.trim()) {
        throw new Error("Message ID and Conversation ID are required.");
    }
    const payloadBuilder = () => params;
    return callServiceWorkerAction(
        MSG.MARK_MESSAGE_THUMBS_DOWN, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Export Conversation (Returns Data for Download Trigger) --
type FetchExportDataResponse = {
    markdownContent: string;
    createTime: number;
    title: string;
};

export async function fetchMarkdownExportData(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchExportDataResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchExportDataResponse>(
        MSG.EXPORT_CONVERSATION_MARKDOWN, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Author Counts --
type AuthorCounts = { user: number; assistant: number /* ... */ };

export async function fetchConversationAuthorCounts(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<AuthorCounts> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<AuthorCounts>(
        MSG.FETCH_CONVERSATION_AUTHOR_COUNTS, // <-- Use constant
        payloadBuilder,
        messageSender,
    );
}
