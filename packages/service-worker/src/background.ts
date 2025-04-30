// packages/service-worker/src/background.ts
import { VERSION } from "@shared";
import { ChatGptApiClient } from "@/service/ChatGptApiClient";
import {
    fetchConversations,
    deleteConversation,
    shareConversation,
    fetchConversation,
    archiveConversation,
    renameConversation,
    generateAutocompletions,
    sendCopyFeedback,
    getAudioForMessage,
    markMessageAsThumbsUp,
    markMessageAsThumbsDown,
} from "@/service/ChatGptService";
import {
    fetchConversationMessageIds,
    fetchConversationMessages,
    fetchConversationContext,
    fetchConversationAuthorCounts,
} from "@/service/ConversationProcessor";
import { exportConversationAsMarkdown } from "@/service/MarkdownExporter";
import { countConversationTokens } from "@/service/ConversationTokens";
import ExtPay from 'extpay';

console.log("Shared Version:", VERSION);
console.log("Service Worker starting...");

// ============================================================================

// PAYMENT GATEWAY

const extpay = ExtPay('chatgpt-reverse');
extpay.startBackground();
extpay.getUser().then(user => {
    console.log("get user", user)
});

// ============================================================================

(async () => {
    try {
        await ChatGptApiClient.initialize();
        console.log(
            "Service Worker: ChatGptApiClient initialized successfully.",
        );
    } catch (error) {
        console.error(
            "Service Worker: Failed to initialize ChatGptApiClient:",
            error,
        );
    }
})();

