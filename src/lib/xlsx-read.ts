// Tiny reader for the .xlsx files the RMI API returns.
// RMI writes them with the OpenXML SDK using "x:"-prefixed tags (<x:row>, <x:c>), which ExcelJS cannot read.
// Cells are placed by their reference (e.g. "K12") because empty cells are omitted from the XML.
import { unzipSync, strFromU8 } from "fflate";

export type SheetRow = Record<string, string>; // column letter -> text value

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENTITIES[e.toLowerCase()];
  });
}

const P = "(?:\\w+:)?"; // optional namespace prefix

function textOf(xml: string): string {
  // Concatenate all <t> runs (handles rich text in shared strings).
  const re = new RegExp(`<${P}t(?:\\s[^>]*)?>([\\s\\S]*?)</${P}t>`, "g");
  let out = "";
  for (const m of xml.matchAll(re)) out += m[1];
  return decode(out);
}

export interface ParsedSheet {
  sheetName: string;
  header: SheetRow; // row 1
  rows: SheetRow[]; // rows 2..n
}

export function readXlsx(data: Uint8Array): ParsedSheet {
  const files = unzipSync(data);
  const get = (name: string) => (files[name] ? strFromU8(files[name]) : undefined);

  const shared: string[] = [];
  const ss = get("xl/sharedStrings.xml");
  if (ss) for (const m of ss.matchAll(new RegExp(`<${P}si>([\\s\\S]*?)</${P}si>`, "g"))) shared.push(textOf(m[1]));

  const wb = get("xl/workbook.xml") ?? "";
  const sheetName = decode(wb.match(new RegExp(`<${P}sheet\\s[^>]*name="([^"]+)"`))?.[1] ?? "");

  const sheetPath = Object.keys(files).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  if (!sheetPath) throw new Error("xlsx: no worksheet found");
  const sheet = get(sheetPath)!;

  const byRow = new Map<number, SheetRow>();
  const rowRe = new RegExp(`<${P}row\\b[^>]*>([\\s\\S]*?)</${P}row>`, "g");
  const cellRe = new RegExp(`<${P}c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}c>)`, "g");
  for (const rm of sheet.matchAll(rowRe)) {
    for (const cm of rm[1].matchAll(cellRe)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+)(\d+)"/);
      if (!ref) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const inner = cm[2] ?? "";
      let value: string;
      if (type === "inlineStr") value = textOf(inner);
      else {
        const v = inner.match(new RegExp(`<${P}v>([\\s\\S]*?)</${P}v>`))?.[1];
        if (v === undefined) continue;
        value = type === "s" ? (shared[+v] ?? "") : decode(v);
      }
      const rowNo = +ref[2];
      if (!byRow.has(rowNo)) byRow.set(rowNo, {});
      byRow.get(rowNo)![ref[1]] = value;
    }
  }
  const rowNos = [...byRow.keys()].sort((a, b) => a - b);
  const header = byRow.get(1) ?? {};
  return { sheetName, header, rows: rowNos.filter((n) => n > 1).map((n) => byRow.get(n)!) };
}

export function colLetter(index1: number): string {
  let s = "";
  for (let n = index1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
