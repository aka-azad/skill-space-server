const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Root
app.get("/", (req, res) => {
  res.send("Welcome to SkillSpace API");
});

//MongoDB things

const uri = `mongodb+srv://${process.env.MONGO_ID}:${process.env.MONGO_PASS}@main.h0ug1.mongodb.net/?retryWrites=true&w=majority&appName=main`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const skillSpaceDB = client.db("Skill-Space");
    const usersCollection = skillSpaceDB.collection("users");
    const teachersCollection = skillSpaceDB.collection("teachers");

    // JWT generation endpoint
    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      // Generate JWT
      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "3h",
      });
      res.send({ token });
    });

    app.post("/users", async (req, res) => {
      const userCredential = req.body;
      const userEmail = req.body.email;

      const filter = { email: userEmail };
      const oldUser = await usersCollection.findOne(filter);

      if (!oldUser) {
        const result = await usersCollection.insertOne({
          ...userCredential,
          userCreated: new Date().toISOString(),
        });
        res.send(result);
        return;
      } else {
        const updateResult = await usersCollection.updateOne(filter, {
          $set: { lastSignIn: userCredential.lastSignIn },
        });
        res.send(updateResult);
      }
    });

    //token verification needed
    app.post("/teachers", async (req, res) => {
      const data = req.body;

      const result = await teachersCollection.insertOne(data);

      res.send(result);
    });

    //admin token verification required

    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    //admin token verification required

    app.get("/teachers", async (req, res) => {
      const teachers = await teachersCollection.find().toArray();
      res.send(teachers);
    });

    app.get("users/auth/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email };
      const find = await usersCollection.findOne(filter);
      console.log(find);
    });

    //class related apis
    //token required
    app.post('classes', async (req, res) => {
      const classInfo = req.body
      
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
