import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../lib/csv";
import { planImport, readImportFile, templateCsv } from "../lib/product-import";
import { salesCsv } from "../lib/sales";

test("CSV reads what Excel and Google Sheets write", () => {
  const text = '﻿Name,Note\r\n"Coke, 1.5L","He said ""hi""\nthen left"\r\n\r\n,\r\nBread,plain\n';
  assert.deepEqual(parseCsv(text), [
    ["Name", "Note"],
    ["Coke, 1.5L", 'He said "hi"\nthen left'],
    ["Bread", "plain"],
  ]);
  assert.deepEqual(parseCsv("a,b"), [["a", "b"]]); // no trailing newline
});

test("CSV output is spreadsheet-safe", () => {
  const out = toCsv([
    ["R-1", 'a "b"', "x,y", "=HYPERLINK(1)", "-2+3", "@cmd"],
    [-5, 12.5, null, "", "line\nbreak", "ok"],
  ]);
  assert.ok(out.startsWith("﻿"));
  assert.equal(
    out,
    '﻿R-1,"a ""b""","x,y",\'=HYPERLINK(1),\'-2+3,\'@cmd\r\n-5,12.5,,,"line\nbreak",ok\r\n',
  );
});

test("import: the template reads back as ready products", () => {
  const { lines, error } = readImportFile(templateCsv());
  assert.equal(error, undefined);
  assert.deepEqual(
    lines.map((l) => l.row),
    [
      { name: "Iced Coffee", sku: "DRK-001", category: "Drinks", price: 120, cost: 45, stockQuantity: 40, lowStockThreshold: 10 },
      { name: "Pandesal (10 pcs)", sku: "", category: "Bakery", price: 50, cost: 20, stockQuantity: 20, lowStockThreshold: 5 },
    ],
  );
});

test("import: owners' own sheets, peso amounts, and rows to fix", () => {
  const { lines } = readImportFile(
    [
      "Product Name,Barcode,Selling Price,Qty,Unit Cost",
      '"Tuna Sandwich",480001,"₱1,234.50",12,PHP 60',
      "Plain Water,,25,,",
      ",,10,1,1",
      "Kape,480002,,5,1",
      "Candy,480003,5,2.5,1",
      "Gum,480001,5,1,1",
    ].join("\n"),
  );
  assert.deepEqual(lines[0].row, {
    name: "Tuna Sandwich", sku: "480001", category: "", price: 1234.5, cost: 60, stockQuantity: 12, lowStockThreshold: 5,
  });
  assert.deepEqual(lines[1].row, {
    name: "Plain Water", sku: "", category: "", price: 25, cost: 0, stockQuantity: 0, lowStockThreshold: 5,
  });
  assert.deepEqual(
    lines.slice(2).map((l) => [l.line, l.error]),
    [
      [4, "Enter a product name"],
      [5, "Enter a selling price"],
      [6, "Whole numbers only"],
      [7, "Same SKU as row 2"],
    ],
  );
  assert.match(readImportFile("Title,Amount\nx,1").error ?? "", /Name and a Price column/);
  assert.match(readImportFile("").error ?? "", /empty/);
  const tooMany = ["name,price", ...Array.from({ length: 1001 }, (_, i) => `P${i},1`)].join("\n");
  assert.match(readImportFile(tooMany).error ?? "", /at most 1000/);
});

test("import: products already in KASSIX are skipped, so re-importing is safe", () => {
  const row = (name: string, sku = "") => ({ name, sku, category: "", price: 1, cost: 0, stockQuantity: 0, lowStockThreshold: 5 });
  const { create, skipped } = planImport(
    [row("Coke", "CK-1"), row("Sprite", "ck-1b"), row("bread"), row("Cake"), row("Coke", "CK-2"), row("Cake")],
    [{ name: "Coca Cola", sku: "ck-1" }, { name: "Bread", sku: null }],
  );
  assert.deepEqual(create.map((r) => r.name), ["Sprite", "Cake", "Coke"]);
  assert.deepEqual(skipped, [
    { name: "Coke", reason: "SKU CK-1 is already in your products" },
    { name: "bread", reason: "already in your products" },
    { name: "Cake", reason: "already in your products" },
  ]);
});

test("sales export: one row per sale with its products, in the business's timezone, profit as in Reports", () => {
  const csv = salesCsv(
    [
      {
        receipt_number: "R-000012",
        created_at: "2026-09-29T16:30:00Z", // 00:30 on Sep 30 in Manila
        subtotal: 250,
        discount: 10,
        tax: 28.8,
        total: 268.8,
        payment_method: "gcash",
        status: "completed",
        sale_items: [
          { product_name: "Ensaymada", quantity: 1, unit_cost: 20.55 },
          { product_name: "Iced Coffee", quantity: 2, unit_cost: 45 },
        ],
      },
      {
        receipt_number: "R-000013",
        created_at: "2026-09-30T02:05:00Z",
        subtotal: 50,
        discount: 0,
        tax: 0,
        total: 50,
        payment_method: "cash",
        status: "voided",
        sale_items: [{ product_name: "Coke, 1.5L", quantity: 1, unit_cost: 20 }],
      },
    ],
    "Asia/Manila",
    "PHP",
  );
  assert.equal(
    csv,
    "﻿" +
      [
        "Receipt no.,Date,Time,Products,Items,Subtotal (PHP),Discount (PHP),Tax (PHP),Total (PHP),Cost (PHP),Profit (PHP),Payment,Status",
        "R-000012,2026-09-30,00:30,1 x Ensaymada; 2 x Iced Coffee,3,250,10,28.8,268.8,110.55,129.45,GCash,Completed",
        'R-000013,2026-09-30,10:05,"1 x Coke, 1.5L",1,50,0,0,50,20,30,Cash,Voided',
      ].join("\r\n") +
      "\r\n",
  );
});
