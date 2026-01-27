import { test, expect } from "@playwright/test";
import { FlashcardsPage } from "./pages/FlashcardsPage";
import { LoginPage } from "./pages/LoginPage";
import { testFlashcards } from "./fixtures/test-data";

test.describe("Flashcards create flow", () => {
  test("should create a manual flashcard", async ({ page }) => {
    const flashcardsPage = new FlashcardsPage(page);
    const loginPage = new LoginPage(page);

    const email = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      throw new Error("Missing E2E_USERNAME or E2E_PASSWORD in environment.");
    }

    await loginPage.goto("/flashcards");
    await loginPage.login(email, password);
    
    // Wait for redirect to /flashcards and React hydration
    await flashcardsPage.waitForHydration();
    
    await flashcardsPage.openCreateDialog();

    await flashcardsPage.fillFront(testFlashcards.simple.front_text);
    await flashcardsPage.fillBack(testFlashcards.simple.back_text);
    await flashcardsPage.saveFlashcard();

    await expect(flashcardsPage.createDialog).toBeHidden();
  });
});
