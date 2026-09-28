import { MongoClient } from 'mongodb';

// Ensure the URI defaults to the provided one if the env var isn't set yet
const uri = process.env.MONGODB_URI || "mongodb+srv://yousefgamer9733_db_user:jT2XN9vCk4237QNV@cluster0.cgvj9nl.mongodb.net/?retryWrites=true&w=majority";
const options = {};

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default clientPromise;
