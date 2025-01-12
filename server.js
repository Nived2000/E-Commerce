const express = require('express');
const path = require('path');
const session = require('express-session');
const exphbs = require('express-handlebars');
const nocache = require('nocache');
const morgan = require('morgan');
const passport = require('passport');
const helpers = require('handlebars-helpers')(); // Load built-in helpers
const connectDB = require('./db/config');
const userRouter = require('./routes/user');
const adminRouter = require('./routes/admin');

require('dotenv').config();
require('./passport');

const app = express();

// Connect to the database
connectDB();
// Middleware
app.use(nocache());
app.use(morgan('tiny'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data (form submissions)
app.use(express.json()); // Parse JSON data

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }, // Use `true` in production with HTTPS
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Handlebars helpers
const customHelpers = {
  switch: function (value, options) {
    this._switch_value_ = value;
    this._switch_case_matched_ = false;
    return options.fn(this);
  },
  case: function (value, options) {
    if (value === this._switch_value_ && !this._switch_case_matched_) {
      this._switch_case_matched_ = true;
      return options.fn(this);
    }
  },
  default: function (options) {
    if (!this._switch_case_matched_) {
      return options.fn(this);
    }
  },
  formatDate: function (date, format) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', options);
  },
  equals: function (a, b) {
    return a === b; // Return true if values are equal
  },
  multiply: function (price, quantity) {
    return price * quantity; // Return the product of price and quantity
  },
  increment: function (index) {
    return index + 1; // Increment the index (for 1-based indexing)
  },
  ifEquals: function (a, b, options) {
    if (a === b) {
      return options.fn(this); // Render content inside the block if values are equal
    } else {
      return options.inverse(this); // Render the `else` block content if values are not equal
    }
  },
};


// View engine configuration
app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'layouts',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
  },
  helpers: {
    ...helpers, // Include built-in helpers
    ...customHelpers, // Include custom helpers
  },
}));


app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/user', userRouter);
app.use('/admin', adminRouter);

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {

  console.log(`Server started`);
});
