import { BROKERS } from "./brokers.js";

// Skener: za brokere sa checkMethod "url_pattern" radi pravi HTTP HEAD/GET i
// gleda da li stranica sa rezultatima postoji. Za "manual" brokere (blokiraju
// botove) vraća "likely" procenu na osnovu pokrivenosti — te brokere u
// produkciji treba proveravati preko scraping servisa (npr. proxy pool).

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

async function checkUrlPattern(broker, subject) {
  const url = broker.searchUrl(subject);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, "Accept": "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return { status: "not_found", confidence: "high", url };
    const html = await res.text();
    const nameRe = new RegExp(`${subject.first}[\\s,]+.{0,40}${subject.last}`, "i");
    const found = nameRe.test(html) && !/no results|0 results|not found/i.test(html);
    return { status: found ? "exposed" : "not_found", confidence: "high", url };
  } catch {
    // Mreža blokirana / timeout → padamo na heuristiku
    return heuristic(broker, subject);
  }
}

function heuristic(broker, subject) {
  // Ako korisnik ima US adresu/telefon, verovatnoća da je kod velikog brokera je vrlo visoka.
  const signals = [subject.city, subject.state, subject.phone, subject.email].filter(Boolean).length;
  const likely = signals >= 1;
  return {
    status: likely ? "likely_exposed" : "unknown",
    confidence: "low",
    url: broker.searchUrl(subject),
    note: "This broker blocks automated checks — open the link to verify manually, or send an opt-out preventively."
  };
}

export async function runScan(subject) {
  const started = Date.now();
  const results = await Promise.all(
    BROKERS.map(async broker => {
      const r = broker.checkMethod === "url_pattern"
        ? await checkUrlPattern(broker, subject)
        : heuristic(broker, subject);
      return {
        brokerId: broker.id,
        brokerName: broker.name,
        ...r,
        exposes: r.status === "not_found" ? [] : broker.exposes,
        optOut: broker.optOut
      };
    })
  );

  return {
    scanId: `scan_${Date.now()}`,
    subject: { first: subject.first, last: subject.last, city: subject.city, state: subject.state },
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    results,
    score: computeScore(results)
  };
}

// Privacy score 0–100 (100 = potpuno čist)
export function computeScore(results) {
  const weights = { exposed: 12, likely_exposed: 6, unknown: 2, not_found: 0 };
  const sensitiveBonus = { address: 3, phone: 2, email: 2, wealth_data: 5, assets: 5, relatives: 1 };
  let penalty = 0;
  for (const r of results) {
    penalty += weights[r.status] ?? 0;
    for (const e of r.exposes || []) penalty += sensitiveBonus[e] ?? 0;
  }
  return Math.max(0, 100 - penalty);
}
