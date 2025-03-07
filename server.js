

// Import required modules
const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const ejs = require("ejs");
const path = require("path");
const flash = require("connect-flash");
require("dotenv").config();

const app = express();

// Database connection
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

// Session configuration
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Flash messages middleware
app.use(flash());

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
        username,
      ]);
      if (rows.length === 0) {
        return done(null, false, { message: "Invalid username or password" });
      }
      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: "Invalid username or password" });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Passport serialization and deserialization
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

// Middleware to ensure the user is an admin
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.redirect("/"); // Redirect to home if not an admin
  }
  next(); // Proceed if user is admin
}

// Routes
app.get("/", async (req, res) => {
  const userId = req.user?.id || null;;
  let orderedMomos = new Set();
  const errorMessage = req.flash("error");
  const successMessage = req.flash("success");
  const requestUrl = '/';

  try {
    if(userId) {
      // Fetch the user's order
      const [orders] = await db.query(
          "SELECT foods.id FROM orders INNER JOIN foods ON orders.momo_id = foods.id WHERE orders.user_id = ?",
          [userId]
      );

      // Create a set of momo IDs that are in the user's order
       orderedMomos = new Set(orders.map(order => order.id));
    }

      // Fetch the available momos (menu)
      const [momos] = await db.query("SELECT * FROM foods");

      res.render("home", { user: req.user, momos, orderedMomos, errorMessage, successMessage, requestUrl });
  } catch (err) {
      console.error("Error fetching orders:", err);
      res.status(500).send("Internal Server Error.");
  }
});


app.get("/menu", async (req, res) => {
  const [foods] = await db.query("SELECT * FROM foods");
  res.render("menu", { user: req.user, foods });
});

app.get("/login", (req, res) => {
  const errorMessage = req.flash("error");
  const successMessage = req.flash("success");
  res.render("login", { errorMessage, successMessage });
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err); // Handle errors
    }
    if (!user) {
      // Authentication failed
      req.flash("error", info.message); // Set flash message
      return res.redirect("/login");
    }
    // Authentication succeeded
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      // Redirect based on user role
      if (user.role === "admin") {
        return res.redirect("/admin");
      } else {
        return res.redirect("/");
      }
    });
  })(req, res, next);
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

app.get("/register", (req, res) => {
  const errorMessage = req.flash("error");
  res.render("register", { errorMessage });
});

app.post("/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await db.query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [req.body.username, hashedPassword, "user"]
    );

    req.flash("success", "Registration successful! You can now log in.");
    res.redirect("/login"); // Redirect to login with success message
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      req.flash("error", "Username already exists");
    } else {
      req.flash("error", "An error occurred during registration");
    }
    res.redirect("/register");
  }
});

// Admin page
app.get("/admin", isAdmin, async (req, res) => {
  const [foods] = await db.query("SELECT * FROM foods");
  res.render("admin", { foods, user: req.user });
});

// Admin momo page
app.get("/admin/momo", isAdmin, (req, res) => {
  res.render("admin-momo", {
    errorMessage: req.flash("error"),
    successMessage: req.flash("success"),
    user: req.user,
  });
});

app.post("/admin/momo", async (req, res) => {
  try {
    const { momoName, momoPrice, imageUrl, momoDescription } = req.body;

    if (!momoName || !momoPrice || !imageUrl || !momoDescription) {
      req.flash("error", "All fields are required.");
      return res.redirect("/admin/momo");
    }
    await db.query(
      "INSERT INTO foods (name, price, image_url, description) VALUES (?, ?, ?, ?)",
      [momoName, momoPrice, imageUrl, momoDescription]
    );


    req.flash("success", "Momo added successfully!");
    res.redirect("/admin");
  } catch (err) {
    console.log("ERRROR", err);
    req.flash("error", "An error occurred while adding momo.");
    res.redirect("/admin/momo");
  }
});

// Admin update momo page
app.get("/admin/update/:id", isAdmin, async (req, res) => {
  const momoId = req.params.id;
  try {
    const [rows] = await db.query("SELECT * FROM foods WHERE id = ?", [momoId]);

    if (rows.length === 0) {
      req.flash("error", "Momo not found.");
      return res.redirect("/admin");
    }

    const momo = rows[0];
    res.render("admin-update", {
      momo,
      errorMessage: req.flash("error"),
      successMessage: req.flash("success"),
      user: req.user,
    });
  } catch (err) {
    console.log("Error fetching momo details:", err);
    req.flash("error", "An error occurred while fetching momo details.");
    res.redirect("/admin");
  }
});

