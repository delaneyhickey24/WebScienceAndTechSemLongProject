require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function startServer() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");
        const db = client.db("myDatabase");
        const collection = db.collection("myCollection");

        // API Endpoint for your HTML page to request data
        app.get('/api/data', async (req, res) => {
            const data = await collection.find({}).toArray();
            res.json(data);
        });

        app.listen(3000, () => console.log('Server running on port 3000'));
    } catch (e) {
        console.error(e);
    }
}

startServer();
