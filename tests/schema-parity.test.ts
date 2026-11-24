// SQLite and Postgres schemas must describe the same tables and columns.
import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import * as lite from "@/db/schema.sqlite";
import * as pg from "@/db/schema.pg";

function describeSchema(mod: Record<string, unknown>) {
  const out: Record<string, Record<string, { notNull: boolean; type: string }>> = {};
  for (const v of Object.values(mod)) {
    if (!is(v, Table)) continue;
    const cols: Record<string, { notNull: boolean; type: string }> = {};
    for (const c of Object.values(getTableColumns(v))) cols[c.name] = { notNull: c.notNull, type: c.dataType };
    out[getTableName(v)] = cols;
  }
  return out;
}

describe("schema parity", () => {
  it("sqlite and postgres schemas match", () => {
    expect(describeSchema(pg)).toEqual(describeSchema(lite));
  });
});
