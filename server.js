require('dotenv').config();
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
const rateLimit = require('express-rate-limit');
const cartWishlistMiddleware = require('./middlewares/cartWishlistMiddleware')


require('./passport');

const app = express();
// Connect to the database
connectDB();
// Middleware
app.use(nocache());
app.use(morgan('tiny'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration

const MongoStore = require('connect-mongo');

app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: 'mongodb://13.60.20.41:27017/eCommerceDB',
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    },
  })
);

const noCache = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};

app.use(noCache);



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
    return a === b;
  },
  multiply: function (price, quantity) {
    return price * quantity;
  },
  increment: function (index) {
    return index + 1;
  },
  ifEquals: function (a, b, options) {
    if (a === b) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  },
  pagination: function (currentPage, totalPages, options) {
    let output = '';
    for (let page = 1; page <= totalPages; page++) {
      if (page === currentPage) {
        output += `<li class="page-item active"><a class="page-link" href="/user/products?page=${page}">${page}</a></li>`;
      } else {
        output += `<li class="page-item"><a class="page-link" href="/user/products?page=${page}">${page}</a></li>`;
      }
    }
    return new Handlebars.SafeString(output);
  },

  randomId: function () {
    return Math.random().toString(36).substr(2, 9);  // Generate a random alphanumeric string
  },
  range: function (start, end) {
    let result = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  },
  add: function (a, b) {
    return a + b;
  }, hasPrevious: function (page, options) {
    if (page > 1) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  },
  hasNext: function (page, totalPages, options) {
    if (page < totalPages) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  }


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
    ...helpers,
    ...customHelpers,
  },
}));


app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/user', cartWishlistMiddleware, userRouter);
app.use('/admin', adminRouter);

app.get('/', (req, res) => {
  res.redirect('/user/login');
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started`);
});

// 404 Error Handler (Page Not Found)
app.use((req, res, next) => {
  res.status(404).render('user/404');
});

// 500 Error Handler (Internal Server Error)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('user/500');
});
