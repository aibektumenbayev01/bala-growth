require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const {
  buildChildGrowthInsights,
} = require("./services/growthAnalytics");

const prisma = new PrismaClient();
const app = express();

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authorization token required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Authorization token required",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.userId = decoded.userId;

    next();
  } catch (e) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// BASIC ROUTES
// ======================================================

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.send(
    "Bala API is running. Try /health or /children"
  );
});

// ======================================================
// AUTH
// ======================================================

// REGISTER
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    // Email validation
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Password validation
    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters",
      });
    }

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        error:
          "User with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      10
    );

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (e) {
    console.error("Register error:", e);

    res.status(500).json({
      error: "Failed to register user",
    });
  }
});

app.patch("/auth/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "New password must be at least 8 characters",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(400).json({
        error: "Current password is incorrect",
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.passwordHash
    );

    if (samePassword) {
      return res.status(400).json({
        error: "New password must be different from current password",
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return res.json({
      ok: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      error: "Failed to change password",
    });
  }
});

// LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (e) {
    console.error("Login error:", e);

    res.status(500).json({
      error: "Failed to login",
    });
  }
});

app.post("/auth/demo", async (req, res) => {
  try {
    const demoEmail = "demo@growthtrack.kz";

    let user = await prisma.user.findUnique({
      where: {
        email: demoEmail,
      },
    });

    if (!user) {
      const randomPassword = `demo-${Date.now()}-${Math.random()}`;

      const passwordHash = await bcrypt.hash(
        randomPassword,
        10
      );

      user = await prisma.user.create({
        data: {
          email: demoEmail,
          passwordHash,
        },
      });
    }

    // Reset demo data every time somebody opens Demo
    const existingChildren = await prisma.child.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    const childIds = existingChildren.map(
      (child) => child.id
    );

    if (childIds.length > 0) {
      await prisma.measurement.deleteMany({
        where: {
          childId: {
            in: childIds,
          },
        },
      });

      await prisma.child.deleteMany({
        where: {
          userId: user.id,
        },
      });
    }

    const demoChild = await prisma.child.create({
      data: {
        userId: user.id,
        name: "Demo Child",
        gender: "male",
        birthDate: new Date("2018-02-15T00:00:00.000Z"),
      },
    });

    await prisma.measurement.createMany({
      data: [
        {
          childId: demoChild.id,
          date: new Date("2024-08-26T00:00:00.000Z"),
          height: 112,
          weight: 20,
        },
        {
          childId: demoChild.id,
          date: new Date("2025-08-26T00:00:00.000Z"),
          height: 117,
          weight: 22,
        },
        {
          childId: demoChild.id,
          date: new Date("2026-08-26T00:00:00.000Z"),
          height: 119,
          weight: 24,
        },
      ],
    });

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Demo login error:", error);

    return res.status(500).json({
      error: "Failed to start demo account",
    });
  }
});

// ======================================================
// CHILDREN
// ======================================================

// GET ALL CHILDREN OF CURRENT USER
app.get(
  "/children",
  authenticateToken,
  async (req, res) => {
    try {
      const children =
        await prisma.child.findMany({
          where: {
            userId: req.userId,
          },
        });

      res.json(children);
    } catch (e) {
      res.status(500).json({
        error: e.message,
      });
    }
  }
);

// CREATE CHILD
app.post(
  "/children",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        name,
        gender,
        birthDate,
      } = req.body;

      const trimmedName = String(
        name ?? ""
      ).trim();

      // Required fields
      if (
        !trimmedName ||
        !gender ||
        !birthDate
      ) {
        return res.status(400).json({
          error:
            "Name, gender and birthDate are required",
        });
      }

      // Name validation
      if (
        trimmedName.length < 2 ||
        trimmedName.length > 50
      ) {
        return res.status(400).json({
          error:
            "Name must be between 2 and 50 characters",
        });
      }

      // Gender validation
      if (
        !["male", "female"].includes(gender)
      ) {
        return res.status(400).json({
          error:
            "Gender must be male or female",
        });
      }

      // Birth date validation
      const parsedBirthDate =
        new Date(birthDate);

      if (
        Number.isNaN(
          parsedBirthDate.getTime()
        )
      ) {
        return res.status(400).json({
          error: "Invalid birth date",
        });
      }

      if (
        parsedBirthDate > new Date()
      ) {
        return res.status(400).json({
          error:
            "Birth date cannot be in the future",
        });
      }

      const child =
        await prisma.child.create({
          data: {
            userId: req.userId,
            name: trimmedName,
            gender,
            birthDate: parsedBirthDate,
          },
        });

      res.status(201).json(child);
    } catch (e) {
      console.error(
        "Create child error:",
        e
      );

      res.status(400).json({
        error: e.message,
      });
    }
  }
);

