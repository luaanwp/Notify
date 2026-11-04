import { test, expect } from "@playwright/test";
test("cadastro, etapa, favorito, filtro e persistência", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Oportunidades", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar oportunidade" }).click();
  await page
    .getByLabel("Nome da oportunidade")
    .fill("Oportunidade de teste — sem coleta real");
  await page.getByLabel("Link oficial").fill("https://example.com/");
  await page.getByLabel("Organização").fill("Fixture de validação");
  await page.getByRole("button", { name: "Salvar oportunidade" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Oportunidade de teste — sem coleta real",
    }),
  ).toBeVisible();
  await page
    .getByLabel("Nome da etapa")
    .fill("Resultado previsto — não publicado");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await page
    .getByLabel("Data prevista")
    .fill(
      `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`,
    );
  await page.getByLabel("URL da evidência").fill("https://example.com/notice");
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.getByText("precisão de dia")).toBeVisible();
  await page.getByLabel("Situação interna").selectOption("Preparando");
  await page.reload();
  await page
    .getByRole("button", { name: "Oportunidade de teste — sem coleta real" })
    .click();
  await expect(page.getByLabel("Situação interna")).toHaveValue("Preparando");
  await expect(
    page.getByText("Resultado previsto — não publicado", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A coleta exige um espaço conectado.", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-detail.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Todas as oportunidades" }).click();
  await page.getByRole("button", { name: "Adicionar aos favoritos" }).click();
  await page.getByRole("button", { name: "Favoritas", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Oportunidade de teste — sem coleta real",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-list.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Prazos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prazos cadastrados" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});
test("dados locais inválidos são preservados", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("notify.local.v1", '{"invalido":true}'),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "dados locais estão inválidos",
  );
  await expect(
    page.getByRole("button", { name: "Adicionar oportunidade" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("notify.local.v1")),
  ).toBe('{"invalido":true}');
});
