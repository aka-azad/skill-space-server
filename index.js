const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const classesCollection = skillSpaceDB.collection("classes");
    const paymentsCollection = skillSpaceDB.collection("payments");
    const enrollmentsCollection = skillSpaceDB.collection("enrollments");

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
    app.put("/teachers/:id", async (req, res) => {
      const id = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: data };
      const result = await teachersCollection.updateOne(filter, updateDoc);

      res.send(result);
    });
    app.put("/teachers-profile/:id", async (req, res) => {
      const id = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: data };
      const find = await teachersCollection.findOne(filter);
      const userFilter = { email: find.email };
      const result = await usersCollection.updateOne(userFilter, updateDoc);
      res.send(result);
    });

    //admin token verification required

    app.get("/users", async (req, res) => {
      const query = req.query.query || "";

      const searchFilter = {
        $or: [
          { displayName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      };

      const users = await usersCollection
        .find(query ? searchFilter : {})
        .toArray();
      res.send(users);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await usersCollection.findOne(filter);
      res.send(user);
    });
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const data = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: data,
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
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
    app.post("/classes", async (req, res) => {
      const classInfo = req.body;
      const result = await classesCollection.insertOne(classInfo);
      res.send(result);
    });
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });
    app.get("/class/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(filter);
      res.send(result);
    });
    app.get("/classes/available", async (req, res) => {
      const result = await classesCollection
        .find({ status: "accepted" })
        .toArray();
      res.send(result);
    });

    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const updatedClass = req.body;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: { ...updatedClass },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //payment related apis

    app.post("/payments", async (req, res) => {
      const { classId, amount, userEmail } = req.body;

      try {
        const existingEnrollment = await enrollmentsCollection.findOne({
          classId,
          userEmail,
        });

        if (existingEnrollment) {
          return res
            .status(400)
            .send({ message: "User already enrolled in this class" });
        }

        // Create payment transaction
        const payment = {
          classId,
          amount,
          userEmail,
          date: new Date().toISOString(),
        };

        const paymentResult = await paymentsCollection.insertOne(payment);

        // Create enrollment entry
        const enrollment = {
          classId,
          userEmail,
          date: new Date().toISOString(),
        };

        const enrollmentResult = await enrollmentsCollection.insertOne(
          enrollment
        );

        // Update enrollment count in class
        const classUpdateResult = await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $inc: { totalEnrolment: 1 } }
        );

        res.send({
          message: "Payment processed successfully",
          paymentId: paymentResult.insertedId,
          enrollmentId: enrollmentResult.insertedId,
          updatedEnrolmentCount: classUpdateResult.modifiedCount,
        });
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).send({ message: "Error processing payment" });
      }
    });
    
    app.get("/enrollments/:userEmail", async (req, res) => {
      const { userEmail } = req.params;

      try {
        const enrollments = await enrollmentsCollection
          .find({ userEmail })
          .toArray();
        const classIds = enrollments.map(
          (enrollment) => new ObjectId(enrollment.classId)
        );
        const classes = await classesCollection
          .find({ _id: { $in: classIds } })
          .toArray();

        res.send(classes);
      } catch (error) {
        console.error("Error fetching enrolled classes:", error);
        res.status(500).send({ message: "Error fetching enrolled classes" });
      }
    });

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