// DELETE CHILD
app.delete(
  "/children/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Make sure child belongs to current user
      const child =
        await prisma.child.findFirst({
          where: {
            id,
            userId: req.userId,
          },
        });

      if (!child) {
        return res.status(404).json({
          error: "Child not found",
        });
      }

      // Delete measurements first
      await prisma.measurement.deleteMany({
        where: {
          childId: id,
        },
      });

      // Delete child
      await prisma.child.delete({
        where: {
          id,
        },
      });

      res.status(204).send();
    } catch (e) {
      console.error(
        "Delete child error:",
        e
      );

      res.status(500).json({
        error: "Failed to delete child",
      });
    }
  }
);

// ======================================================
// MEASUREMENTS
// ======================================================

// GET CHILD MEASUREMENTS
app.get(
  "/children/:id/measurements",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check ownership
      const child =
        await prisma.child.findFirst({
          where: {
            id,
            userId: req.userId,
          },
        });

      if (!child) {
        return res.status(404).json({
          error: "Child not found",
        });
      }

      const measurements =
        await prisma.measurement.findMany({
          where: {
            childId: id,
          },
          orderBy: {
            date: "asc",
          },
        });

      res.json(measurements);
    } catch (e) {
      res.status(500).json({
        error: e.message,
      });
    }
  }
);

// CREATE MEASUREMENT
app.post(
  "/children/:id/measurements",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        date,
        height,
        weight,
      } = req.body;

      // Required fields
      if (
        !date ||
        height == null ||
        weight == null
      ) {
        return res.status(400).json({
          error:
            "Date, height and weight are required",
        });
      }

      const parsedDate =
        new Date(date);

      const parsedHeight =
        Number(height);

      const parsedWeight =
        Number(weight);

      // Date validation
      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid measurement date",
        });
      }

      // Height validation
      if (
        !Number.isFinite(
          parsedHeight
        ) ||
        parsedHeight <= 0 ||
        parsedHeight > 250
      ) {
        return res.status(400).json({
          error:
            "Height must be a valid number between 0 and 250 cm",
        });
      }

      // Weight validation
      if (
        !Number.isFinite(
          parsedWeight
        ) ||
        parsedWeight <= 0 ||
        parsedWeight > 300
      ) {
        return res.status(400).json({
          error:
            "Weight must be a valid number between 0 and 300 kg",
        });
      }

      // Future measurement is impossible
      if (
        parsedDate > new Date()
      ) {
        return res.status(400).json({
          error:
            "Measurement date cannot be in the future",
        });
      }

      // Find child and check ownership
      const child =
        await prisma.child.findFirst({
          where: {
            id,
            userId: req.userId,
          },
        });

      if (!child) {
        return res.status(404).json({
          error: "Child not found",
        });
      }

      // Measurement cannot exist before birth
      if (
        parsedDate < child.birthDate
      ) {
        return res.status(400).json({
          error:
            "Measurement date cannot be before the child's birth date",
        });
      }

      // Prevent duplicate measurement date
      const existingMeasurement =
        await prisma.measurement.findFirst({
          where: {
            childId: id,
            date: parsedDate,
          },
        });

      if (existingMeasurement) {
        return res.status(409).json({
          error:
            "Measurement for this date already exists",
        });
      }

      const measurement =
        await prisma.measurement.create({
          data: {
            childId: id,
            date: parsedDate,
            height: parsedHeight,
            weight: parsedWeight,
          },
        });

      res
        .status(201)
        .json(measurement);
    } catch (e) {
      console.error(
        "Create measurement error:",
        e
      );

      res.status(400).json({
        error: e.message,
      });
    }
  }
);

// DELETE MEASUREMENT
app.delete(
  "/measurements/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Find measurement AND verify that
      // its child belongs to current user
      const measurement =
        await prisma.measurement.findFirst({
          where: {
            id,
            child: {
              userId: req.userId,
            },
          },
        });

      if (!measurement) {
        return res.status(404).json({
          error:
            "Measurement not found",
        });
      }

      await prisma.measurement.delete({
        where: {
          id,
        },
      });

      res.json({
        ok: true,
      });
    } catch (e) {
      console.error(
        "Delete measurement error:",
        e
      );

      res.status(400).json({
        error: e.message,
      });
    }
  }
);

// ======================================================
// GROWTH INSIGHTS
// ======================================================

app.get(
  "/children/:id/insights",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Verify ownership
      const child =
        await prisma.child.findFirst({
          where: {
            id,
            userId: req.userId,
          },
        });

      if (!child) {
        return res.status(404).json({
          error: "Child not found",
        });
      }

      const measurements =
        await prisma.measurement.findMany({
          where: {
            childId: id,
          },
          orderBy: {
            date: "asc",
          },
        });

      const insights =
        buildChildGrowthInsights(
          child,
          measurements
        );

      return res.json(insights);
    } catch (e) {
      console.error(
        "Insights error:",
        e
      );

      return res.status(500).json({
        error: e.message,
      });
    }
  }
);

// ======================================================
// SHUTDOWN
// ======================================================

process.on(
  "SIGINT",
  async () => {
    await prisma.$disconnect();
    process.exit(0);
  }
);

// ======================================================
// START SERVER
// ======================================================

const port = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

module.exports = app;