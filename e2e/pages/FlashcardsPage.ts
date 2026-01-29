import { Page, Locator, expect } from "@playwright/test";
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
  readonly listSection: Locator;

  constructor(page: Page) {
    super(page);

    this.addFlashcardButton = this.getByTestId("flashcards-add-button");
    this.createDialog = this.getByTestId("flashcard-create-dialog");
    this.frontTextarea = this.getByTestId("flashcard-create-front");
    this.backTextarea = this.getByTestId("flashcard-create-back");
    this.saveButton = this.getByTestId("flashcard-create-save");
    this.cancelButton = this.getByTestId("flashcard-create-cancel");
    this.listSection = this.page.getByRole("region", { name: "Lista fiszek" });
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
    // Wait for the toolbar section to be ready (not busy)
    const toolbarSection = this.page.getByRole("search", { name: "Wyszukiwanie i filtry fiszek" });
    await expect(toolbarSection).toBeVisible();
    await expect(toolbarSection).not.toHaveAttribute("aria-busy", "true");

    // Ensure button is ready for interaction
    await this.addFlashcardButton.scrollIntoViewIfNeeded();
    await expect(this.addFlashcardButton).toBeVisible();
    await expect(this.addFlashcardButton).toBeEnabled();

    // Additional wait to ensure React handlers are fully attached after hydration
    await this.page.waitForTimeout(200);

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

  async expectFlashcardVisible(front: string, back: string) {
    await expect(this.listSection).toBeVisible();
    const card = this.listSection.locator("li").filter({ hasText: front }).filter({ hasText: back }).first();
    await expect(card).toBeVisible();

    const frontContent = card.getByText(front, { exact: true });
    const backContent = card.getByText(back, { exact: true });

    await expect(frontContent).toHaveText(front);
    await expect(backContent).toHaveText(back);
  }

  async createManualFlashcard(front: string, back: string) {
    await this.openCreateDialog();
    await this.fillFront(front);
    await this.fillBack(back);
    await this.saveFlashcard();
  }
}
