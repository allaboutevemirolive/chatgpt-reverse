// packages/content-script/src/content.ts
import { createGreeting } from '@shared'; // Example import

console.log('Content script loaded!');

// Example using shared code (if shared dependency exists)
const message = createGreeting('Content Script User');
console.log(message.text);

// Add your content script logic here...
// (e.g., interacting with the DOM of the page)
// document.body.style.backgroundColor = 'lightblue';
