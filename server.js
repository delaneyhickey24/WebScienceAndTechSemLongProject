require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Set MONGODB_URI in your environment');
}

const client = new MongoClient(uri);

const allowedTypes = new Set(['project', 'opportunity', 'discussion']);

const sampleSizes = {
  project: 8,
  opportunity: 5,
  discussion: 5,
};

async function startServer() {
  try {
    await client.connect();
    console.log('Connected to MongoDB!');

    const db = client.db('myDatabase');
    const collection = db.collection('myCollection');

    // Get a random selection for the requested type.
    app.get('/api/data', async (req, res) => {
      try {
        const { type } = req.query;

        if (!allowedTypes.has(type)) {
          return res.status(400).json({
            error: 'Invalid or missing type. Use project, opportunity, or discussion.',
          });
        }

        const data = await collection.aggregate([
          { $match: { type } },
          { $sample: { size: sampleSizes[type] } },
        ]).toArray();

        res.json(data);
      } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).json({ error: 'Could not load data' });
      }
    });

    // Save a submitted project, opportunity, or discussion.
    app.post('/api/data', async (req, res) => {
      try {
        const { type, title, description, image } = req.body;

        if (!allowedTypes.has(type)) {
          return res.status(400).json({
            error: 'Invalid content type. Use project, opportunity, or discussion.',
          });
        }

        if (
          typeof title !== 'string' ||
          !title.trim() ||
          typeof description !== 'string' ||
          !description.trim()
        ) {
          return res.status(400).json({
            error: 'Title and description are required.',
          });
        }

        const item = {
          type,
          title: title.trim(),
          description: description.trim(),
          createdAt: new Date(),
        };

        // Images are optional and only used for projects.
        if (type === 'project' && typeof image === 'string' && image.trim()) {
          item.image = image.trim();
        }

        const result = await collection.insertOne(item);

        res.status(201).json({
          ...item,
          _id: result.insertedId,
        });
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

startServer();
