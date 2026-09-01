import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 1400, height: 1300 } })).newPage();
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("https://veela-one.vercel.app/map", { waitUntil: "networkidle" });
await p.waitForTimeout(12000);
const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
for (const k of ["Median household rent", "Rent as share of income", "Households in public rental",
                 "New private homes expected", "IN 2025", "IN 2026"])
  console.log((t.includes(k) ? "ok   " : "MISS ") + k);
console.log("[object Object]:", t.includes("[object Object]"));
console.log("raw RVD url    :", t.includes("https://www.rvd.gov.hk/datagovhk/Dom_Completions"));
console.log("console errors :", errs.length, errs.slice(0, 2));
await p.screenshot({ path: "/tmp/prod-map.png" });
await b.close();
