// src/firebase/stripe.ts
import {
    collection,
    addDoc,
    onSnapshot,
    DocumentReference,
    DocumentData,
    FirestoreError,
    Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./core";
import { getCurrentUser } from "./auth"; // Import function to get user
import {
    STRIPE_PRICE_ID_MONTHLY,
    STRIPE_PRICE_ID_LIFETIME,
    CHECKOUT_SUCCESS_URL,
    CHECKOUT_CANCEL_URL,
    CHECKOUT_LISTENER_TIMEOUT,
    FIRESTORE_CUSTOMERS_COLLECTION,
    FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION,
} from "@/config/constants";

interface CheckoutSessionPayload {
    planId: "monthly" | "lifetime";
}

interface CheckoutSessionResult {
    checkoutUrl: string;
}

/**
 * Creates a Firestore document to trigger the Stripe Checkout session creation extension.
 * Listens for the URL or error added back to the document by the extension.
 * @param payload - Contains the planId ('monthly' or 'lifetime').
 * @returns A promise resolving with the Stripe Checkout URL.
 */
export async function createCheckoutSession(
    payload: CheckoutSessionPayload,
): Promise<CheckoutSessionResult> {
    const currentUser = getCurrentUser(); // Get the cached current user
    const userId = currentUser?.uid;

    if (!userId) {
        console.error(
            "Firebase Stripe: User not logged in.",
        );
        throw new Error("User must be logged in to start checkout.");
    }

    let priceId: string | undefined;
    switch (payload.planId) {
        case "monthly":
            priceId = STRIPE_PRICE_ID_MONTHLY;
            break;
        case "lifetime":
            priceId = STRIPE_PRICE_ID_LIFETIME;
            break;
        default:
            console.error(
                `Firebase Stripe: Invalid planId: ${payload.planId}`,
            );
            throw new Error(`Invalid plan selected.`);
    }

    if (!priceId) {
        console.error(
            `Firebase Stripe: Stripe Price ID missing for plan: ${payload.planId}. Check constants.`,
        );
        throw new Error(
            `Configuration error: Price ID for the selected plan is missing.`,
        );
    }

    console.log(
        `Firebase Stripe: Creating checkout session document for user ${userId}, price ${priceId}`,
    );
    const db = getDb();
    const checkoutSessionCollection = collection(
        db,
        FIRESTORE_CUSTOMERS_COLLECTION,
        userId,
        FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION,
    );

    try {
        const docRef: DocumentReference<DocumentData> = await addDoc(
            checkoutSessionCollection,
            {
                price: priceId,
                success_url: CHECKOUT_SUCCESS_URL,
                cancel_url: CHECKOUT_CANCEL_URL,
                mode: payload.planId === "lifetime" ? "payment" : "subscription",
                // Optional metadata
                // client: 'extension',
                // metadata: { source: 'chrome-extension-auth-page' }
            },
        );

        console.log("Firebase Stripe: Checkout session document created:", docRef.id);

        // Wait for the Stripe Extension to update the document
        return new Promise<CheckoutSessionResult>((resolve, reject) => {
            let timedOut = false;
            let unsubscribeCalled = false;
            let timeoutHandle: NodeJS.Timeout | null = null;
            let unsubscribeFirestore: Unsubscribe | null = null;

            const cleanup = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                if (unsubscribeFirestore && !unsubscribeCalled) {
                    unsubscribeCalled = true;
                    console.log("Firebase Stripe: Unsubscribing Firestore listener for", docRef.id);
                    unsubscribeFirestore();
                }
            };

            unsubscribeFirestore = onSnapshot(
                docRef,
                (snap) => {
                    if (timedOut || unsubscribeCalled) return;
                    const data = snap.data();
                    console.log(
                        "Firebase Stripe: Snapshot raw data for checkout session:", docRef.id, JSON.stringify(data || {})
                    );

                    if (data?.error) {
                        console.error(
                            "Firebase Stripe: Stripe extension reported error:",
                            data.error,
                        );
                        cleanup();
                        reject(
                            new Error(
                                `Checkout failed: ${data.error.message || "Unknown Stripe error"}`,
                            ),
                        );
                    } else if (data?.url) {
                        console.log(
                            "Firebase Stripe: Stripe Checkout URL retrieved:",
                            data.url,
                        );
                        cleanup();
                        resolve({ checkoutUrl: data.url });
                    } else {
                        console.log(`Firebase Stripe: Snapshot for ${docRef.id} updated, but no url or error field yet.`);
                    }
                },
                (error: FirestoreError) => {
                    if (timedOut || unsubscribeCalled) return;
                    console.error(
                        "Firebase Stripe: Firestore snapshot listener error:",
                        docRef.id,
                        error,
                    );
                    cleanup();
                    reject(
                        new Error(
                            `Failed to listen for checkout session updates: ${error.message}`,
                        ),
                    );
                },
            );

            timeoutHandle = setTimeout(() => {
                if (timedOut || unsubscribeCalled) return;
                timedOut = true;
                console.warn(
                    `Firebase Stripe: Timeout (${CHECKOUT_LISTENER_TIMEOUT}ms) waiting for checkout URL for doc ${docRef.id}`,
                );
                cleanup();
                reject(
                    new Error(
                        "Timeout waiting for Stripe Checkout URL. Please try again.",
                    ),
                );
            }, CHECKOUT_LISTENER_TIMEOUT);
        });
    } catch (error) {
        console.error(
            "Firebase Stripe: Firestore error adding checkout session doc:",
            error,
        );
        throw new Error(
            `Failed to initiate checkout: ${(error as Error).message}`,
        );
    }
}
