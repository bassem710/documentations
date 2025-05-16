const { default: axios } = require("axios");
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");

class GoogleAuthController {
  // @desc    Get all banners
  // @route   GET /banner
  // @access  Private
  static continueWithGoogle = async (req, res, next) => {
    try {
      // Check google access token
      if (!req.body.googleAccessToken)
        return next(new ApiError("Google access token is required", 400));
      // language
      let lang = "En";
      switch (req.headers.lang?.toLowerCase()) {
        case "ar":
          lang = "Ar";
          break;
        default:
          break;
      }
      // Msg
      let message;
      // Get userinfo data from Google API
      axios
        .get("https://www.googleapis.com/oauth2/v1/userinfo", {
          headers: {
            Authorization: `Bearer ${req.body.googleAccessToken}`
          }
        })
        .then(async (response) => {
          const email = response.data.email;
          // Check user
          const query = User.findOne({ email });
          query.lang = lang;
          let user = await query;
          let completeProfile = false;
          if (!user) {
            const firstName = response.data.given_name;
            const lastName = response.data.family_name;
            const image = response.data.picture;
            const isEmailVerified = response.data.verified_email;
            if (!isEmailVerified)
              return next(
                new ApiError("Your account email is not verified", 400)
              );
            user = await User.create({
              email,
              firstName,
              lastName,
              image,
              googleLinked: true,
              isVerified: true,
              notificationToken: req.body.notificationToken || ""
            });
            message = `Registered successfully as ${email}`;
            completeProfile = true;
          } else {
            // Check if the user has linked their Google account
            // if (!user.googleLinked)
            //   return next(
            //     new ApiError("This email is not linked to Google account", 400)
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
          // generate token
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
        })
        .catch((err) => {
          if (err.status === 401)
            return next(new ApiError("Invalid Google access token", 401));
          next(new ApiError("Failed to authenticate with Google", 400));
        });
    } catch (error) {
      next(new ApiError("Failed to authenticate with Google", 400));
    }
  };
}

module.exports = GoogleAuthController;
