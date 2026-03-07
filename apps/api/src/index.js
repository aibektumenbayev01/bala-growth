require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/", (req, res) => {
  res.send("Bala API is running. Try /health or /children");
});

// --- Children ---
app.get("/children", async (req, res) => {
  try {
    const children = await prisma.child.findMany();
    res.json(children);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/children", async (req, res) => {
  try {
    const { name, gender, birthDate } = req.body;

    if (!name || !gender || !birthDate) {
      return res.status(400).json({ error: "name, gender, birthDate required" });
    }

    const child = await prisma.child.create({
      data: {
        name: String(name).trim(),
        gender: String(gender),
        birthDate: new Date(birthDate),
      },
    });

    res.status(201).json(child);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Measurements ---
app.get("/children/:id/measurements", async (req, res) => {
  try {
    const { id } = req.params;

    const measurements = await prisma.measurement.findMany({
      where: { childId: id },
      orderBy: { date: "asc" },
    });

    res.json(measurements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/children/:id/measurements", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, height, weight } = req.body;

    if (!date || height == null || weight == null) {
      return res.status(400).json({ error: "date, height, weight required" });
    }

    const child = await prisma.child.findUnique({ where: { id } });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const m = await prisma.measurement.create({
      data: {
        childId: id,
        date: new Date(date),
        height: Number(height),
        weight: Number(weight),
      },
    });

    res.status(201).json(m);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Delete measurement ---
app.delete("/measurements/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.measurement.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));