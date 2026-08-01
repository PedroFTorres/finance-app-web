import { unzipSync } from "npm:fflate@0.8.2";

const CVM_INF_DIARIO_BASE = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type CvmRow = Record<string, string>;

function normalizeCnpj(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 14);
}

function parseDecimal(value: unknown) {
  const raw = String(value || "").trim().replace(/\s/g, "");
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseCsv(text: string): CvmRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map(header => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(";");
    return headers.reduce<CvmRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function parseISODate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function addMonthsISO(iso: string, amount: number) {
  const date = parseISODate(iso);
  date.setMonth(date.getMonth() + amount);
  return date.toISOString().slice(0, 10);
}

function yearMonthFromISO(iso: string) {
  const date = parseISODate(iso);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchCvmRows(yearMonth: string) {
  const response = await fetch(`${CVM_INF_DIARIO_BASE}/inf_diario_fi_${yearMonth}.zip`);
  if (!response.ok) {
    throw new Error(`Arquivo CVM ${yearMonth} indisponivel (${response.status}).`);
  }

  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const csvName = Object.keys(files).find(name => /\.csv$/i.test(name));
  if (!csvName) throw new Error(`Arquivo CVM ${yearMonth} nao contem CSV.`);

  return parseCsv(new TextDecoder("iso-8859-1").decode(files[csvName]));
}

function rowCnpj(row: CvmRow) {
  return normalizeCnpj(row.CNPJ_FUNDO || row.CNPJ_FUNDO_CLASSE || row.CNPJ_FUNDO_COTA);
}

function rowDate(row: CvmRow) {
  return row.DT_COMPTC || row.DT_COMPT || row.DT_REFER || "";
}

function rowQuota(row: CvmRow) {
  return parseDecimal(row.VL_QUOTA || row.VL_COTA);
}

async function findQuota(cnpj: string, dateISO: string, maxBackMonths: number) {
  let cursor = dateISO;

  for (let attempt = 0; attempt <= maxBackMonths; attempt += 1) {
    const yearMonth = yearMonthFromISO(cursor);
    let rows: CvmRow[] = [];
    try {
      rows = await fetchCvmRows(yearMonth);
    } catch (_error) {
      cursor = addMonthsISO(`${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}-01`, -1);
      continue;
    }
    const selected = rows
      .filter(row => rowCnpj(row) === cnpj)
      .map(row => ({
        date: rowDate(row),
        quota: rowQuota(row)
      }))
      .filter(row => row.date && row.quota > 0 && row.date <= dateISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);

    if (selected) {
      return {
        cnpj,
        date: selected.date,
        quota: selected.quota,
        yearMonth
      };
    }

    cursor = addMonthsISO(`${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}-01`, -1);
  }

  throw new Error("Nao encontrei cota desse fundo na CVM para a data informada ou datas anteriores proximas.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cnpj = normalizeCnpj(body.cnpj);
    const dateISO = String(body.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const maxBackMonths = Math.min(36, Math.max(0, Number(body.maxBackMonths ?? 15)));

    if (cnpj.length !== 14) throw new Error("CNPJ de fundo invalido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error("Data invalida.");

    const quota = await findQuota(cnpj, dateISO, maxBackMonths);
    return new Response(JSON.stringify(quota), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao consultar CVM." }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
