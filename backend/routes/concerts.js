// /api/concerts (Julian Bowen)
//
// GET    /              upcoming concerts, soonest first
//                        ?free=true  only free (price 0)
//                        ?when=past  past concerts instead, most recent first
// GET    /:id           one concert
// POST   /              create; body is the concert plus { passcode }
// PUT    /:id           replace the editable fields; needs { passcode }
// DELETE /:id           delete; needs { passcode }
//
// passcode is the poster's own or ADMIN_PASSCODE. passcodeHash is never sent
// back.
import { Router } from "express";

import * as db from "../db/concerts.js";
import { deleteReviewsForConcert } from "../db/reviews.js";
import { canEdit, hashPasscode, withoutPasscode } from "../passcode.js";

const router = Router();

const MIN_PASSCODE_LENGTH = 4;
const MAX_PRICE = 10000;
// <input type="datetime-local"> has no timezone, so the browser must convert
// to an ISO string first. Requiring an offset catches it if it doesn't.
const HAS_TIMEZONE = /(Z|[+-]\d{2}:\d{2})$/;

// Returns { concert } with only the editable fields, or { error }.
function parseConcert(body) {
  const errors = [];

  const text = (key, max, required = true) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (required && !value) errors.push(`${key} is required`);
    if (value.length > max) errors.push(`${key} is over ${max} characters`);
    return value;
  };

  const date = new Date(body.date);
  if (
    typeof body.date !== "string" ||
    !HAS_TIMEZONE.test(body.date) ||
    Number.isNaN(date.getTime())
  ) {
    errors.push("date must be an ISO date string with a timezone");
  }

  // Number("") and Number(null) are 0, so a missing price would silently
  // become free. Accept only numbers and non-empty numeric strings.
  const isPriceLike =
    typeof body.price === "number" ||
    (typeof body.price === "string" && body.price.trim() !== "");
  const price = isPriceLike ? Number(body.price) : NaN;
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    errors.push(`price must be a number from 0 to ${MAX_PRICE}`);
  }

  // Only http(s): a javascript: URL here would run when someone clicks it.
  const ticketUrl = text("ticketUrl", 2000, false);
  if (ticketUrl) {
    let protocol;
    try {
      protocol = new URL(ticketUrl).protocol;
    } catch {
      protocol = null;
    }
    if (protocol !== "http:" && protocol !== "https:") {
      errors.push("ticketUrl must be an http or https link");
    }
  }

  const concert = {
    ensemble: text("ensemble", 200),
    venue: text("venue", 200),
    date,
    program: text("program", 5000, false),
    price: Math.round(price * 100) / 100,
    ticketUrl,
    posterName: text("posterName", 100),
  };
  return errors.length ? { error: errors.join("; ") } : { concert };
}

const notFound = (res) => res.status(404).json({ error: "Concert not found" });
const wrongPasscode = (res) =>
  res.status(403).json({ error: "Wrong passcode" });

router.get("/", async (req, res) => {
  const concerts = await db.listConcerts({
    freeOnly: req.query.free === "true",
    past: req.query.when === "past",
  });
  res.json(concerts.map(withoutPasscode));
});

router.get("/:id", async (req, res) => {
  const concert = await db.getConcert(req.params.id);
  if (!concert) return notFound(res);
  res.json(withoutPasscode(concert));
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { concert, error } = parseConcert(body);
  if (error) return res.status(400).json({ error });
  if (
    typeof body.passcode !== "string" ||
    body.passcode.length < MIN_PASSCODE_LENGTH
  ) {
    return res.status(400).json({
      error: `passcode must be at least ${MIN_PASSCODE_LENGTH} characters`,
    });
  }

  const created = await db.createConcert({
    ...concert,
    passcodeHash: hashPasscode(body.passcode),
  });
  res.status(201).json(withoutPasscode(created));
});

router.put("/:id", async (req, res) => {
  const body = req.body ?? {};
  const existing = await db.getConcert(req.params.id);
  if (!existing) return notFound(res);
  if (!canEdit(existing, body.passcode)) return wrongPasscode(res);

  const { concert, error } = parseConcert(body);
  if (error) return res.status(400).json({ error });

  const updated = await db.updateConcert(req.params.id, concert);
  if (!updated) return notFound(res);
  res.json(withoutPasscode(updated));
});

router.delete("/:id", async (req, res) => {
  const existing = await db.getConcert(req.params.id);
  if (!existing) return notFound(res);
  if (!canEdit(existing, req.body?.passcode)) return wrongPasscode(res);

  await deleteReviewsForConcert(req.params.id);
  await db.deleteConcert(req.params.id);
  res.status(204).end();
});

export default router;
