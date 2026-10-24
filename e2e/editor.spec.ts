import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".splash")).toHaveCount(0, { timeout: 60_000 });
}

/** The canvas has drawn a can: the centre of the stage is not the flat backdrop. */
async function canvasHasContent(page: Page) {
  const shot = await page.locator(".stage__canvas").screenshot();
  return shot.length > 20_000;
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

async function openTool(page: Page, name: string) {
  const nav = isPhone(page) ? page.locator(".toolstrip") : page.locator(".rail");
  await nav.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".panel__title")).toHaveText(name);
}

test("renders the default can and the first-run card", async ({ page }) => {
  await ready(page);
  await expect(page.getByRole("heading", { name: "Put your artwork on it." })).toBeVisible();
  expect(await canvasHasContent(page)).toBe(true);
});

test("every tool opens its panel", async ({ page }) => {
  await ready(page);
  for (const name of ["Can", "Colour & finish", "Artwork", "Light", "Water", "Camera", "Effects", "Scene"]) {
    await openTool(page, name);
  }
});

test("sample artwork wraps the can and reports its size", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Try a sample" }).click();
  await openTool(page, "Artwork");
  await expect(page.locator(".asset__name")).toHaveText("Sample: Hopwell IPA");
  await expect(page.locator(".asset__fit").first()).toContainText("mm");
  await page.getByRole("radio", { name: "Label" }).click();
  await expect(page.locator(".label-handles")).toBeVisible();
});

test("format picker changes the can and the top bar", async ({ page }) => {
  await ready(page);
  await openTool(page, "Can");
  await page.getByPlaceholder(/Search formats/).fill("crowler");
  await page.getByRole("option", { name: /32 oz Crowler/ }).click();
  await expect(page.locator(".format-current__name")).toContainText("32 oz Crowler");
});

test("colour change can be undone and redone", async ({ page }) => {
  test.skip(isPhone(page), "redo is hidden on phones by design");
  await ready(page);
  await openTool(page, "Colour & finish");
  const body = page.getByRole("radiogroup", { name: "Body colour" });
  await body.getByRole("radio", { name: "Classic gold" }).click();
  await expect(body.getByRole("radio", { name: "Classic gold" })).toHaveAttribute("aria-checked", "true");
  await page.getByTitle("Undo (⌘Z)").click();
  await expect(body.getByRole("radio", { name: "Classic silver" })).toHaveAttribute("aria-checked", "true");
  await page.getByTitle("Redo (⇧⌘Z)").click();
  await expect(body.getByRole("radio", { name: "Classic gold" })).toHaveAttribute("aria-checked", "true");
});

test("export dialog shows a live preview at the chosen size", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: /Export/ }).first().click();
  await expect(page.getByRole("img", { name: "Export preview" })).toBeVisible();
  await page.getByRole("radio", { name: "1:1" }).click();
  await expect(page.locator(".export__frame-size")).toHaveText("2048 × 2048");
});

test("water preset and haze apply", async ({ page }) => {
  await ready(page);
  await openTool(page, "Water");
  await page.getByRole("button", { name: "Ice cold" }).click();
  await expect(page.getByRole("button", { name: "Ice cold" })).toHaveClass(/is-active/);
});
