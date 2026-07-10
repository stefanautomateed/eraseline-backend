// Registar data brokera — svaki ima način provere i opt-out proceduru.
// checkMethod: "url_pattern" = možemo direktno proveriti javnu stranicu pretrage
//              "manual"      = broker blokira botove, provera je heuristička dok ne dodamo proxy/scraping servis
export const BROKERS = [
  {
    id: "truepeoplesearch",
    name: "TruePeopleSearch",
    baseUrl: "https://www.truepeoplesearch.com",
    checkMethod: "url_pattern",
    searchUrl: ({ first, last, city, state }) =>
      `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(first + " " + last)}&citystatezip=${encodeURIComponent((city || "") + " " + (state || ""))}`,
    optOut: { method: "web_form", url: "https://www.truepeoplesearch.com/removal", avgDays: 2, requiresEmail: false },
    exposes: ["name", "age", "address", "phone", "relatives"]
  },
  {
    id: "fastpeoplesearch",
    name: "FastPeopleSearch",
    baseUrl: "https://www.fastpeoplesearch.com",
    checkMethod: "url_pattern",
    searchUrl: ({ first, last, city, state }) =>
      `https://www.fastpeoplesearch.com/name/${encodeURIComponent(first + "-" + last)}_${encodeURIComponent((city || "") + "-" + (state || ""))}`,
    optOut: { method: "web_form", url: "https://www.fastpeoplesearch.com/removal", avgDays: 3, requiresEmail: true },
    exposes: ["name", "address", "phone", "relatives"]
  },
  {
    id: "spokeo",
    name: "Spokeo",
    baseUrl: "https://www.spokeo.com",
    checkMethod: "manual",
    searchUrl: ({ first, last }) => `https://www.spokeo.com/${encodeURIComponent(first)}-${encodeURIComponent(last)}`,
    optOut: { method: "web_form", url: "https://www.spokeo.com/optout", avgDays: 3, requiresEmail: true },
    exposes: ["name", "address", "phone", "email", "social_profiles", "wealth_data"]
  },
  {
    id: "whitepages",
    name: "Whitepages",
    baseUrl: "https://www.whitepages.com",
    checkMethod: "manual",
    searchUrl: ({ first, last, state }) => `https://www.whitepages.com/name/${encodeURIComponent(first + "-" + last)}/${encodeURIComponent(state || "")}`,
    optOut: { method: "web_form", url: "https://www.whitepages.com/suppression-requests", avgDays: 7, requiresEmail: false },
    exposes: ["name", "age", "address", "phone", "relatives"]
  },
  {
    id: "beenverified",
    name: "BeenVerified",
    baseUrl: "https://www.beenverified.com",
    checkMethod: "manual",
    searchUrl: ({ first, last, state }) => `https://www.beenverified.com/people/${encodeURIComponent(first + "-" + last)}/${encodeURIComponent(state || "")}`,
    optOut: { method: "web_form", url: "https://www.beenverified.com/app/optout/search", avgDays: 1, requiresEmail: true },
    exposes: ["name", "address", "phone", "email", "criminal_records", "assets"]
  },
  {
    id: "radaris",
    name: "Radaris",
    baseUrl: "https://radaris.com",
    checkMethod: "url_pattern",
    searchUrl: ({ first, last }) => `https://radaris.com/p/${encodeURIComponent(first)}/${encodeURIComponent(last)}/`,
    optOut: { method: "web_form", url: "https://radaris.com/control/privacy", avgDays: 14, requiresEmail: true },
    exposes: ["name", "address", "phone", "work_history", "relatives"]
  },
  {
    id: "intelius",
    name: "Intelius",
    baseUrl: "https://www.intelius.com",
    checkMethod: "manual",
    searchUrl: ({ first, last }) => `https://www.intelius.com/people-search/${encodeURIComponent(first + "-" + last)}`,
    optOut: { method: "web_form", url: "https://suppression.peopleconnect.us/login", avgDays: 7, requiresEmail: true },
    exposes: ["name", "address", "phone", "relatives", "court_records"]
  },
  {
    id: "mylife",
    name: "MyLife",
    baseUrl: "https://www.mylife.com",
    checkMethod: "manual",
    searchUrl: ({ first, last }) => `https://www.mylife.com/${encodeURIComponent(first.toLowerCase() + "-" + last.toLowerCase())}`,
    optOut: { method: "email", email: "privacy@mylife.com", url: "https://www.mylife.com/ccpa/index.pubview", avgDays: 10, requiresEmail: true },
    exposes: ["name", "age", "address", "reputation_score", "relatives"]
  },
  {
    id: "peoplefinders",
    name: "PeopleFinders",
    baseUrl: "https://www.peoplefinders.com",
    checkMethod: "manual",
    searchUrl: ({ first, last }) => `https://www.peoplefinders.com/people/${encodeURIComponent(first + "-" + last)}`,
    optOut: { method: "web_form", url: "https://www.peoplefinders.com/opt-out", avgDays: 5, requiresEmail: true },
    exposes: ["name", "address", "phone", "relatives"]
  },
  {
    id: "ussearch",
    name: "USSearch",
    baseUrl: "https://www.ussearch.com",
    checkMethod: "manual",
    searchUrl: ({ first, last }) => `https://www.ussearch.com/people-search/${encodeURIComponent(first + "-" + last)}`,
    optOut: { method: "web_form", url: "https://suppression.peopleconnect.us/login", avgDays: 7, requiresEmail: true },
    exposes: ["name", "address", "phone"]
  }
];

export function getBroker(id) {
  return BROKERS.find(b => b.id === id);
}
