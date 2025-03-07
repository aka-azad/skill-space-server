const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: "https://skill-space-by-ashraf.web.app" }));
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
    // await client.connect();

    const skillSpaceDB = client.db("Skill-Space");
    const usersCollection = skillSpaceDB.collection("users");
    const teachersCollection = skillSpaceDB.collection("teachers");
    const classesCollection = skillSpaceDB.collection("classes");
    const paymentsCollection = skillSpaceDB.collection("payments");
    const enrollmentsCollection = skillSpaceDB.collection("enrollments");
    const assignmentsCollection = skillSpaceDB.collection("assignments");
    const submissionsCollection = skillSpaceDB.collection("submissions");
    const evaluationsCollection = skillSpaceDB.collection("evaluations");

    // JWT generation endpoint
    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "3h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // user related apis
    app.post("/users", async (req, res) => {
      const userCredential = req.body;
      const userEmail = req.body.email;

      const filter = { email: userEmail };
      const oldUser = await usersCollection.findOne(filter);

      if (!oldUser) {
        const result = await usersCollection.insertOne({
          ...userCredential,
          role: "student",
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
    app.post("/teacher-requests", verifyToken, async (req, res) => {
      const data = req.body;

      const result = await teachersCollection.insertOne(data);

      res.send(result);
    });

    app.put("/teachers/:id", verifyToken, async (req, res) => {
      const id = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: data };
      const result = await teachersCollection.updateOne(filter, updateDoc);

      res.send(result);
    });
    app.put("/teacher-requests/:id", verifyToken, async (req, res) => {
      const id = req.params;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status } };
      const result = await teachersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/teachers-profile/:id", verifyToken, async (req, res) => {
      const id = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: data };
      const find = await teachersCollection.findOne(filter);
      const userFilter = { email: find.email };
      const result = await usersCollection.updateOne(userFilter, updateDoc);
      res.send(result);
    });

    app.get("/teachers", verifyToken, async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const teachers = await teachersCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
      const totalTeachers = await teachersCollection.countDocuments();
      res.send({ teachers, totalTeachers });
    });

    app.get("/teachers/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const filter = { email };
      const result = await teachersCollection.findOne(filter);
      res.send(result);
    });
    app.get("/users", verifyToken, async (req, res) => {
      const query = req.query.query || "";
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const searchFilter = {
        $or: [
          { displayName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      };
      const users = await usersCollection
        .find(query ? searchFilter : {})
        .skip(skip)
        .limit(limit)
        .toArray();
      const totalUsers = await usersCollection.countDocuments(
        query ? searchFilter : {}
      );
      res.send({ users, totalUsers });
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await usersCollection.findOne(filter);
      res.send(user);
    });

    app.put("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const data = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: data,
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //class related apis
    //token required
    app.post("/classes", verifyToken, async (req, res) => {
      const classInfo = req.body;
      const result = await classesCollection.insertOne(classInfo);
      res.send(result);
    });

    app.get("/classes", verifyToken, async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const classes = await classesCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
      const totalClasses = await classesCollection.countDocuments();
      res.send({ classes, totalClasses });
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
    app.get("/classes/popular", async (req, res) => {
      try {
        const popularClasses = await classesCollection
          .find({})
          .sort({ totalEnrolment: -1 })
          .limit(6)
          .toArray();

        res.send(popularClasses);
      } catch (error) {
        console.error("Error fetching popular classes:", error);
        res.status(500).send({ message: "Error fetching popular classes" });
      }
    });

    app.delete("/classes/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const deleteResult = await classesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (deleteResult.deletedCount === 0) {
          return res.status(404).send({ message: "Class not found" });
        }

        res.send({ message: "Class deleted successfully" });
      } catch (error) {
        console.error("Error deleting class:", error);
        res.status(500).send({ message: "Error deleting class" });
      }
    });

    app.put("/classes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedClass = req.body;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: { ...updatedClass },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/classes/teacher/:email", verifyToken, async (req, res) => {
      const { email } = req.params;

      try {
        const classes = await classesCollection.find({ email }).toArray();
        res.send(classes);
      } catch (error) {
        console.error("Error fetching classes:", error);
        res.status(500).send({ message: "Error fetching classes" });
      }
    });

    app.get("/stats", async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();
        const totalClasses = await classesCollection.countDocuments();
        const totalEnrollments = await classesCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalEnrollment: { $sum: "$totalEnrolment" },
              },
            },
          ])
          .toArray();

        res.send({
          totalUsers,
          totalClasses,
          totalEnrollments: totalEnrollments[0].totalEnrollment,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).send({ message: "Error fetching stats" });
      }
    });

    app.get("/revenue", verifyToken, async (req, res) => {
      try {
        const totalRevenue = await paymentsCollection
          .aggregate([
            {
              $group: {
                _id: null,
                total: { $sum: "$amount" },
              },
            },
          ])
          .toArray();

        res.send({ totalRevenue: totalRevenue[0]?.total || 0 });
      } catch (error) {
        console.error("Error fetching revenue:", error);
        res.status(500).send({ message: "Error fetching revenue" });
      }
    });

    app.get("/courseSalesChart", verifyToken, async (req, res) => {
      try {
        const topCourses = await classesCollection
          .find({}, { projection: { _id: 1, title: 1, totalEnrolment: 1 } })
          .sort({ totalEnrolment: -1 })
          .limit(10) 
          .toArray();

        res.json(topCourses);
      } catch (error) {
        console.error("Error fetching course sales data:", error);
        res.status(500).send({ message: "Error fetching course sales data" });
      }
    });

    //payment related apis

    app.post("/payments", verifyToken, async (req, res) => {
      const { classId, amount, userEmail, transactionId } = req.body;

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

        const payment = {
          classId,
          amount,
          userEmail,
          transactionId,
          date: new Date().toISOString(),
        };

        const paymentResult = await paymentsCollection.insertOne(payment);

        const enrollment = {
          classId,
          userEmail,
          date: new Date().toISOString(),
        };

        const enrollmentResult = await enrollmentsCollection.insertOne(
          enrollment
        );

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
    // Endpoint to check if user is already enrolled in the class
    app.get("/enrollments/check", verifyToken, async (req, res) => {
      const { classId, userEmail } = req.query;
      try {
        const existingEnrollment = await enrollmentsCollection.findOne({
          classId,
          userEmail,
        });
        res.send({ exists: !!existingEnrollment });
      } catch (error) {
        console.error("Error checking enrollment:", error);
        res.status(500).send({ message: "Error checking enrollment" });
      }
    });
    app.get("/enrollments/:userEmail", verifyToken, async (req, res) => {
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

    //assignments
    app.post("/assignments", verifyToken, async (req, res) => {
      const { classId, title, description, deadline } = req.body;

      try {
        const newAssignment = {
          classId,
          title,
          description,
          deadline,
          dateCreated: new Date().toISOString(),
        };

        const result = await assignmentsCollection.insertOne(newAssignment);
        res.send(result);
      } catch (error) {
        console.error("Error creating assignment:", error);
        res.status(500).send({ message: "Error creating assignment" });
      }
    });

    app.get("/submissions/class/:id/count", verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const submissionCount = await submissionsCollection.countDocuments({
          classId: id,
        });
        res.send({ count: submissionCount });
      } catch (error) {
        console.error("Error fetching submission count:", error);
        res.status(500).send({ message: "Error fetching submission count" });
      }
    });

    app.get("/assignments/class/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const assignments = await assignmentsCollection
          .find({ classId: id })
          .toArray();
        res.send(assignments);
      } catch (error) {
        console.error("Error fetching assignments:", error);
        res.status(500).send({ message: "Error fetching assignments" });
      }
    });

    app.post("/assignments/submit", verifyToken, async (req, res) => {
      const { assignmentId, userEmail, classId, submissionLink } = req.body;
      try {
        const existingSubmission = await submissionsCollection.findOne({
          assignmentId,
          userEmail,
        });
        if (existingSubmission) {
          return res
            .status(400)
            .send({ message: "Assignment already submitted" });
        }

        const submission = {
          assignmentId,
          userEmail,
          classId,
          submissionLink,
          date: new Date().toISOString(),
        };

        const submissionResult = await submissionsCollection.insertOne(
          submission
        );

        const assignmentUpdateResult = await assignmentsCollection.updateOne(
          { _id: new ObjectId(assignmentId) },
          { $inc: { submissionCount: 1 } }
        );

        res.send({
          message: "Assignment submitted successfully",
          submissionId: submissionResult.insertedId,
          updatedSubmissionCount: assignmentUpdateResult.modifiedCount,
        });
      } catch (error) {
        console.error("Error submitting assignment:", error);
        res.status(500).send({ message: "Error submitting assignment" });
      }
    });
    app.post("/evaluations", verifyToken, async (req, res) => {
      const { classId, userEmail, userImage, description, rating } = req.body;

      try {
        const evaluation = {
          classId,
          userEmail,
          description,
          rating,
          userImage,
          date: new Date().toISOString(),
        };

        const evaluationResult = await evaluationsCollection.insertOne(
          evaluation
        );

        res.send({
          message: "Evaluation submitted successfully",
          evaluationId: evaluationResult.insertedId,
        });
      } catch (error) {
        console.error("Error submitting evaluation:", error);
        res.status(500).send({ message: "Error submitting evaluation" });
      }
    });
    app.get("/evaluations", async (req, res) => {
      try {
        const evaluations = await evaluationsCollection.find({}).toArray();

        res.send(evaluations);
      } catch (error) {
        console.error("Error fetching feedbacks:", error);
        res.status(500).send({ message: "Error fetching feedbacks" });
      }
    });

    // payment intent

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const data = req.body;
      const amount = 100 * data.price;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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