// Post route to update momo details
app.post("/admin/update/:id", isAdmin, async (req, res) => {
  const momoId = req.params.id;
  const { momoName, momoPrice, imageUrl, momoDescription } = req.body;

  if (!momoName || !momoPrice || !imageUrl || !momoDescription) {
    req.flash("error", "All fields are required.");
    return res.redirect(`/admin/update/${momoId}`);
  }

  try {
    await db.query(
      "UPDATE foods SET name = ?, price = ?, image_url = ?, description = ? WHERE id = ?",
      [momoName, momoPrice, imageUrl, momoDescription, momoId]
    );

    req.flash("success", "Momo updated successfully!");
    res.redirect("/admin");
  } catch (err) {
    console.log("Error updating momo:", err);
    req.flash("error", "An error occurred while updating momo.");
    res.redirect(`/admin/update/${momoId}`);
  }
});

// Route to handle delete momo request
app.post("/admin/delete/:id", isAdmin, async (req, res) => {
  const momoId = req.params.id;

  try {
    await db.query("DELETE FROM foods WHERE id = ?", [momoId]);

    req.flash("success", "Momo deleted successfully!");
    res.redirect("/admin");
  } catch (err) {
    console.log("Error deleting momo:", err);
    req.flash("error", "An error occurred while deleting momo.");
    res.redirect("/admin");
  }
});


app.post("/add-to-order", async (req, res) => {
  const { momoId } = req.body;

  if(!req.user) {
    req.flash("error", "You must be logged in to add to order.");
    return res.redirect("/login");
  }
  
  const userId = req.user.id;  // Assuming the user is logged in

  if (!userId || !momoId) {
      return res.status(400).send("Invalid request.");
  }

  try {
      // Check if the user already has this momo in their order
      const [existingOrder] = await db.query(
          "SELECT * FROM orders WHERE user_id = ? AND momo_id = ?",
          [userId, momoId]
      );

      if (existingOrder.length === 0) {
          // If the user doesn't have this momo in their order, insert a new record
          await db.query(
              "INSERT INTO orders (user_id, momo_id) VALUES (?, ?)",
              [userId, momoId]
          );
      }
      req.flash("success", "Added to Order successfully!");
      res.redirect("/");  // Redirect back to the home page
  } catch (err) {
      console.error("Error adding to order:", err);
      req.flash("error", "Error adding to order!");
      res.status(500).send("Internal Server Error.");
  }

});

// Route to handle removing a momo from the user's order
app.post("/remove-from-order", async (req, res) => {
  // Check if the user is logged in
  if (!req.user) {
      // If not logged in, redirect to login page
      return res.redirect("/login");
  }

  const userId = req.user.id;  // Get the user's ID from the session or authentication system
  const momoId = req.body.momoId;  // Get the momo ID from the form submission
  const redirectUrl = req.body.redirectUrl || '/';  // Get the redirect URL from the form, default to homepage

  try {
      // Delete the order entry for the user and momo
      await db.query(
          "DELETE FROM orders WHERE user_id = ? AND momo_id = ?",
          [userId, momoId]
      );

      // Redirect the user back to the page they were on
      req.flash("success", "Removed from Order successfully!");
      res.redirect(redirectUrl);
  } catch (err) {
      console.error("Error removing from order:", err);
      req.flash("error", "Error removing from order!");
      res.status(500).send("Internal Server Error.");
  }
});


// Route to display the user's orders
app.get("/my-order", async (req, res) => {
  // Check if the user is logged in
  if (!req.user) {
      return res.redirect("/login");  // Redirect to login if not logged in
  }
  const errorMessage = req.flash("error");
  const successMessage = req.flash("success");
  const requestUrl = '/my-order';

  const userId = req.user.id; // Get the user's ID from the session or authentication system

  try {
      // Fetch the orders for the logged-in user
      const [orders] = await db.query(
          "SELECT orders.id, foods.id as momo_id, foods.name, foods.description, foods.price, foods.image_url FROM orders JOIN foods ON orders.momo_id = foods.id WHERE orders.user_id = ?",
          [userId]
      );

      // Render the "My Order" page with the user's orders
      res.render("my-order", { user: req.user, orders: orders, errorMessage, successMessage, requestUrl });
  } catch (err) {
      console.error("Error fetching orders:", err);
      res.status(500).send("Internal Server Error.");
  }
});






// Start the server
app.listen(3000, () => console.log("Server running on port 3000"));
