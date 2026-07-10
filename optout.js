import { getBroker } from "./brokers.js";
import { store } from "./store.js";

// Generiše opt-out zahtev za brokera. MVP: za "email" brokere generišemo
// spreman email (subject+body) koji app šalje kroz korisnikov mail nalog;
// za "web_form" brokere vraćamo deep-link + korak-po-korak uputstvo.
// Faza 2: headless browser automatizacija formi na serveru.

const FORM_STEPS = {
  truepeoplesearch: ["Otvori link", "Unesi email (može alias)", "Klikni na svoj zapis", "Potvrdi uklanjanje"],
  fastpeoplesearch: ["Otvori link", "Pronađi svoj zapis", "Klikni 'Remove My Record'", "Potvrdi preko emaila"],
  spokeo: ["Otvori link", "Nalepi URL svog profila", "Unesi email", "Potvrdi iz inbox-a"],
  whitepages: ["Otvori link", "Nalepi URL profila", "Izaberi razlog", "Potvrdi telefonskim pozivom (robot)"],
  beenverified: ["Otvori link", "Pretraži svoje ime", "Klikni 'That's me' → Remove", "Potvrdi email"],
  radaris: ["Otvori link", "Kreiraj nalog (alias email)", "Zatraži kontrolu nad zapisom", "Obriši podatke"],
  intelius: ["Otvori Suppression Center", "Registruj se", "Pronađi zapis", "Zatraži supresiju"],
  peoplefinders: ["Otvori link", "Pronađi svoj zapis", "Unesi email", "Potvrdi"],
  ussearch: ["Otvori Suppression Center", "Registruj se", "Pronađi zapis", "Zatraži supresiju"]
};

export function createOptOut({ brokerId, subject, userId }) {
  const broker = getBroker(brokerId);
  if (!broker) throw new Error(`Nepoznat broker: ${brokerId}`);

  const id = `oo_${brokerId}_${Date.now()}`;
  const base = {
    id,
    userId,
    brokerId,
    brokerName: broker.name,
    method: broker.optOut.method,
    status: "prepared",
    estimatedDays: broker.optOut.avgDays,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let payload;
  if (broker.optOut.method === "email") {
    payload = {
      to: broker.optOut.email,
      subject: `CCPA/GDPR Data Deletion Request — ${subject.first} ${subject.last}`,
      body:
`To whom it may concern,

Pursuant to the California Consumer Privacy Act (CCPA) and, where applicable, the EU General Data Protection Regulation (GDPR), I request the immediate deletion of all records relating to me from your website and databases, and that you refrain from future collection or sale of my personal information.

Full name: ${subject.first} ${subject.last}
City/State: ${subject.city || "-"}, ${subject.state || "-"}
Listing URL (if known): ${broker.searchUrl(subject)}

Please confirm deletion in writing within 45 days as required by law.

Regards,
${subject.first} ${subject.last}`
    };
  } else {
    payload = {
      url: broker.optOut.url,
      steps: FORM_STEPS[brokerId] || ["Otvori link", "Prati uputstva brokera"],
      listingUrl: broker.searchUrl(subject),
      requiresEmail: broker.optOut.requiresEmail
    };
  }

  const optout = { ...base, payload };
  store.addOptOut(optout);
  return optout;
}
