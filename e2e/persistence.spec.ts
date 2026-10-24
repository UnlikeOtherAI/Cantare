import { expect, test, type Page } from "@playwright/test";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

async function waitForStage(page: Page) {
  await expect(page.locator(".splash")).toHaveCount(0, { timeout: 60_000 });
}

async function openTool(page: Page, name: string) {
  // Clicking the active tool again collapses its panel.
  if ((await page.locator(".panel__title").textContent()) === name) return;
  const nav = isPhone(page) ? page.locator(".toolstrip") : page.locator(".rail");
  await nav.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".panel__title")).toHaveText(name);
}

async function bodyColour(page: Page, name: string) {
  await openTool(page, "Colour & finish");
  await page.getByRole("radiogroup", { name: "Body colour" }).getByRole("radio", { name }).click();
}

async function expectBodyColour(page: Page, name: string) {
  await openTool(page, "Colour & finish");
  await expect(page.getByRole("radiogroup", { name: "Body colour" }).getByRole("radio", { name })).toHaveAttribute("aria-checked", "true");
}

async function expectSampleArtwork(page: Page) {
  await openTool(page, "Artwork");
  await expect(page.locator(".asset__name")).toHaveText("Sample: Hopwell IPA");
  const thumb = page.locator(".asset__thumb img");
  await expect(thumb).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(1000);
}

/** The autosave has written the scene, artwork reference included. */
async function savedScene(page: Page) {
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cantare.scene") ?? "null")?.images?.artwork ?? null))
    .toMatch(/^idb:[0-9a-f]+$/);
}

const sceneMenu = (page: Page) => page.getByRole("button", { name: /^Scene:/ });

async function menu(page: Page, item: string) {
  await sceneMenu(page).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("colour and artwork survive a reload", async ({ page }) => {
  await page.goto("/");
  await waitForStage(page);
  await page.getByRole("button", { name: "Try a sample" }).click();
  await bodyColour(page, "Classic gold");
  await savedScene(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cantare.scene") ?? "null")?.settings?.body?.preset)).toBe("gold");

  await page.reload();
  await waitForStage(page);
  await expectBodyColour(page, "Classic gold");
  await expectSampleArtwork(page);
  await expect(page.getByRole("heading", { name: "Put your artwork on it." })).toHaveCount(0);
});

test("a saved setup comes back after changes and a reload", async ({ page }) => {
  // Two full loads plus a save and an apply: on a GPU-less CI runner this outlasts one test's budget.
  test.slow();
  await page.goto("/");
  await waitForStage(page);
  await page.getByRole("button", { name: "Try a sample" }).click();
  await bodyColour(page, "Classic gold");

  await menu(page, "Save setup…");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Save setup" })).toBeVisible();
  await dialog.getByLabel("Setup name").fill("Gold IPA");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".doc__name")).toHaveText("Gold IPA");

  // Change things, then start over: no artwork, default colour.
  await bodyColour(page, "Black");
  await expectBodyColour(page, "Black");
  await menu(page, "New scene");
  await expect(page.locator(".doc__name")).toHaveText("Untitled scene");
  await expectBodyColour(page, "Classic silver");

  await page.reload();
  await waitForStage(page);
  await expect(page.locator(".doc__name")).toHaveText("Untitled scene");

  await menu(page, "Setups…");
  await dialog.getByRole("button", { name: /Gold IPA/ }).click();
  await dialog.getByRole("button", { name: "Apply setup" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".doc__name")).toHaveText("Gold IPA");
  await expectBodyColour(page, "Classic gold");
  await expectSampleArtwork(page);

  // Applying is one undo step.
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".doc__name")).toHaveText("Untitled scene");
  await expectBodyColour(page, "Classic silver");
});

test("setups can be renamed and deleted", async ({ page }) => {
  await page.goto("/");
  await waitForStage(page);
  await menu(page, "Save setup…");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Setup name").fill("First");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await menu(page, "Setups…");
  await dialog.getByRole("button", { name: /First/ }).click();
  await dialog.getByLabel("Setup name").fill("Renamed");
  await dialog.getByLabel("Setup name").press("Enter");
  await expect(dialog.getByRole("heading", { name: "Renamed" })).toBeVisible();
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByRole("button", { name: /Renamed/ })).toBeVisible();

  await dialog.getByRole("button", { name: /Renamed/ }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog.getByText("No setups yet")).toBeVisible();
  await dialog.getByRole("button", { name: "Undo" }).click();
  await expect(dialog.getByRole("button", { name: /Renamed/ })).toBeVisible();
});
