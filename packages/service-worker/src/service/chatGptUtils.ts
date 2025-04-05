// src/service/chatGptUtils.ts
import { ChatGptApiClient } from "@/service/ChatGptApiClient";

const apiClient = ChatGptApiClient.getInstance();

// Wrapper function to fetch a list of conversations
export async function fetchConversations(
    offset: number = 0,
    limit: number = 28,
    order: string = "updated",
): Promise<any> {
    try {
        const response = await apiClient.getConversations(offset, limit, order);
        console.log("Conversations fetched successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to fetch conversations:", error);
        throw error;
    }
}

// Wrapper function to delete (hide) a conversation
export async function deleteConversation(conversationId: string): Promise<any> {
    try {
        const response = await apiClient.deleteConversation(conversationId);
        console.log("Conversation deleted successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to delete conversation:", error);
        throw error;
    }
}

// Wrapper function to share a conversation
export async function shareConversation(
    conversationId: string,
    currentNodeId: string,
): Promise<any> {
    try {
        const response = await apiClient.shareConversation(
            conversationId,
            currentNodeId,
        );
        console.log("Conversation shared successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to share conversation:", error);
        throw error;
    }
}

// Wrapper function to fetch a specific conversation
export async function fetchConversation(conversationId: string): Promise<any> {
    try {
        const response = await apiClient.getConversation(conversationId);
        console.log("Conversation fetched successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to fetch conversation:", error);
        throw error;
    }
}

// Wrapper function to archive a conversation
export async function archiveConversation(
    conversationId: string,
): Promise<any> {
    try {
        const response = await apiClient.archiveConversation(conversationId);
        console.log("Conversation archived successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to archive conversation:", error);
        throw error;
    }
}

// Wrapper function to rename a conversation
export async function renameConversation(
    conversationId: string,
    newTitle: string,
): Promise<any> {
    try {
        const response = await apiClient.renameConversation(
            conversationId,
            newTitle,
        );
        console.log("Conversation renamed successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to rename conversation:", error);
        throw error;
    }
}

// Wrapper function for generating autocompletions
export async function generateAutocompletions(
    inputText: string,
    numCompletions: number = 4,
    inSearchMode: boolean = false,
): Promise<any> {
    try {
        const response = await apiClient.generateAutocompletions(
            inputText,
            numCompletions,
            inSearchMode,
        );
        console.log("Autocompletions generated successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to generate autocompletions:", error);
        throw error;
    }
}

// Wrapper function for sending copy feedback
export async function sendCopyFeedback(
    messageId: string,
    conversationId: string,
    selectedText: string,
): Promise<any> {
    try {
        const response = await apiClient.sendCopyFeedback(
            messageId,
            conversationId,
            selectedText,
        );
        console.log("Copy feedback sent successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to send copy feedback:", error);
        throw error;
    }
}

// Core function to fetch audio data
export async function getAudioForMessage(
    messageId: string,
    conversationId: string,
    voice: string = "orbit",
    format: string = "aac",
): Promise<Blob> {
    try {
        const audioBlob = await apiClient.getAudio(
            messageId,
            conversationId,
            voice,
            format,
        );
        console.log("Audio fetched successfully:", audioBlob);
        return audioBlob;
    } catch (error) {
        console.error("Failed to fetch audio:", error);
        throw error;
    }
}

// Wrapper function to mark a message as thumbs up
export async function markMessageAsThumbsUp(
    messageId: string,
    conversationId: string,
): Promise<any> {
    try {
        const response = await apiClient.markMessageThumbsUp(
            messageId,
            conversationId,
        );
        console.log("Message marked as thumbs up successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to mark message as thumbs up:", error);
        throw error;
    }
}

// Wrapper function to mark a message as thumbs down
export async function markMessageAsThumbsDown(
    messageId: string,
    conversationId: string,
): Promise<any> {
    try {
        const response = await apiClient.markMessageThumbsDown(
            messageId,
            conversationId,
        );
        console.log("Message marked as thumbs down successfully:", response);
        return response;
    } catch (error) {
        console.error("Failed to mark message as thumbs down:", error);
        throw error;
    }
}
