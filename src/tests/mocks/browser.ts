import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * MSW worker for browser environment
 * This can be used for manual testing in development
 */
export const worker = setupWorker(...handlers);
