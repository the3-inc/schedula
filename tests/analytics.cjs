const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../demo/analytics.js"), "utf8");
for (const [origin, id, count] of [
  ["https://the3.co.jp", "G-TEST123", 1],
  ["http://localhost:4321", "G-TEST123", 0],
  ["https://preview.example.com", "G-TEST123", 0],
  ["https://the3.co.jp", "bad", 0],
]) {
  const scripts = [], window = {};
  const context = {window, URL, location: {origin, pathname: "/products/schedula/demo/", search: "?secret=private", hash: "#demand"}, document: {
    currentScript: {dataset: {ga4Id: id}}, referrer: "https://example.com/page?secret=private#fragment",
    createElement: () => ({}), head: {append: script => scripts.push(script)},
  }};
  vm.runInNewContext(source, context);
  vm.runInNewContext(source, context);
  assert.equal(scripts.length, count);
  if (count) {
    assert.equal(window.dataLayer.length, 3);
    assert.equal(window.dataLayer[0][1].page_location, "https://the3.co.jp/products/schedula/demo/");
    assert.equal(window.dataLayer[0][1].page_referrer, "https://example.com/page");
    assert.equal(window.dataLayer[2][0], "config");
    assert.equal(window.dataLayer[2][1], id);
    assert.equal(window.dataLayer[2][2].allow_google_signals, false);
  }
}
console.log("GA4 production host, URL redaction and duplicate guards passed");
