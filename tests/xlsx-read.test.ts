import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { readXlsx, colLetter } from "@/lib/xlsx-read";
import { mapExportRows, EXPORT_COLUMNS } from "@/adapters/rmi";

// Builds a tiny xlsx in RMI's style: "x:"-prefixed tags, shared strings, and an omitted empty cell.
function rmiStyleXlsx(rows: (string | null)[][]): Uint8Array {
  const strings: string[] = [];
  const idx = (s: string) => (strings.includes(s) ? strings.indexOf(s) : strings.push(s) - 1);
  const sheetRows = rows
    .map((r, i) => {
      const cells = r
        .map((v, j) => (v === null ? "" : `<x:c r="${colLetter(j + 1)}${i + 1}" t="s"><x:v>${idx(v)}</x:v></x:c>`))
        .join("");
      return `<x:row r="${i + 1}">${cells}</x:row>`;
    })
    .join("");
  const ns = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  return zipSync({
    "xl/workbook.xml": strToU8(`<x:workbook ${ns}><x:sheets><x:sheet name="Report" sheetId="2"/></x:sheets></x:workbook>`),
    "xl/sharedStrings.xml": strToU8(`<x:sst ${ns}>${strings.map((s) => `<x:si><x:t>${s.replace(/&/g, "&amp;")}</x:t></x:si>`).join("")}</x:sst>`),
    "xl/worksheets/sheet1.xml": strToU8(`<x:worksheet ${ns}><x:sheetData>${sheetRows}</x:sheetData></x:worksheet>`),
  });
}

describe("RMI xlsx reader", () => {
  it("places cells by reference even when empty cells are omitted", () => {
    const header = EXPORT_COLUMNS.map(([, h]) => h);
    const row = header.map((_, i) => (i === 10 ? null : `v${i}`)); // Franchise Type (K) blank
    row[0] = "WZ1/GOA/1";
    row[4] = "A & B Tiles";
    const sheet = readXlsx(rmiStyleXlsx([header, row]));
    expect(sheet.sheetName).toBe("Report");
    const [r] = mapExportRows(sheet.header, sheet.rows);
    expect(r.refNo).toBe("WZ1/GOA/1");
    expect(r.dealerName).toBe("A & B Tiles");
    expect(r.franchiseType).toBeNull();
    expect(r.displayedWhere).toBe("v11");
    expect(r.status).toBe("v20");
  });

  it("refuses an export whose header changed", () => {
    const header = EXPORT_COLUMNS.map(([, h]) => h);
    header[5] = "Dealer State";
    const sheet = readXlsx(rmiStyleXlsx([header]));
    expect(() => mapExportRows(sheet.header, sheet.rows)).toThrow(/header changed/);
  });

  const sample = "reference/Display Tracker Report - Aug-2026.xlsx";
  it.skipIf(!existsSync(sample))("reads the real Aug-2026 sample (831 rows, 51 columns)", () => {
    const s = readXlsx(new Uint8Array(readFileSync(sample)));
    expect(s.sheetName).toBe("Report");
    expect(s.rows).toHaveLength(831);
    expect(Object.keys(s.header)).toHaveLength(51);
    expect(s.header.V).toBe("Jul-26 Sales Volume");
    expect(s.header.AY).toBe("Avg Sales Value");
  });
});
