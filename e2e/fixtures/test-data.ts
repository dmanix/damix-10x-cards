/**
 * Test data fixtures for E2E tests
 * Store reusable test data here
 */

export const testUsers = {
  validUser: {
    email: "test@example.com",
    password: "TestPassword123!",
    name: "Test User",
  },
  invalidUser: {
    email: "invalid@example.com",
    password: "wrong",
  },
};

export const testFlashcards = {
  simple: {
    front_text: "What is React?",
    back_text: "A JavaScript library for building user interfaces",
  },
  complex: {
    front_text: "What is the difference between let and const?",
    back_text: "let allows reassignment while const does not",
  },
};

export const testGenerations = {
  prompt: "Generate flashcards about JavaScript basics",
  expectedCount: 5,
};
