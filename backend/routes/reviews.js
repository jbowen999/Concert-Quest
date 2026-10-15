// /api/reviews (Jerith Gurusubburam)
//
// GET    /?concertId=   reviews for one concert, newest first
// GET    /:id           one review
// POST   /              create; body is the review plus { concertId, passcode }
// PUT    /:id           replace the editable fields; needs { passcode }
// DELETE /:id           delete; needs { passcode }
//
// passcode is the reviewer's own or ADMIN_PASSCODE. passcodeHash is never
// sent back.
import { Router } from "express";

import * as db from "../db/reviews.js";
import { getConcert } from "../db/concerts.js";
import { canEdit, hashPasscode, withoutPasscode } from "../passcode.js";

const router = Router();

const MIN_PASSCODE_LENGTH = 4;
const MIN_RATING = 1;
const MAX_RATING = 5;

// Returns { review } with only the editable fields, or { error }.
function parseReview(body) {
  const errors = [];

  const text = (key, max, required = true) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (required && !value) errors.push(`${key} is required`);
    if (value.length > max) errors.push(`${key} is over ${max} characters`);
    return value;
  };

  // Same rule as price: Number("") is 0, so accept only numbers and
  // non-empty numeric strings (form values arrive as strings).
  const isRatingLike =
    typeof body.rating === "number" ||
    (typeof body.rating === "string" && body.rating.trim() !== "");
  const rating = isRatingLike ? Number(body.rating) : NaN;
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    errors.push(
      `rating must be a whole number from ${MIN_RATING} to ${MAX_RATING}`
    );
  }

  const review = {
    reviewerName: text("reviewerName", 100),
    rating,
    comment: text("comment", 5000),
  };
  return errors.length ? { error: errors.join("; ") } : { review };
}

const notFound = (res) => res.status(404).json({ error: "Review not found" });
const wrongPasscode = (res) =>
  res.status(403).json({ error: "Wrong passcode" });

router.get("/", async (req, res) => {
  const reviews = await db.listReviewsForConcert(req.query.concertId);
  if (!reviews) {
    return res.status(400).json({ error: "concertId must be a valid id" });
  }
  res.json(reviews.map(withoutPasscode));
});

router.get("/:id", async (req, res) => {
  const review = await db.getReview(req.params.id);
  if (!review) return notFound(res);
  res.json(withoutPasscode(review));
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { review, error } = parseReview(body);
  if (error) return res.status(400).json({ error });
  if (
    typeof body.passcode !== "string" ||
    body.passcode.length < MIN_PASSCODE_LENGTH
  ) {
    return res.status(400).json({
      error: `passcode must be at least ${MIN_PASSCODE_LENGTH} characters`,
    });
  }
  // getConcert also returns null for a malformed id.
  if (!(await getConcert(body.concertId))) {
    return res.status(404).json({ error: "Concert not found" });
  }

  const created = await db.createReview({
    ...review,
    concertId: body.concertId,
    passcodeHash: hashPasscode(body.passcode),
  });
  res.status(201).json(withoutPasscode(created));
});

router.put("/:id", async (req, res) => {
  const body = req.body ?? {};
  const existing = await db.getReview(req.params.id);
  if (!existing) return notFound(res);
  if (!canEdit(existing, body.passcode)) return wrongPasscode(res);

  const { review, error } = parseReview(body);
  if (error) return res.status(400).json({ error });

  const updated = await db.updateReview(req.params.id, review);
  if (!updated) return notFound(res);
  res.json(withoutPasscode(updated));
});

router.delete("/:id", async (req, res) => {
  const existing = await db.getReview(req.params.id);
  if (!existing) return notFound(res);
  if (!canEdit(existing, req.body?.passcode)) return wrongPasscode(res);

  await db.deleteReview(req.params.id);
  res.status(204).end();
});

export default router;
