// One client for both pages. Set your browser key and your install's address.
import { Qbrix } from "@optiqio/qbrix";

const consented = localStorage.getItem("consent") === "yes";

export const qbrix = new Qbrix({
  apiKey: "optiq_...",
  baseUrl: "http://localhost:8080",
  // until the visitor consents, decisions live only as long as the page
  storage: consented ? "local" : "memory",
});

export function giveConsent() {
  localStorage.setItem("consent", "yes");
  qbrix.setStorage("local");
}

export const unit = (() => {
  let id = localStorage.getItem("visitor");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("visitor", id);
  }
  return id;
})();
