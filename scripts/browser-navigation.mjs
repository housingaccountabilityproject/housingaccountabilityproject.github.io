// Exercise the same menu a phone reader uses; desktop links remain in place.
export async function openNavigation(page) {
  await page.locator('body.city-menu-ready').waitFor();
  const toggle=page.locator('.city-menu-toggle');
  if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
}
export async function closeNavigation(page) {
  const toggle=page.locator('.city-menu-toggle');
  if(await toggle.getAttribute('aria-expanded')==='true')await page.locator('.city-menu-close').click();
}
