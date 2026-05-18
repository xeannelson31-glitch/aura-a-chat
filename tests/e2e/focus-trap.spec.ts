import { test, expect, type Page } from "@playwright/test";

/**
 * Accessibility / focus-management E2E tests.
 *
 * Verifies:
 *   1. The mobile drawer traps Tab focus inside itself.
 *   2. ESC closes the drawer.
 *   3. Closing the drawer restores focus to the trigger button.
 *   4. The "Clear chat" confirmation dialog traps focus, closes on ESC,
 *      and restores focus to its trigger.
 */

async function seedConversation(page: Page) {
  // Inject a minimal saved conversation so the "Clear chat" button is enabled.
  await page.addInitScript(() => {
    const conv = {
      id: "test-conv",
      title: "Test chat",
      messages: [
        { id: "m1", role: "user", content: "hi" },
        { id: "m2", role: "assistant", content: "hello" },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem("aura-conversations-v1", JSON.stringify([conv]));
    localStorage.setItem("aura-active-conversation-v1", "test-conv");
  });
}

test.describe("mobile drawer focus management", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("traps focus, closes on Escape, and restores focus on close", async ({ page }) => {
    await seedConversation(page);
    await page.goto("/");

    const trigger = page.getByRole("button", { name: /open conversations/i });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.click();

    const drawer = page.getByRole("dialog", { name: /conversations/i });
    await expect(drawer).toBeVisible();

    // First focusable should now be inside the drawer.
    const focusedInsideDrawer = await drawer.evaluate(
      (node) => node.contains(document.activeElement),
    );
    expect(focusedInsideDrawer).toBe(true);

    // Press Escape — drawer should close.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // Focus should be restored to the trigger button.
    const triggerIsFocused = await trigger.evaluate(
      (node) => node === document.activeElement,
    );
    expect(triggerIsFocused).toBe(true);
  });
});

test.describe("clear-chat dialog focus management", () => {
  test("traps focus, closes on Escape, and restores focus on close", async ({ page }) => {
    await seedConversation(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const trigger = page.getByRole("button", { name: /clear chat/i });
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: /clear this chat/i });
    await expect(dialog).toBeVisible();

    // Focus should land inside the dialog.
    const insideDialog = await dialog.evaluate((node) =>
      node.contains(document.activeElement),
    );
    expect(insideDialog).toBe(true);

    // Tab repeatedly — focus must stay inside.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const stillInside = await dialog.evaluate((node) =>
        node.contains(document.activeElement),
      );
      expect(stillInside).toBe(true);
    }

    // ESC closes the dialog.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Trigger regains focus.
    const triggerFocused = await trigger.evaluate(
      (node) => node === document.activeElement,
    );
    expect(triggerFocused).toBe(true);
  });

  test("dialog and trigger expose proper ARIA attributes", async ({ page }) => {
    await seedConversation(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const trigger = page.getByRole("button", { name: /clear chat/i });
    await expect(trigger).toHaveAttribute("aria-label", /clear chat/i);
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: /clear this chat/i });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
