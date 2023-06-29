const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const redis = require("redis");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(
    "mongodb+srv://yogendra:yogendra@cluster0.r2gbftx.mongodb.net/todo_app",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

const TodoSchema = new mongoose.Schema({
  title: String,
  description: String,
  dateTime: String,
  color: String,
});

const Todo = mongoose.model("Todo", TodoSchema);

let redisClient;

(async () => {
  redisClient = redis.createClient();

  redisClient.on("error", (error) => console.error(`Error : ${error}`));

  await redisClient.connect();
})();

async function fetchApiData() {
  try {
    const data = await Todo.find({});
    return data;
  } catch (error) {
    return error.message;
  }
}

const checkCache = async (req, res) => {
  let results;
  try {
    const cacheResults = await redisClient.get("todos");
    if (cacheResults) {
      results = JSON.parse(cacheResults);
    } else {
      results = await fetchApiData();
      if (results.length === 0) {
        throw "returned an empty array";
      }
      await redisClient.set("todos", JSON.stringify(results));
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(404).send("Data unavailable");
  }
};

// Routes

app.get("/api/todos", checkCache);

// Create a new todo
app.post("/api/todos", async (req, res) => {
  try {
    const { title, description, dateTime, color } = req.body;
    const newTodo = new Todo({
      title,
      description,
      dateTime,
      color,
    });
    const savedTodo = await newTodo.save();

    const todos = await Todo.find();

    redisClient.set("todos", JSON.stringify(todos), (err) => {
      if (err) {
        console.error("Error updating Redis data:", err);
      }
    });

    res.status(201).json(savedTodo);
  } catch (error) {
    console.error("Error creating todo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      { title, description },
      { new: true }
    );

    const todos = await Todo.find();

    redisClient.set("todos", JSON.stringify(todos), (err) => {
      if (err) {
        console.error("Error updating Redis data:", err);
      }
    });

    res.json(updatedTodo);
  } catch (error) {
    console.error("Error updating todo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Todo.findByIdAndDelete(id);

    const todos = await Todo.find();

    redisClient.set("todos", JSON.stringify(todos), (err) => {
      if (err) {
        console.error("Error updating Redis data:", err);
      }
    });

    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting todo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
