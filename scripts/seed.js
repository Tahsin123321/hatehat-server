import "dotenv/config";
import { getDb } from "../lib.js";

const day = 24 * 60 * 60 * 1000;
const at = (days, hour) => {
  const d = new Date(Date.now() + days * day);
  d.setUTCHours(hour - 6, 0, 0, 0); // Dhaka is UTC+6
  return d;
};

const img = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=70`;

const events = [
  {
    title: "Winter Clothes Distribution",
    eventType: "Donation",
    location: "Mirpur 10, Dhaka",
    thumbnail: img("photo-1593113598332-cd288d649433"),
    eventDate: at(6, 10),
    description:
      "We are collecting and handing out warm clothes to families living near the Mirpur 10 flyover. Bring clean, usable jackets, sweaters and blankets, or just come and help us sort and pack.",
  },
  {
    title: "Blanket Distribution for the Needy",
    eventType: "Donation",
    location: "Mohammadpur, Dhaka",
    thumbnail: img("photo-1488521787991-ed7bbaae773c"),
    eventDate: at(9, 17),
    description:
      "An evening walk through Mohammadpur to give blankets to people sleeping outdoors. Volunteers meet at the town hall field, split into small groups and cover the routes together.",
  },
  {
    title: "Dhanmondi Lake Cleanup Morning",
    eventType: "Cleanup",
    location: "Dhanmondi Lake, Road 8A",
    thumbnail: img("photo-1532629345422-7515f3d16bb6"),
    eventDate: at(12, 8),
    description:
      "Two hours of picking up plastic and litter along the lake walkway. Gloves, bags and tea are provided. Wear shoes you do not mind getting dirty.",
  },
  {
    title: "Tree Planting Drive at Hatirjheel",
    eventType: "Plantation",
    location: "Hatirjheel, Dhaka",
    thumbnail: img("photo-1542601906990-b4d3fb778b09"),
    eventDate: at(15, 9),
    description:
      "We will plant 300 native saplings along the Hatirjheel embankment and label each one so a neighbourhood group can water and track it through the dry season.",
  },
  {
    title: "Free Health Camp for Street Families",
    eventType: "Health Camp",
    location: "Karwan Bazar, Dhaka",
    thumbnail: img("photo-1559027615-cd4628902d4a"),
    eventDate: at(20, 10),
    description:
      "Volunteer doctors and nurses will run free blood pressure, sugar and general check-ups. We need helpers for registration, queue management and handing out basic medicines.",
  },
  {
    title: "Weekend Reading Hour for Slum Children",
    eventType: "Education",
    location: "Korail, Gulshan, Dhaka",
    thumbnail: img("photo-1469571486292-0ba58a3f068b"),
    eventDate: at(24, 15),
    description:
      "Read aloud, draw and play word games with children aged 6 to 12. Bring a story book in Bangla or English if you have one to donate to the shared shelf.",
  },
  {
    title: "Community Blood Donation Day",
    eventType: "Blood Donation",
    location: "Chattogram Railway Hall, Chattogram",
    thumbnail: img("photo-1618477461853-cf6ed80faba5"),
    eventDate: at(30, 9),
    description:
      "A one-day drive with a licensed blood bank. Healthy adults can donate, and volunteers are needed to guide donors, serve snacks and keep records.",
  },
  {
    title: "Food Packs for Flood-Hit Families",
    eventType: "Food Distribution",
    location: "Sylhet Sadar, Sylhet",
    thumbnail: img("photo-1593113598332-cd288d649433"),
    eventDate: at(38, 11),
    description:
      "Packing and delivering dry food packs of rice, lentils, oil and salt to families whose homes were cut off by rising water. Boats and pickup trucks are arranged by the local team.",
  },
].map((e) => ({
  ...e,
  creatorEmail: "team@hatehat.org",
  creatorName: "HateHat Team",
  createdAt: new Date(),
  updatedAt: new Date(),
}));

const db = await getDb();
await db.collection("events").deleteMany({ creatorEmail: "team@hatehat.org" });
const result = await db.collection("events").insertMany(events);
console.log(`Seeded ${result.insertedCount} upcoming events.`);
process.exit(0);
