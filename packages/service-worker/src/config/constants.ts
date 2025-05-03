// src/config/constants.ts

// --- Stripe Configuration ---
export const STRIPE_PRICE_ID_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY;
export const STRIPE_PRICE_ID_LIFETIME = import.meta.env.VITE_STRIPE_PRICE_ID_LIFETIME;

// --- Checkout URLs ---
const HOSTING_BASE_URL = import.meta.env.VITE_HOSTING_BASE_URL;
export const CHECKOUT_SUCCESS_URL = `${HOSTING_BASE_URL}/checkout-success.html`;
export const CHECKOUT_CANCEL_URL = `${HOSTING_BASE_URL}/checkout-cancel.html`;

// --- Timeouts ---
export const CHECKOUT_LISTENER_TIMEOUT = 30000; // 30 seconds

// --- Firestore ---
export const FIRESTORE_DB_NAME = "chatgpt-reverse-db";
export const FIRESTORE_CUSTOMERS_COLLECTION = "customers";
export const FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION = "checkout_sessions";
export const FIRESTORE_SUBSCRIPTIONS_SUBCOLLECTION = "subscriptions";

// --- Storage Keys ---
export const STORAGE_API_HEADERS_KEY = "apiHeaders";
export const STORAGE_AUTH_DATA_KEY = "authData";

export const CHATGPT_BASE_URL = "https://chatgpt.com";
