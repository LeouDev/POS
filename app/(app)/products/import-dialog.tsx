"use client";

import { CircleAlert, CircleCheck, Download, FileUp } from "lucide-react";
import { useState, useTransition, type ChangeEvent } from "react";
import { Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { safeCall } from "@/lib/actions";
import { readImportFile, templateCsv, type ImportLine } from "@/lib/product-import";
import { importProducts } from "./actions";

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv())}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ImportProductsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <FileUp aria-hidden size={16} /> Import CSV
      </button>
      {open && <ImportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<{ name: string; lines: ImportLine[]; error?: string } | null>(null);
  const ready = file?.lines.filter((l) => l.row) ?? [];
  const problems = file?.lines.filter((l) => l.error) ?? [];

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (!chosen) return setFile(null);
    if (chosen.size > 2_000_000) return setFile({ name: chosen.name, lines: [], error: "That file is over 2 MB." });
    setFile({ name: chosen.name, ...readImportFile(await chosen.text()) });
  }

  function importNow() {
    startTransition(async () => {
      const result = await safeCall(() => importProducts(ready.map((l) => l.row)));
      if (!result.ok) return toast(result.error, "error");
      const { imported, skipped } = result.data;
      const skippedNote = skipped.length ? ` Skipped ${plural(skipped.length, "product")} already in your list.` : "";
      toast(`Imported ${plural(imported, "product")}.${skippedNote}`, imported ? "success" : "error");
      onClose();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!pending}
      title="Import products"
      width={560}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn-default" onClick={importNow} disabled={pending || !ready.length}>
            {pending ? "Importing…" : ready.length ? `Import ${plural(ready.length, "product")}` : "Import"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Download the template, or use your own sheet with the columns <b>Name</b>, <b>SKU</b>, <b>Category</b>,{" "}
            <b>Price</b>, <b>Cost</b>, <b>Stock</b> and <b>Low stock alert</b>. Only Name and Price are required.
          </li>
          <li>
            Fill in one product per row and save it as CSV. In Excel: File, Save As, <b>CSV UTF-8</b>. In Google
            Sheets: File, Download, <b>CSV</b>.
          </li>
          <li>Choose the file below, check the list, then import.</li>
        </ol>
        <a href={TEMPLATE_HREF} download="kassix-products-template.csv" className="btn self-start">
          <Download aria-hidden size={16} /> Download template
        </a>
        <label className="flex flex-col gap-1">
          <span className="font-bold">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={choose} disabled={pending} className="field" />
        </label>

        {file?.error && (
          <p role="alert" className="flex items-start gap-2 border border-brand bg-[#fff0f0] p-2">
            <CircleAlert aria-hidden size={18} className="flex-none text-brand" /> {file.error}
          </p>
        )}
        {file && !file.error && (
          <div role="status" className="flex flex-col gap-2">
            <p className="flex items-center gap-2">
              <CircleCheck aria-hidden size={18} className="flex-none text-ok" />
              {plural(ready.length, "product")} ready to import
              {problems.length > 0 && `, ${problems.length} to fix`}. Products already in KASSIX (same SKU, or same
              name without a SKU) are skipped, so importing the same file twice is safe.
            </p>
            {problems.length > 0 && (
              <div className="sunken max-h-48 overflow-auto">
                <table className="listview">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Product</th>
                      <th>What to fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((p) => (
                      <tr key={p.line}>
                        <td className="tabular-nums">{p.line}</td>
                        <td>{p.name || "(no name)"}</td>
                        <td className="text-brand">{p.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {problems.length > 0 && ready.length > 0 && (
              <p>Rows to fix are left out. Fix them in your file and import it again later; it won&apos;t duplicate the rest.</p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
