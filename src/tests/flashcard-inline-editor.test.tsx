import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FlashcardInlineEditor } from "@/components/flashcards/FlashcardInlineEditor";

const baseProps = {
  initial: {
    front: "Front content",
    back: "Back content",
    source: "manual" as const,
  },
  onSave: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
};

describe("FlashcardInlineEditor", () => {
  it("renders initial values and hides AI notice for manual cards", () => {
    render(<FlashcardInlineEditor {...baseProps} />);

    expect(screen.getByLabelText("Przód")).toHaveValue("Front content");
    expect(screen.getByLabelText("Tył")).toHaveValue("Back content");
    expect(screen.queryByText("Edycja oznaczy fiszkę jako AI (edytowana).")).toBeNull();
  });

  it("shows AI edit notice for AI source", () => {
    render(<FlashcardInlineEditor {...baseProps} initial={{ ...baseProps.initial, source: "ai" }} />);

    expect(screen.getByText("Edycja oznaczy fiszkę jako AI (edytowana).")).toBeInTheDocument();
  });

  it("keeps save disabled when only whitespace changes are made", async () => {
    const user = userEvent.setup();
    render(<FlashcardInlineEditor {...baseProps} />);

    const frontInput = screen.getByLabelText("Przód");
    await user.clear(frontInput);
    await user.type(frontInput, "  Front content  ");

    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
  });

  it("validates length limits and shows validation errors", async () => {
    const user = userEvent.setup();
    render(<FlashcardInlineEditor {...baseProps} />);

    const frontInput = screen.getByLabelText("Przód");
    await user.clear(frontInput);
    await user.type(frontInput, "a".repeat(201));

    expect(screen.getByText("Maksymalnie 200 znaków.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
  });

  it("calls onSave with trimmed values when valid and dirty", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<FlashcardInlineEditor {...baseProps} onSave={onSave} />);

    const frontInput = screen.getByLabelText("Przód");
    await user.clear(frontInput);
    await user.type(frontInput, "  New front  ");

    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ front: "New front", back: "Back content" });
  });

  it("shows error message when save fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Boom"));
    render(<FlashcardInlineEditor {...baseProps} onSave={onSave} />);

    const backInput = screen.getByLabelText("Tył");
    await user.clear(backInput);
    await user.type(backInput, "Updated back");

    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("locks inputs and buttons while saving", () => {
    render(<FlashcardInlineEditor {...baseProps} isSaving />);

    expect(screen.getByLabelText("Przód")).toBeDisabled();
    expect(screen.getByLabelText("Tył")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zapisywanie..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeDisabled();
  });
});
