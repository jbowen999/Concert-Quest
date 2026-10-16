// Home page: render the concert list client-side. (Julian Bowen)
// Filters live in the URL (index.html?when=past&free=true) so a reload or
// the back button keeps them.
import { api } from "./api.js";

const filters = document.getElementById("filters");
const list = document.getElementById("concert-list");
const status = document.getElementById("list-status");
const heading = document.getElementById("list-heading");

const thisYear = new Date().getFullYear();
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateFormatWithYear = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  trailingZeroDisplay: "stripIfInteger",
});

function formatDate(iso) {
  const date = new Date(iso);
  const format =
    date.getFullYear() === thisYear ? dateFormat : dateFormatWithYear;
  return format.format(date);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// User-entered text only ever goes in via textContent, never innerHTML.
function card(concert) {
  const item = el("li", "concert-card");

  const title = el("h2", "concert-card__title");
  const link = el("a", "concert-card__link", concert.ensemble);
  link.href = `concert.html?id=${encodeURIComponent(concert._id)}`;
  title.append(link);

  const when = el("time", "concert-card__date", formatDate(concert.date));
  when.dateTime = concert.date;

  const isFree = concert.price === 0;
  const price = el(
    "span",
    isFree
      ? "concert-card__price concert-card__price--free"
      : "concert-card__price",
    isFree ? "Free" : priceFormat.format(concert.price)
  );

  item.append(
    title,
    when,
    el("p", "concert-card__venue", concert.venue),
    price
  );

  const firstPiece = concert.program?.split("\n").find((line) => line.trim());
  if (firstPiece) {
    item.append(el("p", "concert-card__program", firstPiece.trim()));
  }
  return item;
}

function emptyMessage(past, free) {
  if (past) return free ? "No past free concerts." : "No past concerts yet.";
  return free
    ? "No free concerts coming up. Try turning off the free filter."
    : "No upcoming concerts yet. Performing soon? Post your concert.";
}

// Ignore responses that arrive after a newer request was made.
let latestRequest = 0;

async function render() {
  const free = filters.elements.free.checked;
  const past = filters.elements.when.value === "past";

  const query = new URLSearchParams();
  if (past) query.set("when", "past");
  if (free) query.set("free", "true");
  const search = query.toString() ? `?${query}` : "";
  history.replaceState(null, "", `${location.pathname}${search}`);
  heading.textContent = past ? "Past concerts" : "Upcoming concerts";

  const request = ++latestRequest;
  status.textContent = "Loading concerts…";
  try {
    const concerts = await api(`/concerts${search}`);
    if (request !== latestRequest) return;
    list.replaceChildren(...concerts.map(card));
    status.textContent = concerts.length ? "" : emptyMessage(past, free);
  } catch {
    if (request !== latestRequest) return;
    list.replaceChildren();
    status.textContent =
      "Couldn't load concerts. Refresh the page to try again.";
  }
}

const params = new URLSearchParams(location.search);
filters.elements.free.checked = params.get("free") === "true";
filters.elements.when.value =
  params.get("when") === "past" ? "past" : "upcoming";

filters.addEventListener("change", render);
filters.addEventListener("submit", (event) => event.preventDefault());
render();
