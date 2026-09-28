import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const uri = "mongodb+srv://yousefgamer9733_db_user:jT2XN9vCk4237QNV@cluster0.cgvj9nl.mongodb.net/?retryWrites=true&w=majority";

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
