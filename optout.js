import { getBroker } from "./brokers.js";
import { store } from "./store.js";

// Generiše opt-out zahtev za brokera. MVP: za "email" brokere generišemo
// spreman email (subject+body) koji app šalje kroz korisnikov mail nalog;
// za "web_form" brokere vraćamo deep-link + korak-po-korak uputstvo.
// Faza 2: headless browser automatizacija formi na serveru.

const FORM_STEPS = {
  truepeoplesearch: ["Open the link", "Enter your email (an alias works)", "Click your record", "Confirm removal"],
  fastpeoplesearch: ["Open the link", "Find your record", "Click 'Remove My Record'", "Confirm via email"],
  spokeo: ["Open the link", "Paste your profile URL", "Enter your email", "Confirm from your inbox"],
  whitepages: ["Open the link", "Paste your profile URL", "Choose a reason", "Confirm via automated phone call"],
  beenverified: ["Open the link", "Search your name", "Click 'That's me' → Remove", "Confirm via email"],
  radaris: ["Open the link", "Create an account (alias email)", "Claim control of your record", "Delete your data"],
  intelius: ["Open the Suppression Center", "Register", "Find your record", "Request suppression"],
  peoplefinders: ["Open the link", "Find your record", "Enter your email", "Confirm"],
  ussearch: ["Open the Suppression Center", "Register", "Find your record", "Request suppression"]
};

export function createOptOut({ brokerId, subject, userId }) {
  const broker = getBroker(brokerId);
  if (!broker) throw new Error(`Unknown broker: ${brokerId}`);

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
      steps: FORM_STEPS[brokerId] || ["Open the link", "Follow the broker's instructions"],
      listingUrl: broker.searchUrl(subject),
      requiresEmail: broker.optOut.requiresEmail
    };
  }

  const optout = { ...base, payload };
  store.addOptOut(optout);
  return optout;
}
