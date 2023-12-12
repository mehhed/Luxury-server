const express = require("express");
require("dotenv").config();
const app = express();

var cookieParser = require("cookie-parser");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// set up running port
const port = process.env.PORT || 3000;

// cors for of auto block when call data by other client site
const cors = require("cors");
const jwt = require("jsonwebtoken");
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://luxury-realstate-assignment.netlify.app",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

//

// require mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// ===========================================
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// =============================================

// mongodb uri
const uri = `mongodb+srv://${process?.env?.DB_USER}:${process?.env?.DB_PASSWORD}@curd-operation-database.movqgwc.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// ===================================================================================

//  main function for connect with mongodb
async function run() {
  try {
    // create data base
    const Luxury = client.db("Luxury");
    // daatabase collection
    const allUser = Luxury.collection("allUser");
    const allPropertes = Luxury.collection("allPropertes");
    const allReviws = Luxury.collection("allReviws");
    const allWish = Luxury.collection("allWish");
    const allRequst = Luxury.collection("allRequst");
    const whatWeProvide = Luxury.collection("whatWeProvide");
    const payments = Luxury.collection("payments");

    // json web token
    // ==================================================================
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middle were  for cookie verification ++++++++++++++++++++++++++++++++++++++++++++
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization;
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await allUser.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // use verify agent after verifyToken
    const verifyAgent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await allUser.findOne(query);
      const isAgent = user?.role === "agent";
      if (!isAgent) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // ======================================================================

    // =======================================================
    //  user related api
    // ========================================================

    // post user data at usercollection in database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await allUser.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await allUser.insertOne(user);
      res.send(result);
    });

    //  get users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await allUser.find().toArray();
      res.send(result);
    });

    //  chcking user role
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await allUser.findOne(query);
      let admin = false;
      if (user?.role === "admin") {
        admin = "admin";
      } else if (user?.role === "agent") {
        admin = "agent";
      } else {
        admin = "user";
      }
      res.send({ admin });
    });

    //  make admin
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await allUser.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    //  make agent
    app.patch(
      "/users/agent/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "agent",
          },
        };
        const result = await allUser.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    //   delete user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allUser.deleteOne(query);
      res.send(result);
    });

    // hanlde froud agent
    app.delete("/froud", async (req, res) => {
      const email = req.query.email;
      const id = req.query.id;
      console.log(email);
      //  modify the agent role
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "froud",
        },
      };
      const result = await allUser.updateOne(filter, updatedDoc);

      if (result.modifiedCount > 0) {
        const allPropertesQuary = { agentEmail: email };

        //  delete agent data
        const allPropertesDelete = await allPropertes.deleteMany(
          allPropertesQuary
        );
        console.log(allPropertesDelete);

        //  delete at allWish
        const allWishDelete = await allWish.deleteMany(allPropertesQuary);
        console.log(allWishDelete);

        //  delete at allWish
        const allRequstDelete = await allRequst.deleteMany(allPropertesQuary);
        console.log(allRequstDelete);

        //  delete at all reviw
        const allReviwsDelete = await allReviws.deleteMany(allPropertesQuary);
        console.log(allReviwsDelete);
      }
      res.send(result);
    });
    // __________________________________________________________
    // properties related api
    // __________________________________________________________

    app.post("/allPropertes", verifyToken, verifyAgent, async (req, res) => {
      const item = req.body;
      const result = await allPropertes.insertOne(item);
      res.send(result);
      console.log(result);
    });

    //   delete user
    app.delete(
      "/allPropertes/:id",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await allPropertes.deleteOne(query);
        res.send(result);
      }
    );

    // get agent property by his email
    app.get("/allPropertes", verifyToken, verifyAgent, async (req, res) => {
      const email = req.query.email;
      const query = { agentEmail: email };
      const result = await allPropertes.find(query).toArray();
      res.send(result);
      console.log(result);
    });
    //  for admin
    app.get(
      "/allPropertesAdmin",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await allPropertes.find().toArray();
        res.send(result);
      }
    );

    // patch methoud
    app.patch("/verifyed/:id", verifyToken, verifyAdmin, async (req, res) => {
      const response = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: response.respons,
        },
      };

      const result = await allPropertes.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //  update propertes
    app.patch(
      "/allPropertes/:id",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const response = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            PropertieTitle: response.PropertieTitle,
            PropertieImage: response.PropertieImage,
            minPrice: response.minPrice,
            maxPrice: response.maxPrice,
            location: response.location,
            size: response.size,
            totalBath: response.totalBath,
            totalBed: response.totalBed,
            status: response.status,
            advartise: response.advartise,
            agenImage: response.agenImage,
            agentEmail: response.agentEmail,
            AgentName: response.AgentName,
          },
        };

        const result = await allPropertes.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // get all verifyed propertes data for show in allPropertes page
    app.get("/allPropertesPage", verifyToken, async (req, res) => {
      const query = { status: "verifyed" };
      const cursor = allPropertes.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //  get single data by id for details
    app.get("/details/:_id", async (req, res) => {
      const find = req.params._id;
      const query = { _id: new ObjectId(find) };
      const cursor = allPropertes.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // _____________________________________________

    // ===============================================================
    //   reviws related api
    // ============================================================
    //  post reviws in database
    app.post("/allComment", verifyToken, async (req, res) => {
      const item = req.body;
      const result = await allReviws.insertOne(item);
      res.send(result);
    });

    app.get("/allComment", async (req, res) => {
      const cursor = allReviws.find().sort({ $natural: -1 }).limit(3);
      const result = await cursor.toArray();
      res.send(result);
      console.log(result);
    });

    app.get("/allComment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { reviwerEmail: email };
      const cursor = allReviws.find(query);
      const result = await cursor.toArray();
      res.send(result);
      console.log(result);
    });

    app.get("/allreviws/:_id", async (req, res) => {
      const find = req.params._id;
      console.log(find);
      const query = {
        productId: find,
      };
      console.log(query);
      const cursor = allReviws.find(query);
      const result = await cursor.toArray();
      res.send(result);
      console.log(result);
    });

    //  delete reviw
    app.delete("/deleteRevew/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allReviws.deleteOne(query);
      res.send(result);
    });
    // _______________________________________________________________

    // ==========================================
    //           wishlist related api
    // ==========================================
    //         post wishlist
    app.post("/wishlist", verifyToken, async (req, res) => {
      const item = req.body;
      const result = await allWish.insertOne(item);
      res.send(result);
    });
    //  get wishList
    app.get("/wishlist/:email", async (req, res) => {
      const find = req.params.email;
      const query = { buyerEmail: find };
      const cursor = allWish.find(query);
      const result = await cursor.toArray();
      res.send(result);
      console.log(result);
    });

    app.get("/wishListForRequst/:id", async (req, res) => {
      const find = req.params.id;
      console.log(find);
      const query = { _id: new ObjectId(find) };
      const cursor = allWish.find(query);
      const result = await cursor.toArray();
      res.send(result);
      console.log("bla ", result);
    });

    //  delete wishList
    app.delete("/deleteWishList/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allWish.deleteOne(query);
      res.send(result);
    });

    // ______________________________________________

    // ========================================================
    //  advertisement related api
    // ==========================================================
    app.get("/advertisement", verifyToken, verifyAdmin, async (req, res) => {
      const query = { status: "verifyed" };
      const cursor = allPropertes.find(query);
      const result = await cursor.toArray();
      res.send(result);
      console.log();
    });

    // patch methoud
    app.patch("/advertise/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          advartise: true,
        },
      };

      const result = await allPropertes.updateOne(filter, updatedDoc);
      res.send(result);
    });
    //  advertise  remov
    app.patch(
      "/advertiseRemov/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            advartise: false,
          },
        };

        const result = await allPropertes.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    //  get for home advertise section
    app.get("/advartise", async (req, res) => {
      const query = { advartise: true };
      const cursor = allPropertes.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // ____________________________________________________________

    // =========================================================
    //  buyer requst related api
    // =============================================================

    app.post("/requst", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await allRequst.insertOne(data);
      res.send(result);
    });

    //  buy related api
    app.get("/myBuy/:email", verifyToken, async (req, res) => {
      const find = req.params.email;
      const query = { buyerEmail: find };
      const cursor = allRequst.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //  payment related ==================================================================
    app.get("/paymentBrought/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        console.log(query);
        const result = await allRequst.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
      }
    });

    // Payment Related Api
    // Payment Related Api
    app.get("/payments/:agentEmail", async (req, res) => {
      try {
        const find = req.params.agentEmail;
        const query = { agentemail: find };
        console.log(query);
        const result = await payments.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
      }
    });

    // Payment Related Api *Post*
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { OfferedPrice } = req.body;
        const amount = parseInt(OfferedPrice * 100);
        console.log(amount, "amount inside the intent");
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error.message);
      }
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const boughtStatus = { _id: new ObjectId(payment.paymentId) };
      const updateStatus = {
        $set: {
          requstStatus: "Bought",
          transactionId: payment.transjectionId,
        },
      };
      const status = await allRequst.updateOne(boughtStatus, updateStatus);
      const result = await payments.insertOne(payment);
      console.log("payment info", payment);
      res.send({ result, status });
    });

    //  =======================================================================
    //  get all requst  data by agent user email
    app.get("/requstData/:email", verifyToken, async (req, res) => {
      const find = req.params.email;
      const query = { agentEmail: find };
      const cursor = allRequst.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // patch methoud
    app.patch("/buyRequst", verifyToken, verifyAgent, async (req, res) => {
      const response = req.body; // for accepted
      const objId = req.query.objectId;
      const buyeremail = req.query.buyerEmail;
      const productid = req.query.productId;

      const filter = { _id: new ObjectId(objId) };
      const updatedDoc = {
        $set: {
          requstStatus: response.respons,
        },
      };
      const result = await allRequst.updateOne(filter, updatedDoc);
      if (result.modifiedCount > 0 && response.respons === "accepted") {
        const query = {
          buyerEmail: buyeremail,
          productId: productid,
          requstStatus: "pending",
        };
        const updatedDocTwo = {
          $set: {
            requstStatus: "rejected",
          },
        };
        const resultTwo = await allRequst.updateMany(query, updatedDocTwo);
        console.log(resultTwo);
      }
      res.send(result);
    });

    // ______________________________________________________________

    // ===================================================
    //  what we do related api
    // =======================================
    app.get("/whatWeProvide", async (req, res) => {
      const cursor = whatWeProvide.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // ==========================================================
    //  sold related api
    //  =============================================================
    // _____________________________________________________________
    app.get("/soldProduct/:email", async (req, res) => {
      const email = req.params.email;
      const query = { agentEmail: email };
      const cursor = payments.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // _______________________________________________________

    //          home
    // __________________________________________________________

    app.get("/img", async (req, res) => {
      const cursor = allPropertes.find().limit(4);
      const result = await cursor.toArray();
      res.send(result);
    });
    // ________________________________________________________

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
// ========================================
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