async function storeHeaders(headers: any): Promise<void> {
    try {
        const currentData = await chrome.storage.local.get("apiHeaders");
        const mergedHeaders = { ...(currentData.apiHeaders || {}), ...headers };
        await chrome.storage.local.set({ apiHeaders: mergedHeaders });
        console.log("Service Worker: Headers stored", mergedHeaders);

        ChatGptApiClient.getInstance().setHeaders(mergedHeaders);
    } catch (error) {
        console.error("Service Worker: Error storing/updating headers", error);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(
        `Service Worker received message: ${message.type}`,
        message.payload ?? "[No payload]",
        `From: ${sender.tab ? `Tab ${sender.tab.id}` : sender.id || "Unknown"}`,
    );

    if (message.type === "HEADERS_RECEIVED") {
        storeHeaders(message.data).then(() => sendResponse({ success: true }));
        return true;
    }
    if (message.type === "AUTH_RECEIVED") {
        storeHeaders({
            Authorization: `Bearer ${message.data.accessToken}`,
        }).then(() => {
            chrome.storage.local.set({ authData: message.data });
            sendResponse({ success: true });
        });
        return true;
    }
    if (
        message.type === "ACCOUNT_RECEIVED" ||
        message.type === "CONVERSATION_LIMIT_RECEIVED" ||
        message.type === "MODELS_RECEIVED"
    ) {
        chrome.storage.local.set({ [message.type]: message.data }, () => {
            if (chrome.runtime.lastError) {
                console.error(
                    `Error storing ${message.type}:`,
                    chrome.runtime.lastError.message,
                );
                sendResponse({
                    success: false,
                    error: { message: chrome.runtime.lastError.message },
                });
            } else {
                sendResponse({ success: true });
            }
        });
        return true;
    }

    const handleAsync = async (asyncFn: () => Promise<any>) => {
        try {
            const result = await asyncFn();
            sendResponse({ success: true, data: result });
        } catch (error: any) {
            console.error(
                `Service Worker Error handling ${message.type}:`,
                error,
            );
            sendResponse({
                success: false,
                error: {
                    message: error.message || "An unknown error occurred",
                    name: error.name,
                    stack: error.stack,
                },
            });
        }
    };

    switch (message.type) {
        case "FETCH_CONVERSATIONS":
            handleAsync(() =>
                fetchConversations(
                    message.payload.offset,
                    message.payload.limit,
                    message.payload.order,
                ),
            );
            break;
        case "FETCH_CONVERSATION":
            handleAsync(() =>
                fetchConversation(message.payload.conversationId),
            );
            break;
        case "DELETE_CONVERSATION":
            handleAsync(() =>
                deleteConversation(message.payload.conversationId),
            );
            break;
        case "SHARE_CONVERSATION":
            handleAsync(() =>
                shareConversation(
                    message.payload.conversationId,
                    message.payload.currentNodeId,
                ),
            );
            break;
        case "ARCHIVE_CONVERSATION":
            handleAsync(() =>
                archiveConversation(message.payload.conversationId),
            );
            break;
        case "RENAME_CONVERSATION":
            handleAsync(() =>
                renameConversation(
                    message.payload.conversationId,
                    message.payload.newTitle,
                ),
            );
            break;
        case "GENERATE_AUTOCOMPLETIONS":
            handleAsync(() =>
                generateAutocompletions(
                    message.payload.inputText,
                    message.payload.numCompletions,
                    message.payload.inSearchMode,
                ),
            );
            break;
        case "SEND_COPY_FEEDBACK":
            handleAsync(() =>
                sendCopyFeedback(
                    message.payload.messageId,
                    message.payload.conversationId,
                    message.payload.selectedText,
                ),
            );
            break;
        case "GET_AUDIO":
            handleAsync(async () => {
                const blob = await getAudioForMessage(
                    message.payload.messageId,
                    message.payload.conversationId,
                    message.payload.voice,
                    message.payload.format,
                );
                const reader = new FileReader();
                const dataUrlPromise = new Promise<string>(
                    (resolve, reject) => {
                        reader.onloadend = () =>
                            resolve(reader.result as string);
                        reader.onerror = (error) => reject(error);
                        reader.readAsDataURL(blob);
                    },
                );
                try {
                    const dataUrl = await dataUrlPromise;
                    console.log(
                        `Service Worker: Generated Data URL (length: ${dataUrl.length}) for audio.`,
                    );
                    return {
                        dataUrl,
                        format: message.payload.format || "aac",
                        messageId: message.payload.messageId,
                    };
                } catch (error) {
                    console.error(
                        "Service Worker: Error converting Blob to Data URL",
                        error,
                    );
                    throw new Error("Failed to read audio blob data.");
                }
            });
            break;
        case "MARK_MESSAGE_THUMBS_UP":
            handleAsync(() =>
                markMessageAsThumbsUp(
                    message.payload.messageId,
                    message.payload.conversationId,
                ),
            );
            break;
        case "MARK_MESSAGE_THUMBS_DOWN":
            handleAsync(() =>
                markMessageAsThumbsDown(
                    message.payload.messageId,
                    message.payload.conversationId,
                ),
            );
            break;

        case "FETCH_CONVERSATION_MESSAGE_IDS":
            handleAsync(() =>
                fetchConversationMessageIds(message.payload.conversationId),
            );
            break;
        case "FETCH_CONVERSATION_MESSAGES":
            handleAsync(() =>
                fetchConversationMessages(message.payload.conversationId),
            );
            break;
        case "FETCH_CONVERSATION_CONTEXT":
            handleAsync(() =>
                fetchConversationContext(message.payload.conversationId),
            );
            break;
        case "FETCH_CONVERSATION_AUTHOR_COUNTS":
            handleAsync(() =>
                fetchConversationAuthorCounts(message.payload.conversationId),
            );
            break;

        case "EXPORT_CONVERSATION_MARKDOWN":
            handleAsync(async () => {
                const exportData = await exportConversationAsMarkdown(
                    message.payload.conversationId,
                );
                return {
                    markdownContent: exportData.markdownContent,
                    createTime: exportData.createTime,
                    title: exportData.title,
                };
            });
            break;

        case "COUNT_CONVERSATION_TOKENS":
            handleAsync(() =>
                countConversationTokens(
                    message.payload.conversationId,
                    message.payload.model,
                ),
            );
            break;

        case "GET_COOKIE":
            chrome.cookies.get(
                {
                    name: message.payload.name,
                    url: message.payload.url,
                },
                (cookie) => {
                    if (chrome.runtime.lastError) {
                        console.error(
                            "Error getting cookie:",
                            chrome.runtime.lastError.message,
                        );
                        sendResponse({
                            success: false,
                            error: {
                                message: chrome.runtime.lastError.message,
                            },
                        });
                    } else {
                        sendResponse({
                            success: true,
                            data: { value: cookie?.value || null },
                        });
                    }
                },
            );
            return true;

        default:
            console.warn(
                "Service Worker received unknown message type:",
                message.type,
            );

            sendResponse({
                success: false,
                error: {
                    message: `Unknown message type '${message.type}' received by service worker.`,
                },
            });

            return false;
    }

    return true;
});

chrome.runtime.onInstalled.addListener((details) => {
    console.log(
        `Extension ${details.reason}. Previous version: ${details.previousVersion}. Service worker active.`,
    );
});

chrome.runtime.onStartup.addListener(async () => {
    console.log("Browser startup detected. Service worker activating.");

    try {
        await ChatGptApiClient.initialize();
        console.log(
            "Service Worker: ChatGptApiClient headers refreshed on browser startup.",
        );
    } catch (error) {
        console.error(
            "Service Worker: Failed to refresh ChatGptApiClient headers on browser startup:",
            error,
        );
    }
});

console.log("Service Worker event listeners attached.");
