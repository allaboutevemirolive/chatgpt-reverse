// src/config/constants.ts

// --- Stripe Configuration ---
// !!! REPLACE WITH YOUR ACTUAL STRIPE PRICE IDs !!!
export const STRIPE_PRICE_ID_MONTHLY = "price_1RJwp5GBa76vUuq3NNO39uvH"; // Example - REPLACE
export const STRIPE_PRICE_ID_LIFETIME = "price_1RJwp5GBa76vUuq3NNO39uvH"; // Example - REPLACE

// --- Checkout URLs ---
const EXTENSION_BASE_URL = chrome.runtime.getURL("popup/auth.html");
// Stripe can optionally append session_id if {CHECKOUT_SESSION_ID} is in the URL
export const CHECKOUT_SUCCESS_URL = `${EXTENSION_BASE_URL}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
export const CHECKOUT_CANCEL_URL = `${EXTENSION_BASE_URL}?checkout=cancel`;

// --- Timeouts ---
export const CHECKOUT_LISTENER_TIMEOUT = 30000; // 30 seconds

// --- Firestore ---
export const FIRESTORE_DB_NAME = 'chatgpt-reverse-db'; // Example DB name
export const FIRESTORE_CUSTOMERS_COLLECTION = 'customers';
export const FIRESTORE_CHECKOUT_SESSIONS_SUBCOLLECTION = 'checkout_sessions';

// --- Storage Keys ---
export const STORAGE_API_HEADERS_KEY = 'apiHeaders';
export const STORAGE_AUTH_DATA_KEY = 'authData'; // Example key for storing auth data
