const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./model/userModel');  

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://ecom-multi.shop/user/auth/google/callback",  
}, async (token, tokenSecret, profile, done) => {
  try {

    const existingUser = await User.findOne({ email: profile.emails[0].value });

    if (existingUser) {
      
      return done(null, existingUser);  
    } else {

      const newUser = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
      });

      await newUser.save();  
      return done(null, newUser);  
    }
  } catch (error) {
    console.error('Error during Google authentication:', error);
    return done(error, null);  
  }
}));

  

passport.serializeUser((user, done) => {
    done(null, user.id);  
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id); 
      done(null, user);  
    } catch (error) {
      done(error, null);  
    }
  });
  