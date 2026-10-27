import { MongoClient } from 'mongodb';
import crypto from 'crypto';

// Run with: MONGODB_URI="mongodb+srv://..." node generate-test-key.js
const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Set MONGODB_URI to your MongoDB connection string first.");
    process.exit(1);
}

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('aicheck');
        const licenseKey = crypto.randomUUID();
        
        await db.collection('licenses').insertOne({
            key: licenseKey,
            credits: 8000,
            createdAt: new Date()
        });
        
        console.log("==========================================");
        console.log("✅ TEST LICENSE KEY GENERATED SUCCESSFULLY!");
        console.log("🔑 License Key:", licenseKey);
        console.log("💰 Credits:", 8000);
        console.log("==========================================");
        console.log("Paste this key into your Extension Popup to record your video.");
    } finally {
        await client.close();
    }
}

run().catch(console.dir);
