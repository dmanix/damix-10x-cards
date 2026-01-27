import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for the Flashcards page
 * Encapsulates interactions for creating manual flashcards
 */
export class FlashcardsPage extends BasePage {
  readonly addFlashcardButton: Locator;
  readonly createDialog: Locator;
  readonly frontTextarea: Locator;
  readonly backTextarea: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);

    this.addFlashcardButton = this.getByTestId("flashcards-add-button");
    this.createDialog = this.getByTestId("flashcard-create-dialog");
    this.frontTextarea = this.getByTestId("flashcard-create-front");
    this.backTextarea = this.getByTestId("flashcard-create-back");
    this.saveButton = this.getByTestId("flashcard-create-save");
    this.cancelButton = this.getByTestId("flashcard-create-cancel");
  }

  async goto() {
    await super.goto("/flashcards");
    await this.waitForHydration();
  }

  /**
   * Wait for React hydration on the flashcards page
   * Call this after navigation or redirect to ensure components are ready
   */
  async waitForHydration() {
    // Wait for the page to fully load
    await this.page.waitForLoadState("networkidle");

    // Wait for React hydration - the add button should have the data-test-id attribute
    await this.page.waitForSelector('[data-test-id="flashcards-add-button"]', {
      state: "visible",
      timeout: 15000,
    });
  }

  async openCreateDialog() {
    await this.addFlashcardButton.click();
    await this.createDialog.waitFor({ state: "visible", timeout: 10000 });
  }

  async fillFront(value: string) {
    await this.frontTextarea.fill(value);
  }

  async fillBack(value: string) {
    await this.backTextarea.fill(value);
  }

  async saveFlashcard() {
    await this.saveButton.click();
    await this.createDialog.waitFor({ state: "hidden" });
  }

  async cancelCreate() {
    await this.cancelButton.click();
    await this.createDialog.waitFor({ state: "hidden" });
  }

  async createManualFlashcard(front: string, back: string) {
    await this.openCreateDialog();
    await this.fillFront(front);
    await this.fillBack(back);
    await this.saveFlashcard();
  }
}
