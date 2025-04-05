export type SendMessageToSW = <T = any>(message: {
    type: string;
    payload?: any;
}) => Promise<T>;

/**
 * Sends a message to the background service worker and handles the response.
 * @param message - The message object with type and payload.
 * @returns A promise that resolves with the data from the service worker on success.
 * @throws An error object if the service worker returns an error or communication fails.
 */
export const sendMessageToSW: SendMessageToSW = async (message) => {
    // Using a more generic source name in logs
    console.log(
        "Content Helper: Sending message ->",
        message.type,
        message.payload ?? "",
    );
    try {
        const response = await chrome.runtime.sendMessage(message);
        console.log("Content Helper: Received response <-", response);

        if (chrome.runtime.lastError) {
            console.error(
                "Content Helper: chrome.runtime.lastError:",
                chrome.runtime.lastError.message,
            );
            throw new Error(
                `Service worker communication error: ${chrome.runtime.lastError.message}`,
            );
        }

        // Check for undefined response (can happen if SW is stopped/crashed during request)
        if (response === undefined) {
            console.error(
                "Content Helper: Received undefined response. Service Worker might have disconnected or crashed.",
            );
            throw new Error("Received undefined response from service worker.");
        }

        // Check the success flag from the response structure
        if (response?.success) {
            return response.data;
        } else {
            // Reconstruct the error object if possible
            const error = new Error(
                response.error?.message || "Unknown error from service worker.",
            );
            error.name = response.error?.name || "ServiceWorkerError";
            if (response.error?.stack) {
                error.stack = response.error.stack;
            }
            console.error(
                "Content Helper: Error received from Service Worker:",
                error,
            );
            throw error;
        }
    } catch (error: any) {
        // Catch errors during the sendMessage call itself
        console.error(
            "Content Helper: Error during sendMessage or processing response:",
            error,
        );
        if (error.message?.includes("Receiving end does not exist")) {
            // Provide a more specific error if the SW is unavailable
            throw new Error(
                "Cannot connect to the extension's service worker. It might be inactive or crashed. Please reload the extension or the page.",
            );
        }
        // Re-throw other errors
        throw error;
    }
};
