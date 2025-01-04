const express = require('express')
const userRouter = require('./routes/user') 
const adminRouter = require('./routes/admin')
const path =  require('path')
const connectDB = require('./db/config')
const session = require('express-session')
const exphbs = require('express-handlebars');
const nocache = require('nocache')
const passport = require("passport");
const morgan = require('morgan');
require('dotenv').config();
require('./passport')

const app = express();
connectDB();


// No-cache middleware
app.use(nocache());
app.use(morgan('tiny'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,  // A secret key for signing the session ID
  resave: false,  // Don't save session if unmodified
  saveUninitialized: true,  // Save new sessions even if not modified
  cookie: { secure: false },  // Set to true if you're using https
}));

app.use(passport.initialize());
app.use(passport.session());


app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'layouts', // Specify default layout
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'), // Add partials directory
  runtimeOptions: {
        allowProtoPropertiesByDefault: true  // Disable prototype access restriction
    }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }));// Middleware to parse URL-encoded data (e.g., form submissions)
app.use(express.json()); // Middleware to parse JSON data

app.use('/user', userRouter)
app.use('/admin', adminRouter)


app.listen(3001, () => { console.log("Server has started"); })


