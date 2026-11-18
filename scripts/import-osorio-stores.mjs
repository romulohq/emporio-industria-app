// Importa as lojas e os estoques mínimos de congelados (Pedidos Osório) das planilhas "CONGELADOS EDP" e "CONGELADOS - CAFÉ".
// Uso: node scripts/import-osorio-stores.mjs "<planilha EDP.xlsx>" "<planilha CAFÉ.xlsx>" [--apply]
// Sem --apply só mostra o que seria feito (nada é gravado).
// Cada planilha tem uma aba por loja: a coluna "ESTOQUE MÍNIMO" traz o mínimo de cada produto, em pacotes (PCT).
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
process.loadEnvFile(".env.local");
const { default: readXlsxFile } = await import("read-excel-file/node");
const { Client } = require("pg");

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");
if (files.length < 1) {
  console.error('Uso: node scripts/import-osorio-stores.mjs "<EDP.xlsx>" "<CAFÉ.xlsx>" [--apply]');
  process.exit(1);
}

const clean = (c) => (c == null ? "" : String(c).replace(/\s+/g, " ").trim());
const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(PCT|PACT|PTC)\b/g, " ")
    .replace(/[^A-Z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// nome na planilha (normalizado) -> nome do produto no cadastro da Fábrica Osório
const PRODUCT = {
  "COXINHA DE FRANGO": "COXINHA DE FRANGO",
  "COXINHA DE FRANGO CATUPIRY": "COXINHA DE FRANGO C/ CATUPIRY",
  "COXINHA DE FRANGO CAT": "COXINHA DE FRANGO C/ CATUPIRY",
  "COXINHA DE CARNE DE SOL": "COXINHA DE CARNE DO SOL",
  "COXINHA CARNE DE SOL": "COXINHA DE CARNE DO SOL",
  "EMPADA DE FRANGO": "EMPADA DE FRANGO",
  "EMPADA DE FRANGO CATUPIRY": "EMPADA DE FRANGO CATUPIRY",
  "EMPAD DE FRANGO CATUPIRY": "EMPADA DE FRANGO CATUPIRY",
  "EMPADA DE FRANGO CAT": "EMPADA DE FRANGO CATUPIRY",
  "EMPADA DE CARNE DE SOL": "EMPADA DE CARNE DO SOL",
  CROISSANT: "CROISSAINT",
  "PAO DE QUEIJO GRANDE": "PAO DE QUEIJO GRANDE",
  "PAO DE QUEIJO G C/PARMESAO": "PÃO DE QUEIJO GRANDE COM PARMESÃO",
  "PAO DE QUEIJO PEQUENO": "PAO DE QUEIJO PEQUENO",
  "ESFIRRA DE FRANGO": "ESFIRRA DE FRANGO",
  "ESFIRRA DE CARNE": "ESFIRRA DE CARNE",
  "ESFIRRA DE QUEIJO": "ESFIRRA DE QUEIJO",
  "FOLHEADO DE FRANGO": "FOLHEADO FRANGO COM BACON",
  "FOLHEADO DE FRANGO COM BACON": "FOLHEADO FRANGO COM BACON",
  "FOLHEADO DE SALSICHA": "FOLHEADO SALSICHA",
  ENROLADINHO: "ENROLADINHO DE SALSICHA",
  "ENROLADINHO DE SALSICHA": "ENROLADINHO DE SALSICHA",
  "MINI COXINHA": "MINI COXINHA",
  "MINI BOLINHA": "MINI BOLINHA DE QUEIJO",
  "MINI CROQUETE": "MINI CROQUETE",
  "MIN B. DE CARNE DE SOL": "MINI BOLINHA DE CARNE DE SOL",
  "MIN B DE CARNE DE SOL": "MINI BOLINHA DE CARNE DE SOL",
  "MINI BOLINHA DE CARNE DE SOL": "MINI BOLINHA DE CARNE DE SOL",
  "PAO FRANCES": "PÃO CARIOCA (pct 150 und/) *Estoque max",
  "PAO CARIOCA": "PÃO CARIOCA (pct 150 und/) *Estoque max",
  "PAO SOVADO": "PÃO SOVADO (pct 150 und/)",
  "PAO CARIOCA INTEGRAL": "PÃO INTEGRAL",
  BISNAGUINHA: "BISNAGUINHA (PCT)",
  BAGUETE: "BAGUETE (pct)",
  "PAO DE COCO CONGELADO": "PÃO DE COCO LAGOA (pct)",
  "SOPA DE CARNE": "SOPA DE CARNE (12 UND)",
  "CALDO DE CARNE MOIDA": "CALDO DE CARNE MOÍDA CX (12 UND)",
  "CALDO DE CARNE": "CALDO DE CARNE MOÍDA CX (12 UND)",
  "SOPA DE PEIXE": "SOPA DE PEIXE CX (12 UND)",
  "CALDO DE PEIXE": "SOPA DE PEIXE CX (12 UND)",
  CANJA: "CANJA CX (12 UND)",
  "MOLHO DA CASA": "MOLHO DA CASA",
  "MOLHO ESPECIAL": "MOLHO DA CASA",
  "MOLHO DOGUINHO": "MOLHO DOGUINHO CX (12 UND)",
  "RECHEIO DE FRANGO": "RECHEIO DE FRANGO",
  "RECHEIO CARNE DO SOL": "RECHEIO DE CARNE DE SOL",
  "RECHEIO DE CARNE DE SOL": "RECHEIO DE CARNE DE SOL",
  "RECHEIO CARNE MOIDA": "RECHEIO DE CARNE MOÍDA",
  "RECHEIO DE CARNE MOIDA": "RECHEIO DE CARNE MOÍDA",
  "PATE DE FRANGO": "PATÊ DE FRANGO(24 UND)",
  "PATE DE PRESUNTO": "PATÊ DE PRESUNTO CX (24 UND)",
  "PATE DE ALHO": "PATÊ DE ALHO CX (24 UND)",
  "PATE DE DE ALHO": "PATÊ DE ALHO CX (24 UND)",
  "MOLHO BOLONHESA": "MOLHO BOLONHESA",
  "MOLHO DE TOMATE": "MOLHO DE TOMATE",
  "MOLHO ERVAS FINA": "MOLHO ERVAS FINAS",
  "MOLHO ERVAS FINAS": "MOLHO ERVAS FINAS",
  "MOLHO DE LARANJA": "MOLHO DE LARANJA",
  "MOLOHO DE MADEIRA": "MOLHO MADEIRA",
  "MOLHO DE MADEIRA": "MOLHO MADEIRA",
  "MOLHO TTERIYAKI": "MOLHO TERIYAKI",
  "MOLHO TERIYAKI": "MOLHO TERIYAKI",
  "MOLHO BARBECUE": "MOLHO BARBECUE",
  "MOLHO BRANCO": "MOLHO BRANCO",
  "MOLHO DE ABACAXI CARAMELIZADO": "MOLHO DE ABACAXI CARAMELIZADO",
  "MOLHO MOSTARDA E MEL": "MOLHO DE MOSTARDA E MEL",
  "MOLHO DE MOSTARDA": "MOLHO DE MOSTARDA E MEL",
  "PURE DE BATATA": "PURÊ DE BATATA",
  "FRICASER DE FRANGO": "FRICASSÊ DE FRANGO",
  "FRICASER DDE FRANGO": "FRICASSÊ DE FRANGO",
  "BIFE DE CARNE GRELHADO": "BIFE DE CARNE",
  "BIFE DE CARNE GRALHADA": "BIFE DE CARNE",
  "ESTROGONOFE DE FRANGO": "STROGONOFFE DE FRANGO",
  "PALETA SUINA": "PALETA SUÍNA",
  "PEIXE EMPANADO": "PEIXE EMPANADO",
  "BOLINHA DE PEIXE": "BOLINHA DE PEIXE",
  "LINGUICA TOSCANA": "LINGUIÇA TOSCANA",
  "FRANGO EMPANADO": "FILÉ DE FRANGO EMPANADO",
  "COXA E SOBRE COXA DE FRANGO": "COXA E SOBRECOXA",
  "COXA SOBRE COXA DE FRANGO": "COXA E SOBRECOXA",
  "SUINO EMPANADO": "PALETA SUÍNA EMPANADA",
  "FRANGO GRELHADO": "FILÉ DE FRANGO GRELHADO",
  CUPIM: "CUPIM",
};
// não são mais produzidos: ficam fora do pedido
const DROPPED = new Set(["VATAPA", "KIBE TRADICIONAL"]);

// aba da planilha (normalizada) -> nome da loja
const STORE = {
  FATIMA: "Fátima", TIBURCIO: "Tibúrcio", "BARAO DO RIO BRANCO": "Barão do Rio Branco", "JOAO PESSOA": "João Pessoa",
  BENI: "Beni", "COMETA GUARARAPES": "Cometa Guararapes", "RUI BARBOSA": "Rui Barbosa", MARAPONGA: "Maraponga",
  MONDUBIM: "Mondubim", "JOAO XIII": "João XIII", TERRAZO: "Terrazo", EUSEBIO: "Eusébio", "GUARA EUSEBIO": "Guará Eusébio",
  "FRANCISCO SA": "Francisco Sá", JOVITA: "Jovita", KENNEDY: "Kennedy", "SAO PAULO": "São Paulo",
  "GUARA JACARECANGA": "Guará Jacarecanga", "GUARA IRACEMA": "Guará Iracema", "GUARA JOQUEI": "Guará Joquei",
  EDILSON: "Edilson", "WASHINGTON SOARES": "Washington Soares", "GUARA WASHINGTON SOARES": "Guará Washington",
  PASSARE: "Passaré", "GUARA LUCIANO": "Guará Luciano", "GUARA DUNAS": "Guará Dunas", "LAGO JACAREY": "Lago Jacarey",
  "GUARA IGUATEMI": "Guará Iguatemi", "LAGOA SANTOS SUMONT": "Lagoa Santos", "DOM LUIS": "Dom Luís",
  "GUARA THEBERGE": "Theberge", "GUARA ALDEOTA": "Guará Aldeota", MONTESE: "Montese",
  // planilha CAFÉ (lojas novas)
  "CAFE FATIMA": "Café Fátima", "OTOCLINICA ALDEOTA": "Oto Aldeota", "OTOCLINICA SANTOS": "Oto Santos Dumont",
  "OTO MERELES": "Oto Mereles", "OTO ALDEOTA 02": "Oto Aldeota 02",
};
const normStore = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

// ---- lê as planilhas
const stores = new Map(); // nome da loja -> { mins: Map(produto -> quantidade), unmapped: [] }
for (const file of files) {
  const sheets = await readXlsxFile(fs.readFileSync(file));
  for (const sheet of sheets) {
    const grid = sheet.data;
    if (grid.length < 40 || grid.length > 60) continue; // só as abas de loja
    const key = normStore(sheet.sheet);
    const storeName = STORE[key];
    if (!storeName) {
      console.log("ABA IGNORADA (sem loja correspondente):", JSON.stringify(sheet.sheet));
      continue;
    }
    const header = grid[2].map(clean);
    const minCol = header.findIndex((h) => /ESTOQUE M[ÍI]NIMO/i.test(h));
    if (minCol < 1) {
      console.log("SEM COLUNA DE MÍNIMO:", sheet.sheet);
      continue;
    }
    const entry = stores.get(storeName) ?? { mins: new Map(), unmapped: [], dups: [] };
    for (const row of grid.slice(4)) {
      const label = clean(row[minCol - 1]) || clean(row[1]);
      if (!label) continue;
      const k = norm(label);
      if (DROPPED.has(k)) continue;
      const product = PRODUCT[k];
      const min = Number(String(row[minCol] ?? "").replace(",", "."));
      if (!product) {
        if (Number.isFinite(min) && min > 0) entry.unmapped.push(`${label} (mín ${min})`);
        continue;
      }
      if (!Number.isFinite(min) || min <= 0) continue;
      if (entry.mins.has(product)) entry.dups.push(`${product} (${label})`);
      entry.mins.set(product, (entry.mins.get(product) ?? 0) + min);
    }
    stores.set(storeName, entry);
  }
}

// ---- confere com o banco
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const products = (
  await db.query(
    `select p.id, p.name, p.unit, p.active from products p join sectors s on s.id = p.sector_id
     join production_units u on u.id = s.unit_id where u.slug = 'osorio-de-paiva'`
  )
).rows;
const productByName = new Map(products.map((p) => [p.name, p]));
const missingProducts = [...new Set([...stores.values()].flatMap((s) => [...s.mins.keys()]))].filter((n) => !productByName.has(n));
if (missingProducts.length) console.log("PRODUTO NÃO ENCONTRADO NO CADASTRO:", missingProducts);

const route = (await db.query(`select id from delivery_routes where slug = 'rota-osorio'`)).rows[0];
if (!route) throw new Error("Rota Osório não existe (aplique a migração 52).");
const existing = (
  await db.query(
    `select s.id, s.name from stores s join delivery_routes r on r.id = s.route_id join production_units u on u.id = r.unit_id where u.slug = 'osorio-de-paiva'`
  )
).rows;
const existingByName = new Map(existing.map((s) => [s.name, s.id]));

let totalMins = 0;
for (const [name, entry] of [...stores.entries()].sort()) {
  totalMins += entry.mins.size;
  const flags = [existingByName.has(name) ? "já existe" : "nova"];
  if (entry.unmapped.length) flags.push("SEM PAR: " + entry.unmapped.join("; "));
  if (entry.dups.length) flags.push("REPETIDO: " + entry.dups.join("; "));
  console.log(`${name.padEnd(24)} ${String(entry.mins.size).padStart(3)} produtos  [${flags.join(" | ")}]`);
}
console.log(`\n${stores.size} lojas, ${totalMins} mínimos.`);

if (!apply) {
  console.log("\n(prévia: nada foi gravado. Rode com --apply para gravar.)");
  await db.end();
  process.exit(0);
}

await db.query("begin");
try {
  for (const [name, entry] of stores) {
    let storeId = existingByName.get(name);
    if (!storeId) {
      storeId = (await db.query(`insert into stores (route_id, name) values ($1, $2) returning id`, [route.id, name])).rows[0].id;
    }
    for (const [productName, min] of entry.mins) {
      await db.query(
        `insert into store_product_mins (store_id, product_id, min_quantity) values ($1, $2, $3)
         on conflict (store_id, product_id) do update set min_quantity = excluded.min_quantity, updated_at = now()`,
        [storeId, productByName.get(productName).id, min]
      );
    }
  }
  // todos os produtos do pedido do Osório contam em pacotes
  const used = [...new Set([...stores.values()].flatMap((s) => [...s.mins.keys()]))].map((n) => productByName.get(n).id);
  await db.query(`update products set order_unit = 'pct' where id = any($1)`, [used]);
  await db.query("commit");
  console.log(`\nGravado: ${stores.size} lojas, ${totalMins} mínimos, ${used.length} produtos com unidade do pedido = pct.`);
} catch (e) {
  await db.query("rollback");
  throw e;
} finally {
  await db.end();
}
