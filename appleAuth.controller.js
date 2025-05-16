const expressAsyncHandler = require("express-async-handler");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const ApiError = require("../utils/ApiError");
const User = require("../models/user.model");

const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID;
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;

// Generate the Apple JWT for validation
function generateAppleJWT(useBundleId) {
  const token = jwt.sign(
    {
      iss: APPLE_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      aud: "https://appleid.apple.com",
      sub: useBundleId ? APPLE_BUNDLE_ID : APPLE_CLIENT_ID
    },
    APPLE_PRIVATE_KEY,
    {
      algorithm: "ES256",
      header: { alg: "ES256", kid: APPLE_KEY_ID }
    }
  );
  return token;
}

// Verify the authorization code from Apple
async function verifyAppleToken(authCode, useBundleId) {
  const clientSecret = generateAppleJWT(useBundleId);
  const response = await axios.post(
    "https://appleid.apple.com/auth/token",
    null,
    {
      params: {
        client_id: useBundleId === true ? APPLE_BUNDLE_ID : APPLE_CLIENT_ID,
        client_secret: clientSecret,
        code: authCode,
        grant_type: "authorization_code"
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }
  );
  return response.data;
}

class AppleAuthController {
  // @desc    Continue with apple
  // @route   POST /admin/auth/apple
  // @access  Public
  static continueWithApple = expressAsyncHandler(async (req, res, next) => {
    const { authorizationCode, useBundleId = false } = req.body;
    if (!authorizationCode)
      throw new ApiError("Authorization code is required", 400);
    // language
    let lang = "En";
    switch (req.headers.lang?.toLowerCase()) {
      case "ar":
        lang = "Ar";
        break;
      default:
        break;
    }
    try {
      // Get userinfo data from Apple API
      const tokenResponse = await verifyAppleToken(
        authorizationCode,
        useBundleId
      );
      // Extract user info from the ID token
      const idToken = tokenResponse.id_token;
      const decodedToken = jwt.decode(idToken);
      const { name, email, email_verified } = decodedToken;
      // Check if the user is already registered
      let user, message;
      let completeProfile = false;
      const query = User.findOne({ email });
      query.lang = lang;
      user = await query;
      if (!user) {
        // Check if the email is verified
        if (!email_verified)
          return next(
            new ApiError("Your apple account email is not verified", 400)
          );
        const newUser = {
          firstName: name?.split(" ")[0] || undefined,
          lastName: name?.split(" ")[1] || undefined,
          email,
          isVerified: true,
          appleLinked: true,
          notificationToken: req.body.notificationToken || ""
        };
        user = await User.create(newUser);
        message = `Registered successfully as ${email}`;
        completeProfile = true;
      } else {
        // Check if the user has linked their Apple account
        // if (!user.appleLinked)
        //   return next(
        //     new ApiError("This email is not linked to an Apple account", 400)
        //   );
        // Check if the user is blocked
        if (user.isBlocked)
          return next(
            new ApiError(
              "Your account is blocked, please contact the support team",
              401
            )
          );
        // Check if the user has completed their profile
        if (
          !user.firstName ||
          !user.lastName ||
          !user.phone ||
          !user.governorate
        ) {
          completeProfile = true;
          message = "Please complete your profile to continue";
        } else {
          // Update user data
          message = `Welcome back ${user.firstName}!`;
          user.notificationToken = req.body.notificationToken || "";
          await user.save();
        }
      }
      // Generate token
      const token = await user.generateToken();
      // remove password
      user.password = undefined;
      // Response
      res.status(200).json({
        success: true,
        message,
        completeProfile,
        data: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          phone: user.phone,
          googleLinked: user.googleLinked,
          appleLinked: user.appleLinked,
          governorate: user.governorate
        },
        token: token.token
      });
    } catch (error) {
      return next(new ApiError("Failed to authenticate with Apple", 400));
    }
  });

  // @desc    Apple callback for testing
  // @route   POST /admin/auth/apple/callback
  // @access  Public
  static appleCallback = expressAsyncHandler(async (req, res, next) => {
    console.log("apple callback: ", {
      body: req.body,
      params: req.params,
      query: req.query
    });
    res.json({ body: req.body, params: req.params, query: req.query });
  });
}

module.exports = AppleAuthController;
