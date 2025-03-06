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

const app = express();

// Database connection
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "momoshop",
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

// Routes
app.get("/", async (req, res) => {
  res.render("home", { user: req.user });
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

app.get("/admin", async (req, res) => {
  if (!req.user || req.user.role !== "admin") return res.redirect("/");
  const [foods] = await db.query("SELECT * FROM foods");
  res.render("admin", { foods });
});

app.get("/admin/momo", (req, res) => {
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
    res.redirect("/admin/momo");
  } catch (err) {
    req.flash("error", "An error occurred while adding momo.");
    res.redirect("/admin/momo");
  }
});

// Start the server
app.listen(3000, () => console.log("Server running on port 3000"));
