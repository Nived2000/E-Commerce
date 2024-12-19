const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./model/userModel');  // Import your User model

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3001/user/auth/google/callback",  // Adjust if necessary
}, async (token, tokenSecret, profile, done) => {
  try {
    // Search for an existing user based on the Google profile's email
    const existingUser = await User.findOne({ email: profile.emails[0].value });

    if (existingUser) {
      // Handle the case where the email already exists (login existing user)
      return done(null, existingUser);  // Skip registration and log in the existing user
    } else {
      // If the user does not exist, create a new one
      const newUser = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
      });

      await newUser.save();  // Save the new user to the database
      return done(null, newUser);  // Pass the new user object to done (serialize into session)
    }
  } catch (error) {
    console.error('Error during Google authentication:', error);
    return done(error, null);  // Handle errors appropriately
  }
}));

  
// Deserialize user from the session
// Assuming you're using MongoDB and User model

passport.serializeUser((user, done) => {
    done(null, user.id);  // Store only the user's id in the session
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);  // Retrieve the user object by id from DB
      done(null, user);  // Pass the user object to the session
    } catch (error) {
      done(error, null);  // Handle any errors
    }
  });
  