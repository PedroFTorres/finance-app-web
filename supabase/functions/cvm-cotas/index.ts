import { Unzip, UnzipInflate } from "npm:fflate@0.8.2";

const CVM_INF_DIARIO_BASE = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS";
const CVM_CNPJ_ALIASES: Record<string, string> = {
  "54603259001556": "54603259000156"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type CvmQuota = {
  date: string;
  quota: number;
};

type CsvQuotaScanner = {
  cnpj: string;
  dateISO: string;
  formattedCnpj: string;
  remainder: string;
  cnpjIndex: number;
  dateIndex: number;
  quotaIndex: number;
  selected: CvmQuota | null;
  headersParsed: boolean;
};

function normalizeCnpj(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 14);
}

function normalizeCnpjCvm(value: unknown) {
  const cnpj = normalizeCnpj(value);
  return CVM_CNPJ_ALIASES[cnpj] || cnpj;
}

function formatCnpj(value: unknown) {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function parseDecimal(value: unknown) {
  const raw = String(value || "").trim().replace(/\s/g, "");
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
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

function indexOfAny(headers: string[], names: string[]) {
  return names.reduce((found, name) => (
    found >= 0 ? found : headers.findIndex(header => header === name)
  ), -1);
}

function createCsvQuotaScanner(cnpj: string, dateISO: string): CsvQuotaScanner {
  return {
    cnpj,
    dateISO,
    formattedCnpj: formatCnpj(cnpj),
    remainder: "",
    cnpjIndex: -1,
    dateIndex: -1,
    quotaIndex: -1,
    selected: null,
    headersParsed: false
  };
}

function readCsvHeaders(scanner: CsvQuotaScanner, line: string) {
  const headers = line.replace(/\r$/, "").split(";").map(header => header.trim());
  const cnpjIndex = indexOfAny(headers, ["CNPJ_FUNDO", "CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO_COTA"]);
  const dateIndex = indexOfAny(headers, ["DT_COMPTC", "DT_COMPT", "DT_REFER"]);
  const quotaIndex = indexOfAny(headers, ["VL_QUOTA", "VL_COTA"]);

  scanner.cnpjIndex = cnpjIndex;
  scanner.dateIndex = dateIndex;
  scanner.quotaIndex = quotaIndex;
  scanner.headersParsed = cnpjIndex >= 0 && dateIndex >= 0 && quotaIndex >= 0;
}

function scanCsvLine(scanner: CsvQuotaScanner, rawLine: string) {
  const line = rawLine.replace(/\r$/, "");
  if (!line) return;

  if (!scanner.headersParsed && scanner.cnpjIndex < 0) {
    readCsvHeaders(scanner, line);
    return;
  }

  if (!scanner.headersParsed || !line.includes(scanner.formattedCnpj)) return;

  const values = line.split(";");
  const rowCnpj = normalizeCnpj(values[scanner.cnpjIndex]);
  const date = values[scanner.dateIndex] || "";
  const quota = parseDecimal(values[scanner.quotaIndex]);

  if (rowCnpj === scanner.cnpj && date && date <= scanner.dateISO && quota > 0) {
    if (!scanner.selected || date > scanner.selected.date) {
      scanner.selected = { date, quota };
    }
  }
}

function scanCsvChunk(scanner: CsvQuotaScanner, chunk: string, final = false) {
  const text = scanner.remainder + chunk;
  const lines = text.split("\n");
  scanner.remainder = final ? "" : lines.pop() || "";

  for (const line of lines) {
    scanCsvLine(scanner, line);
  }

  if (final && scanner.remainder) {
    scanCsvLine(scanner, scanner.remainder);
    scanner.remainder = "";
  }
}

async function fetchCvmQuota(yearMonth: string, cnpj: string, dateISO: string) {
  const response = await fetch(`${CVM_INF_DIARIO_BASE}/inf_diario_fi_${yearMonth}.zip`);
  if (!response.ok) {
    throw new Error(`Arquivo CVM ${yearMonth} indisponivel (${response.status}).`);
  }
  if (!response.body) {
    throw new Error(`Arquivo CVM ${yearMonth} nao pode ser lido por streaming.`);
  }

  const scanner = createCsvQuotaScanner(cnpj, dateISO);
  const decoder = new TextDecoder("iso-8859-1");
  const reader = response.body.getReader();
  let foundCsv = false;
  let streamError: Error | null = null;

  const unzipper = new Unzip(file => {
    if (!/\.csv$/i.test(file.name)) return;

    foundCsv = true;
    file.ondata = (error, data, final) => {
      if (error) {
        streamError = error instanceof Error ? error : new Error(String(error));
        return;
      }
      scanCsvChunk(scanner, decoder.decode(data, { stream: !final }), final);
    };
    file.start();
  });
  unzipper.register(UnzipInflate);

  while (true) {
    const { value, done } = await reader.read();
    unzipper.push(value || new Uint8Array(), done);
    if (streamError) throw streamError;
    if (done) break;
  }

  if (!foundCsv) throw new Error(`Arquivo CVM ${yearMonth} nao contem CSV.`);

  return scanner.selected;
}

async function findQuota(cnpj: string, dateISO: string, maxBackMonths: number) {
  let cursor = dateISO;

  for (let attempt = 0; attempt <= maxBackMonths; attempt += 1) {
    const yearMonth = yearMonthFromISO(cursor);
    let selected: CvmQuota | null = null;
    try {
      selected = await fetchCvmQuota(yearMonth, cnpj, dateISO);
    } catch (_error) {
      cursor = addMonthsISO(`${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}-01`, -1);
      continue;
    }

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
    const cnpj = normalizeCnpjCvm(body.cnpj);
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
