// Reviews collection: data access only, no Express here. (Jerith Gurusubburam)
// Documents are returned as stored, passcodeHash included; the router strips
// it before anything reaches the client.
import { ObjectId } from "mongodb";
import { getDb } from "./connection.js";

const reviews = () => getDb().collection("reviews");

// Unknown or malformed ids match nothing instead of throwing.
const byId = (id) => (ObjectId.isValid(id) ? { _id: new ObjectId(id) } : null);
const byConcert = (concertId) =>
  ObjectId.isValid(concertId) ? { concertId: new ObjectId(concertId) } : null;

// Newest first. Resolves with null if concertId is malformed, so the router
// can tell that apart from a concert with no reviews.
export async function listReviewsForConcert(concertId) {
  const filter = byConcert(concertId);
  if (!filter) return null;
  return reviews().find(filter).sort({ createdAt: -1 }).toArray();
}

export function getReview(id) {
  const filter = byId(id);
  return filter ? reviews().findOne(filter) : null;
}

// data.concertId must already be a valid id; it is stored as an ObjectId.
export async function createReview(data) {
  const now = new Date();
  const doc = {
    ...data,
    concertId: new ObjectId(data.concertId),
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await reviews().insertOne(doc);
  return { _id: insertedId, ...doc };
}

// Resolves with the updated review, or null if it doesn't exist.
export function updateReview(id, data) {
  const filter = byId(id);
  if (!filter) return null;
  return reviews().findOneAndUpdate(
    filter,
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
}

// Resolves with true if a review was deleted.
export async function deleteReview(id) {
  const filter = byId(id);
  if (!filter) return false;
  const { deletedCount } = await reviews().deleteOne(filter);
  return deletedCount === 1;
}

// Resolves with how many reviews were deleted.
export async function deleteReviewsForConcert(concertId) {
  const filter = byConcert(concertId);
  if (!filter) return 0;
  const { deletedCount } = await reviews().deleteMany(filter);
  return deletedCount;
}
