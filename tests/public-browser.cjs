const assert = require("node:assert/strict");
require("./analytics.cjs");
const {spawn} = require("node:child_process");
const {once} = require("node:events");
const path = require("node:path");
const fs = require("node:fs/promises");
const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

async function checkFocusContrast(page, selector) {
  const control = page.locator(selector).first();
  await control.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const result = await control.evaluate(element => {
    const style = getComputedStyle(element);
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
        value /= 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const ring = luminance(style.outlineColor), background = luminance(getComputedStyle(document.body).backgroundColor);
    return {visible: element.matches(":focus-visible"), width: parseFloat(style.outlineWidth), contrast: (Math.max(ring, background) + 0.05) / (Math.min(ring, background) + 0.05)};
  });
  assert(result.visible && result.width >= 3 && result.contrast >= 3, `${selector}: ${JSON.stringify(result)}`);
}

(async () => {
  const python = process.env.PYTHON || (process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
  const args = ["-m", "tests.public_browser_server"];
  if (process.env.COMPANY_SITE_DIR) args.push("--company", process.env.COMPANY_SITE_DIR);
  const server = spawn(python, args, {stdio: ["ignore", "pipe", "inherit"]});
  let browser;
  try {
    const [chunk] = await once(server.stdout, "data");
    const {port} = JSON.parse(chunk.toString().trim());
    const base = `http://127.0.0.1:${port}/products/schedula/`;
    browser = await chromium.launch({headless: true});
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.analyticsEvents = [];
      window.gtag = (...args) => window.analyticsEvents.push(args);
    });
    const failures = [], requests = [];
    page.on("pageerror", error => failures.push(error.message));
    page.on("request", request => requests.push(request.url()));
    await page.goto(base + "demo/");
    await page.locator("#feature-status").filter({hasText: "OPTIMAL"}).waitFor({timeout: 45000});
    assert.deepEqual(await page.evaluate(() => window.analyticsEvents), []);
    assert.equal(await page.locator(".feature-summary").count(), 0);
    await page.getByRole("button", {name: "3人で試す", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "OPTIMAL"}).waitFor({timeout: 45000});
    assert.equal(await page.locator("#feature-number").inputValue(), "3");
    assert.match(await page.locator(".feature-coverage").innerText(), /変更 · 初期は配置2 \/ 必要2人/);
    assert.deepEqual(await page.evaluate(() => window.analyticsEvents), [["event", "demo_run_success", {
      lesson_id: "demand", operation: "solve", result_status: "OPTIMAL",
    }]]);
    await page.evaluate(() => { window.analyticsEvents = []; });
    await page.goto(base + "demo/#feature-list");
    await page.getByRole("link", {name: "必要人数に合わせる", exact: true}).waitFor();
    assert.equal(await page.locator("#feature-list a").count(), 3);
    for (const hash of ["json", "large", "records", "combined"]) {
      await page.goto(base + "demo/#" + hash);
      await page.locator("#feature-list [role=status]").filter({hasText: "準備中"}).waitFor();
      assert.equal(await page.locator('input[type="file"], textarea').count(), 0);
    }
    await page.goto(base + "demo/#demand");
    await page.locator("#feature-status").filter({hasText: "OPTIMAL"}).waitFor({timeout: 45000});
    assert.deepEqual(await page.evaluate(() => window.analyticsEvents), []);
    await checkFocusContrast(page, "button.primary");
    await page.locator("#feature-number").fill("4");
    await page.getByRole("button", {name: "再計算", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "PARTIAL"}).waitFor({timeout: 45000});
    assert.match(await page.locator("#feature-output").innerText(), /60人分/);
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({colorScheme});
      const contrast = await page.locator(".feature-shortage-locations").evaluate(element => {
        const luminance = color => {
          const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            value /= 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const foreground = luminance(getComputedStyle(element).color);
        const background = luminance(getComputedStyle(document.querySelector(".feature-result-panel")).backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      assert(contrast >= 4.5, `${colorScheme}: shortage text contrast ${contrast}`);
    }
    await page.emulateMedia({colorScheme: "light"});
    assert.deepEqual(await page.evaluate(() => window.analyticsEvents), [["event", "demo_run_success", {
      lesson_id: "demand", operation: "solve", result_status: "PARTIAL",
    }]]);
    await page.goto(base + "demo/#consecutive_days");
    await page.locator("#feature-status").filter({hasText: "OPTIMAL"}).waitFor({timeout: 45000});
    await page.locator("#feature-number").fill("3");
    await page.getByRole("button", {name: "再計算", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "OPTIMAL"}).waitFor({timeout: 45000});
    await page.evaluate(() => { window.analyticsEvents = []; });
    await page.goto(base + "demo/#verify");
    await page.locator("#feature-status").filter({hasText: "VALID ·"}).waitFor({timeout: 45000});
    await page.locator("#feature-kitchen").selectOption("bob");
    await page.getByRole("button", {name: "再検証", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "INVALID_PLAN"}).waitFor({timeout: 45000});
    assert.deepEqual(await page.evaluate(() => window.analyticsEvents), []);
    await page.locator("#feature-kitchen").selectOption("alice");
    await page.getByRole("button", {name: "再検証", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "VALID ·"}).waitFor({timeout: 45000});
    assert.deepEqual(await page.evaluate(() => window.analyticsEvents), [["event", "demo_run_success", {
      lesson_id: "verify", operation: "verify", result_status: "VALID",
    }]]);
    await page.emulateMedia({reducedMotion: "reduce"});
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({width, height: 900});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
      if (width < 700) {
        await page.getByRole("button", {name: "結果を見る", exact: true}).click();
        assert(await page.locator("#feature-status").evaluate(element => element === document.activeElement));
        assert(await page.locator("#feature-result").evaluate(element => element.getBoundingClientRect().top < 200));
      }
    }
    await page.goto(base + "docs/");
    await page.getByRole("link", {name: "公開APIとエラー処理（Markdown） ↗"}).waitFor();
    assert.equal(await page.getByRole("link", {name: "the3合同会社の製品"}).getAttribute("href"), "https://the3.co.jp/");
    await page.keyboard.press("Tab");
    assert(await page.locator(".skip-link").evaluate(element => element === document.activeElement));
    await page.keyboard.press("Enter");
    assert.equal(new URL(page.url()).hash, "#main");
    await checkFocusContrast(page, ".site-header a.button");
    const destination = path.resolve("test-results/public-demo");
    await fs.mkdir(destination, {recursive: true});
    await page.screenshot({path: path.join(destination, "guide.png"), fullPage: true});
    if (process.env.COMPANY_SITE_DIR) {
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({colorScheme});
        let reference;
        for (const url of [base, base + "demo/", base + "docs/"]) {
          await page.goto(url);
          if (url.endsWith("demo/")) await page.waitForFunction(() => feature?.current && !featureController);
          const style = await page.evaluate(() => {
            const body = getComputedStyle(document.body), header = getComputedStyle(document.querySelector(".the3-site-header"));
            const button = getComputedStyle(document.querySelector(".the3-button"));
            const probe = document.body.appendChild(document.createElement("input"));
            probe.type = "text";
            probe.disabled = true;
            const field = getComputedStyle(probe);
            const control = {background: field.backgroundColor, ink: field.color, radius: field.borderRadius, minHeight: field.minHeight, opacity: field.opacity};
            probe.remove();
            return {background: body.backgroundColor, ink: body.color, font: body.fontFamily, lineHeight: body.lineHeight, headerBackground: header.backgroundColor, headerInk: header.color, buttonBackground: button.backgroundColor, buttonInk: button.color, radius: button.borderRadius, control};
          });
          reference ||= style;
          assert.deepEqual(style, reference, `${colorScheme}: ${url}`);
          for (const width of [320, 390, 1440]) {
            await page.setViewportSize({width, height: 900});
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${colorScheme}: ${url} / ${width}`);
          }
          await page.screenshot({path: path.join(destination, `${colorScheme}-${url.endsWith("demo/") ? "demo" : url.endsWith("docs/") ? "docs" : "company"}.png`), fullPage: true});
        }
      }
      await page.goto(base);
      await page.getByRole("link", {name: "必要人数のデモを試す", exact: true}).click();
      await page.locator("#feature-status").filter({hasText: "OPTIMAL"}).waitFor({timeout: 45000});
      await page.getByRole("link", {name: "shift-schedula ホーム"}).click();
      await page.getByRole("heading", {name: "シフト作成を、自社の業務に。"}).waitFor();
      await page.getByRole("link", {name: "技術案内・利用方法を見る"}).click();
      await page.getByRole("link", {name: "導入を相談する", exact: false}).first().click();
      assert.equal(new URL(page.url()).pathname, "/products/schedula/");
      assert.equal(new URL(page.url()).hash, "#contact");
    }
    assert.deepEqual(failures, []);
    const allowed = process.env.COMPANY_SITE_DIR ? new URL(base).origin + "/" : base;
    assert(requests.every(url => url.startsWith(allowed)), requests.filter(url => !url.startsWith(allowed)));
    if (process.env.COMPANY_SITE_DIR) await page.screenshot({path: path.join(destination, "company-contact.png"), fullPage: true});
    console.log("Public demo prefix, body hashes, three lessons, docs and mobile checks passed");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
    await once(server, "exit").catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
