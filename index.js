import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  EVENT_TYPES,
  escapeRegex,
  getDb,
  toObjectId,
  validateEvent,
  verifyToken,
} from "./lib.js";

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Unknown origins simply get no CORS headers, so browsers block them.
      cb(null, !origin || allowedOrigins.includes(origin));
    },
  })
);
app.use(express.json({ limit: "100kb" }));

// Wrap async handlers so errors reach the error middleware.
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------ public ------------------------------ */

app.get("/", (_req, res) => {
  res.json({ name: "HateHat API", status: "ok", eventTypes: EVENT_TYPES });
});

// Upcoming events only. Supports ?limit=&q=&type=&sort=soonest|latest
app.get(
  "/events",
  wrap(async (req, res) => {
    const db = await getDb();
    const { q, type, sort } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 60);

    const filter = { eventDate: { $gte: new Date() } };
    if (typeof type === "string" && EVENT_TYPES.includes(type)) {
      filter.eventType = type;
    }
    if (typeof q === "string" && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim().slice(0, 60)), "i");
      filter.$or = [{ title: rx }, { location: rx }];
    }

    let cursor = db
      .collection("events")
      .find(filter)
      .sort(sort === "latest" ? { createdAt: -1 } : { eventDate: 1 });
    if (limit) cursor = cursor.limit(limit);

    res.json(await cursor.toArray());
  })
);

app.get(
  "/events/:id",
  wrap(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Event not found." });
    const db = await getDb();
    const event = await db.collection("events").findOne({ _id });
    if (!event) return res.status(404).json({ message: "Event not found." });
    const participants = await db
      .collection("joins")
      .countDocuments({ eventId: _id });
    res.json({ ...event, participants });
  })
);

/* ----------------------------- protected ----------------------------- */

app.post(
  "/events",
  verifyToken,
  wrap(async (req, res) => {
    const { errors, value } = validateEvent(req.body);
    if (Object.keys(errors).length) {
      return res
        .status(400)
        .json({ message: "Please fix the highlighted fields.", errors });
    }
    const db = await getDb();
    const now = new Date();
    const doc = {
      ...value,
      creatorEmail: req.user.email,
      creatorName: req.user.name || "",
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection("events").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  })
);

app.get(
  "/my-events",
  verifyToken,
  wrap(async (req, res) => {
    const db = await getDb();
    const events = await db
      .collection("events")
      .find({ creatorEmail: req.user.email })
      .sort({ eventDate: 1 })
      .toArray();
    res.json(events);
  })
);

app.put(
  "/events/:id",
  verifyToken,
  wrap(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Event not found." });
    const db = await getDb();
    const existing = await db.collection("events").findOne({ _id });
    if (!existing) return res.status(404).json({ message: "Event not found." });
    if (existing.creatorEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only update events you created." });
    }
    const { errors, value } = validateEvent(req.body, existing);
    if (Object.keys(errors).length) {
      return res
        .status(400)
        .json({ message: "Please fix the highlighted fields.", errors });
    }
    const updatedAt = new Date();
    await db
      .collection("events")
      .updateOne({ _id }, { $set: { ...value, updatedAt } });
    res.json({ ...existing, ...value, updatedAt });
  })
);

app.delete(
  "/events/:id",
  verifyToken,
  wrap(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Event not found." });
    const db = await getDb();
    const existing = await db.collection("events").findOne({ _id });
    if (!existing) return res.status(404).json({ message: "Event not found." });
    if (existing.creatorEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You can only delete events you created." });
    }
    await db.collection("events").deleteOne({ _id });
    await db.collection("joins").deleteMany({ eventId: _id });
    res.json({ deleted: true });
  })
);

app.get(
  "/events/:id/joined",
  verifyToken,
  wrap(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.json({ joined: false });
    const db = await getDb();
    const join = await db
      .collection("joins")
      .findOne({ eventId: _id, userEmail: req.user.email });
    res.json({ joined: Boolean(join) });
  })
);

app.post(
  "/events/:id/join",
  verifyToken,
  wrap(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).json({ message: "Event not found." });
    const db = await getDb();
    const event = await db.collection("events").findOne({ _id });
    if (!event) return res.status(404).json({ message: "Event not found." });
    if (event.eventDate.getTime() <= Date.now()) {
      return res.status(400).json({ message: "This event has already ended." });
    }
    try {
      await db.collection("joins").insertOne({
        eventId: _id,
        userId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.name || "",
        joinedAt: new Date(),
      });
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(409)
          .json({ message: "You have already joined this event." });
      }
      throw err;
    }
    res.status(201).json({ joined: true });
  })
);

app.get(
  "/joined-events",
  verifyToken,
  wrap(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .collection("joins")
      .aggregate([
        { $match: { userEmail: req.user.email } },
        {
          $lookup: {
            from: "events",
            localField: "eventId",
            foreignField: "_id",
            as: "event",
          },
        },
        { $unwind: "$event" },
        { $replaceRoot: { newRoot: { $mergeObjects: ["$event", { joinedAt: "$joinedAt" }] } } },
        { $sort: { eventDate: 1 } },
      ])
      .toArray();
    res.json(rows);
  })
);

/* ------------------------------ errors ------------------------------ */

app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

const port = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`HateHat API running on port ${port}`));
}

export default app;
