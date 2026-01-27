import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW server for Node.js environment (Vitest)
 * This server will intercept all HTTP requests during tests
 */
export const server = setupServer(...handlers);
