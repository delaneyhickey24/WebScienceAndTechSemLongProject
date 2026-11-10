require("dotenv").config();
const express = require('express');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const app = express();

app.use(express.json({ limit: '20kb' }));
app.use(express.static('public'));

const uri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;

if (!uri) {
  throw new Error('Set MONGODB_URI in your environment');
}

if (!sessionSecret) {
  throw new Error('Set SESSION_SECRET in your environment');
}

const client = new MongoClient(uri);
const allowedTypes = new Set(['project', 'opportunity', 'discussion']);

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please sign in first.' });
  }
  next();
}

async function startServer() {
  try {
    await client.connect();
    console.log('Connected to MongoDB!');

    const db = client.db('myDatabase');
    const posts = db.collection('myCollection');
    const users = db.collection('users');

    await users.createIndex({ username: 1 }, { unique: true });
    await users.createIndex({ email: 1 }, { unique: true });

    app.use(session({
      name: 'accesscs.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client,
        dbName: "myDatabase",
        collectionName: "sessions"
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 8
      }
    }));

    app.get('/api/me', (req, res) => {
      res.json({ user: req.session.user || null });
    });

    app.post('/api/register', async (req, res) => {
      try {
        const { username, email, password } = req.body;

        if (
          typeof username !== 'string' ||
          typeof email !== 'string' ||
          typeof password !== 'string' ||
          username.trim().length < 3 ||
          username.trim().length > 40 ||
          password.length < 10 ||
          email.trim().length > 254
        ) {
          return res.status(400).json({
            error: 'Enter a username, valid email, and password of at least 10 characters.'
          });
        }

        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim().toLowerCase();
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await users.insertOne({
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
          createdAt: new Date()
        });

        req.session.user = {
          id: result.insertedId.toString(),
          username: normalizedUsername
        };

        res.status(201).json({ user: req.session.user });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({
            error: "That username or email is already registered."
          });
        }
        console.error("Registration error:", error);
        res.status(500).json({ error: "Could not create account." });
      }
    });

    app.post("/api/login", async (req, res) => {
      try {
        const { username, password } = req.body;

        if (typeof username !== "string" || typeof password !== "string") {
          return res.status(400).json({ error: 'Enter your username/email and password.' });
        }

        const loginName = username.trim();
        const user = await users.findOne({
          $or: [
            { username: { $regex: `^${escapeRegex(loginName)}$`, $options: "i" } },
            { email: loginName.toLowerCase() }
          ]
        });

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
          return res.status(401).json({ error: 'Invalid username/email or password.' });
        }

        req.session.regenerate(error => {
          if (error) {
            console.error("Session error:", error);
            return res.status(500).json({ error: 'Could not start session.' });
          }

          req.session.user = {
            id: user._id.toString(),
            username: user.username
          };

          req.session.save(saveError => {
            if (saveError) {
              console.error("Session save error:", saveError);
              return res.status(500).json({ error: 'Could not save session.' });
            }
            res.json({ user: req.session.user });
          });
        });
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Could not sign in.' });
      }
    });

    app.post("/api/logout", (req, res) => {
      req.session.destroy(error => {
        if (error) {
          return res.status(500).json({ error: 'Could not log out.' });
        }
        res.clearCookie("accesscs.sid");
        res.json({ ok: true });
      });
    });

    // Public read: anyone may view existing posts.
    app.get("/api/data", async (req, res) => {
      try {
        const { type } = req.query;

        if (!allowedTypes.has(type)) {
          return res.status(400).json({
            error: 'Invalid or missing type. Use project, opportunity, or discussion.',
          });
        }

        const data = await posts.find({ type })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray();

        res.json(data);
      } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).json({ error: 'Could not load data' });
      }
    });

    //Private: only logged in users may submit.
    app.post("/api/data", requireLogin, async (req, res) => {
      try {
        const { type, title, description, image } = req.body;

        if (!allowedTypes.has(type)) {
          return res.status(400).json({ error: 'Invalid content type' });
        }

        if (
          typeof title !== 'string' ||
          !title.trim() ||
          title.trim().length > 100 ||
          typeof description !== 'string' ||
          !description.trim() ||
          description.trim().length > 1000
        ) {
          return res.status(400).json({
            error: 'Title and description are required.',
          });
        }

        const item = {
          type,
          title: title.trim(),
          description: description.trim(),
          userId: req.session.user.id,
          createdAt: new Date(),
        };

        if (type === 'project' && typeof image === 'string' && image.trim()) {
          try {
            const imageUrl = new URL(image.trim());
            if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== "https:") {
              return res.status(400).json({ error: 'Image URL must use HTTP or HTTPS.' });
            }
            item.image = imageUrl.href;
          } catch {
            return res.status(400).json({ error: 'Enter a valid image URL.' });
          }
        }

        const result = await posts.insertOne(item);
        res.status(201).json({ ...item, _id: result.insertedId });
      } catch (error) {
        console.error('Error saving submission:', error);
        res.status(500).json({ error: 'Could not save submission' });
      }
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Could not start server:', error);
    process.exit(1);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

startServer();
