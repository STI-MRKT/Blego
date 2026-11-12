// Playwright 1.65 waitForFunction treats a returned Promise as truthy before
// adopting its result. Poll awaited page.evaluate for asynchronous predicates.
async function waitForAsync(page, predicate, arg, { timeout = 30000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate, arg)) return;
    await page.waitForTimeout(50);
  }
  throw Error(`Async condition did not become true within ${timeout} ms`);
}
module.exports = { waitForAsync };
