import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const EVENT_TYPES = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Food Distribution",
  "Blood Donation",
  "Education",
  "Health Camp",
  "Flood Relief",
  "Other",
];

/* ---------- database ---------- */

let clientPromise;
let indexesReady = false;

export async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }
  if (!clientPromise) {
    clientPromise = new MongoClient(process.env.MONGODB_URI).connect();
  }
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB || "hatehat");
  if (!indexesReady) {
    indexesReady = true;
    await Promise.all([
      db.collection("events").createIndex({ eventDate: 1 }),
      db.collection("events").createIndex({ creatorEmail: 1 }),
      db
        .collection("joins")
        .createIndex({ eventId: 1, userEmail: 1 }, { unique: true }),
      db.collection("joins").createIndex({ userEmail: 1 }),
    ]);
  }
  return db;
}

export function toObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === String(id)
    ? new ObjectId(id)
    : null;
}

/* ---------- JWT (issued by Better Auth in the Next.js app) ---------- */

const AUTH_URL = (process.env.AUTH_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const JWKS = createRemoteJWKSet(new URL(`${AUTH_URL}/api/auth/jwks`), {
  cooldownDuration: 10_000,
});

export async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Log in to continue." });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_URL,
      audience: AUTH_URL,
    });
    req.user = {
      id: payload.sub || payload.id,
      email: payload.email,
      name: payload.name,
    };
    if (!req.user.email) throw new Error("token has no email");
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.code || err.message);
    res
      .status(401)
      .json({ message: "Your session has expired. Please log in again." });
  }
}

/* ---------- validation ---------- */

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateEvent(body = {}, existing = null) {
  const errors = {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");

  const title = str(body.title);
  const description = str(body.description);
  const eventType = str(body.eventType);
  const thumbnail = str(body.thumbnail);
  const location = str(body.location);
  const eventDate = new Date(body.eventDate);

  if (title.length < 3 || title.length > 100)
    errors.title = "Title must be 3 to 100 characters.";
  if (description.length < 20 || description.length > 1500)
    errors.description = "Description must be 20 to 1500 characters.";
  if (!EVENT_TYPES.includes(eventType))
    errors.eventType = "Pick an event type from the list.";
  if (!isHttpUrl(thumbnail))
    errors.thumbnail = "Enter a valid image URL starting with http or https.";
  if (location.length < 3 || location.length > 120)
    errors.location = "Location must be 3 to 120 characters.";

  if (Number.isNaN(eventDate.getTime())) {
    errors.eventDate = "Choose a valid date and time.";
  } else {
    const unchanged =
      existing && existing.eventDate.getTime() === eventDate.getTime();
    if (!unchanged && eventDate.getTime() <= Date.now()) {
      errors.eventDate = "The event date must be in the future.";
    }
  }

  return {
    errors,
    value: { title, description, eventType, thumbnail, location, eventDate },
  };
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
