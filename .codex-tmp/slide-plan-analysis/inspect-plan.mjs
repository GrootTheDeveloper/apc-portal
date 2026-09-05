import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "F:\\github-project\\apc-web-portal\\APC-Portal-Ke-hoach-cong-viec.xlsx";
const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 10,
  tableMaxCols: 18,
  tableMaxCellChars: 160,
});
console.log("=== OVERVIEW ===");
console.log(overview.ndjson);

const sheets = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 8000,
});
console.log("=== SHEETS ===");
console.log(sheets.ndjson);

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange(true);
  const address = used?.address ?? "A1";
  console.log(`=== SHEET ${sheet.name} USED ${address} ===`);
  const region = await workbook.inspect({
    kind: "region",
    sheetId: sheet.name,
    range: address,
    maxChars: 24000,
    tableMaxRows: 200,
    tableMaxCols: 30,
    tableMaxCellChars: 220,
  });
  console.log(region.ndjson);
}
