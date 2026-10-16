// Post / edit concert form. (Julian Bowen)
// concert-form.html posts a new concert; concert-form.html?id=... loads that
// concert and saves changes to it. Either way, success goes to its detail page.
import { api } from "./api.js";

const form = document.getElementById("concert-form");
const { isFree, price, passcode } = form.elements;
const errorBox = document.getElementById("form-error");
const submitButton = form.querySelector('button[type="submit"]');
const id = new URLSearchParams(location.search).get("id");

const TEXT_FIELDS = ["ensemble", "venue", "program", "ticketUrl", "posterName"];

// <input type="datetime-local"> wants local time as "YYYY-MM-DDTHH:mm".
function toLocalInputValue(iso) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

// Free means price 0; the price box is locked while "Free event" is checked.
function syncPrice() {
  price.disabled = isFree.checked;
  if (isFree.checked) price.value = "0";
}

function showError(message) {
  errorBox.textContent = message;
}

async function loadForEdit() {
  const concert = await api(`/concerts/${encodeURIComponent(id)}`);

  for (const key of TEXT_FIELDS) form.elements[key].value = concert[key] ?? "";
  form.elements.date.value = toLocalInputValue(concert.date);
  price.value = concert.price;
  isFree.checked = concert.price === 0;
  syncPrice();

  document.querySelector("h1").textContent = "Edit concert";
  document.title = "Edit Concert | Concert Quest";
  document.getElementById("passcode-label").textContent = "Passcode";
  document.getElementById("passcode-hint").textContent =
    "Enter the passcode you chose when posting, or the admin passcode.";
  passcode.autocomplete = "current-password";
}

isFree.addEventListener("change", () => {
  syncPrice();
  if (!isFree.checked) price.value = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");

  const data = Object.fromEntries(new FormData(form));
  const body = {
    ...data,
    // The browser knows the user's timezone; the server stores UTC.
    date: new Date(data.date).toISOString(),
    price: isFree.checked ? 0 : Number(data.price),
  };
  delete body.isFree;

  submitButton.disabled = true;
  try {
    const saved = id
      ? await api(`/concerts/${encodeURIComponent(id)}`, {
          method: "PUT",
          body,
        })
      : await api("/concerts", { method: "POST", body });
    location.href = `concert.html?id=${saved._id}`;
  } catch (err) {
    showError(
      err.status === 403
        ? "That passcode doesn't match this concert."
        : err.message
    );
    submitButton.disabled = false;
  }
});

if (id) {
  try {
    await loadForEdit();
  } catch (err) {
    const message = document.createElement("p");
    message.textContent =
      err.status === 404
        ? "This concert doesn't exist. It may have been deleted."
        : `Couldn't load this concert: ${err.message}`;
    form.replaceWith(message);
  }
}
