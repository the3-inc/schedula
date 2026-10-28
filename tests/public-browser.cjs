const assert = require("node:assert/strict");
require("./analytics.cjs");
const {spawn} = require("node:child_process");
const {once} = require("node:events");
const path = require("node:path");
const fs = require("node:fs/promises");
const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

async function checkFocusContrast(page, selector) {
  const control = page.locator(selector).first();
  await page.waitForFunction(selector => !document.querySelector(selector).matches(":disabled"), selector);
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
    const destination = path.resolve("test-results/public-demo");
    await fs.mkdir(destination, {recursive: true});
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
    await page.waitForFunction(() => !featureController);
    const previousTable = await page.locator(".feature-coverage").innerText();
    const previousHeight = await page.locator("#feature-result").evaluate(element => element.getBoundingClientRect().height);
    for (const count of ["4", "5"]) {
      await page.locator("#feature-number").fill(count);
      assert.match(await page.locator(".feature-stale-notice").innerText(), /前回の結果.*変更は未反映/);
      assert.equal(await page.locator(".feature-coverage").innerText(), previousTable);
      assert.match(await page.locator(".feature-summary").innerText(), /前回\s*3人/);
      assert.doesNotMatch(await page.locator(".feature-summary").innerText(), /現在/);
      assert.equal(await page.evaluate(() => feature.current), null);
      assert.equal(await page.evaluate(() => feature.previous.input.demand.find(item => item.id === "hall_2").required_people), 3);
      assert(await page.locator("#feature-result").evaluate((element, height) => element.getBoundingClientRect().height >= height, previousHeight));
    }
    await page.route("**/api/solve-json", route => route.fulfill({status: 503, json: {error: {code: "BUSY", message: "計算中"}}}));
    await page.locator("#feature-run").click();
    await page.locator("#feature-status").filter({hasText: "BUSY"}).waitFor();
    assert.equal(await page.locator(".feature-coverage").innerText(), previousTable);
    assert(await page.locator(".feature-stale-notice").isVisible());
    await page.unroute("**/api/solve-json");
    await page.locator("#feature-run").click();
    await page.waitForFunction(() => feature.current && !featureController);
    assert.equal(await page.locator("#feature-output[data-stale]").count(), 0);
    assert.equal(await page.locator(".feature-stale-notice").count(), 0);
    assert.equal(await page.evaluate(() => feature.current.input.demand.find(item => item.id === "hall_2").required_people), 5);
    await page.locator("#feature-restore").click();
    assert.equal(await page.locator("#feature-number").inputValue(), "2");
    assert.equal(await page.locator(".feature-stale-notice").count(), 0);
    await page.evaluate(() => { window.analyticsEvents = []; });
    await page.goto(base + "demo/#feature-list");
    await page.getByRole("link", {name: "必要人数に合わせる", exact: true}).waitFor();
    assert.equal(await page.locator("#feature-list a").count(), 3);
    assert.deepEqual(await page.locator("#feature-list h3").allTextContents(), ["担当配置と勤務の基本", "守る勤務条件", "診断と入力の扱い"]);
    assert.equal(await page.locator("#feature-list .feature-cards:empty").count(), 0);
    assert.doesNotMatch(await page.locator("#feature-list").innerText(), /人分/);
    assert.equal(await page.locator('.demo-nav a[href="#feature-list"]').innerText(), "公開中のデモ");
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
    assert.match(await page.locator(".feature-input-changes").textContent(), /未反映の変更 · 1項目/);
    assert.match(await page.locator(".feature-input-changes").textContent(), /ホールの必要人数：2 → 4/);
    assert.doesNotMatch(await page.locator(".feature-input-changes").textContent(), /hall_[23]/);
    await page.getByRole("button", {name: "再計算", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "PARTIAL"}).waitFor({timeout: 45000});
    assert.match(await page.locator("#feature-output").innerText(), /60人・分/);
    assert.match(await page.locator(".feature-overview h3").innerText(), /調理が1人不足（12:00〜13:00）/);
    assert.equal(await page.locator(".feature-shortage-locations li").count(), 0);
    const merged = await page.evaluate(() => {
      const original = structuredClone(feature.current.response.shortage_summary.shortages);
      const pair = structuredClone(feature.current);
      pair.response.shortage_summary.shortages = [
        {role_id: "hall", missing_people: 1, interval: {start: "10:00", end: "10:30"}},
        {role_id: "kitchen", missing_people: 1, interval: {start: "10:00", end: "10:30"}},
        {role_id: "hall", missing_people: 1, interval: {start: "10:30", end: "11:00"}},
        {role_id: "hall", missing_people: 2, interval: {start: "11:00", end: "11:30"}},
        {role_id: "hall", missing_people: 2, interval: {start: "12:00", end: "12:30"}},
      ];
      const input = JSON.stringify(pair);
      const result = featureShortages(pair);
      return {result, unchanged: input === JSON.stringify(pair), originalUnchanged: JSON.stringify(original) === JSON.stringify(feature.current.response.shortage_summary.shortages)};
    });
    assert.equal(merged.result.length, 4);
    assert.deepEqual(merged.result[0].interval, {start: "10:00", end: "11:00"});
    assert(merged.unchanged && merged.originalUnchanged);
    const separate = await page.evaluate(() => {
      const input = structuredClone(feature.input);
      input.demand.find(item => item.id === "hall_3").required_people = 5;
      return featureChanges(lesson.editable_fields, feature.initial, input);
    });
    assert.equal(separate.length, 2);
    assert(separate.some(text => text.includes("2 → 4")) && separate.some(text => text.includes("2 → 5")));
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({colorScheme});
      for (const selector of [".feature-warning", ".feature-metric.shortage > .note"]) {
        const contrast = await page.locator(selector).evaluate(element => {
          const luminance = color => {
            const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
              value /= 255;
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          const foreground = luminance(getComputedStyle(element).color);
          const background = luminance(getComputedStyle(element.closest(".shortage, .feature-warning")).backgroundColor);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
        assert(contrast >= 4.5, `${colorScheme}: ${selector} contrast ${contrast}`);
      }
      await page.screenshot({path: path.join(destination, `${colorScheme}-shortage.png`), fullPage: true});
    }
    await page.emulateMedia({colorScheme: "light"});
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({width, height: 844});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `shortage overflow at ${width}`);
    }
    await page.setViewportSize({width: 1280, height: 720});
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
    assert(await page.locator(".feature-stale-notice").isVisible());
    assert.match(await page.locator("#feature-output").innerText(), /前回検証した編集案/);
    assert.equal(await page.locator("#feature-kitchen").getAttribute("aria-invalid"), "false");
    await page.getByRole("button", {name: "再検証", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "INVALID_PLAN"}).waitFor({timeout: 45000});
    assert.equal(await page.locator(".feature-stale-notice").count(), 0);
    assert.equal(await page.locator("#feature-output tbody tr.feature-violation").count(), 2);
    assert.equal(await page.locator("#feature-kitchen").getAttribute("aria-invalid"), "true");
    assert.equal(await page.locator("#feature-kitchen").getAttribute("aria-describedby"), "feature-kitchen-error");
    assert.match(await page.locator("#feature-kitchen-error").innerText(), /初期のAliceへ戻して、再検証/);
    await page.screenshot({path: path.join(destination, "verify-conflict.png"), fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path: path.join(destination, "verify-conflict-mobile.png"), fullPage: true});
    await page.setViewportSize({width: 1280, height: 720});
    assert.deepEqual(await page.evaluate(() => window.analyticsEvents), []);
    await page.locator("#feature-kitchen").selectOption("alice");
    assert.equal(await page.locator("#feature-kitchen-error").isVisible(), false);
    assert.equal(await page.locator("#feature-kitchen").getAttribute("aria-invalid"), "false");
    await page.getByRole("button", {name: "再検証", exact: true}).click();
    await page.locator("#feature-status").filter({hasText: "VALID ·"}).waitFor({timeout: 45000});
    assert.equal(await page.locator("#feature-output tbody tr.feature-violation").count(), 0);
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
    await page.setViewportSize({width: 1280, height: 1800});
    const footer = await page.locator("footer").evaluate(element => ({
      bottom: element.getBoundingClientRect().bottom,
      top: element.getBoundingClientRect().top,
      mainBottom: document.querySelector("main").getBoundingClientRect().bottom,
      viewport: innerHeight,
    }));
    assert(Math.abs(footer.bottom - footer.viewport) <= 1, JSON.stringify(footer));
    assert(footer.top >= footer.mainBottom - 1, JSON.stringify(footer));
    await page.screenshot({path: path.join(destination, "footer-tall.png"), fullPage: true});
    await page.setViewportSize({width: 1280, height: 720});
    assert(await page.locator("footer").evaluate(element => element.getBoundingClientRect().top >= document.querySelector("main").getBoundingClientRect().bottom - 1));
    await page.goto(base + "docs/");
    await page.getByRole("link", {name: "公開APIとエラー処理（Markdown） ↗"}).waitFor();
    assert.equal(await page.getByRole("link", {name: "the3合同会社の製品"}).getAttribute("href"), "https://the3.co.jp/");
    await page.keyboard.press("Tab");
    assert(await page.locator(".skip-link").evaluate(element => element === document.activeElement));
    await page.keyboard.press("Enter");
    assert.equal(new URL(page.url()).hash, "#main");
    await checkFocusContrast(page, ".site-header a.button");
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
