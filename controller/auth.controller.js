import { ApiResponse } from "../utils/api_Response.js";
import { ApiError } from "../utils/api_Error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { forgotPasswordMailgenContent, sendEmail } from "../utils/mail.js";
import validator from "validator";
import User from "../model/userModel.js"; // ✅ Correct import
import crypto from "crypto";
// Generate Access & Refresh Tokens
const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found while generating tokens");
        }

        const AccessToken = user.generateAccessToken();
        const RefreshToken = user.generateRefreshToken();

        // Save refresh token to DB
        user.refreshToken = RefreshToken;
        await user.save({ validateBeforeSave: false });

        return { AccessToken, RefreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    // 1. Check if user already exists
    const existedUser = await User.findOne({ email });
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    // 2. Validate email
    if (!validator.isEmail(email)) {
        throw new ApiError(400, "Please enter a valid email address");
    }

    // 3. Validate password
    if (password.length < 5) {
        throw new ApiError(401, "Password must be at least 5 characters long");
    }

    // 4. Create new user
    const user = await User.create({ name, email, password });

    // 5. Fetch user without password
    const createdUser = await User.findById(user._id).select("-password");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    // 6. Generate tokens
    const { AccessToken, RefreshToken } = await generateAccessAndRefreshToken(user._id);

    // 7. Send success response
    return res.status(201).json(
        new ApiResponse(
            201,
            {
                user: createdUser,
                AccessToken,
                RefreshToken
            },
            "User registered successfully"
        )
    );
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(400, "User does not exist");
    }
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Password is incorrect");
    }

    const { AccessToken, RefreshToken } = await generateAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findOne(user._id).select(
        "-password  -refreshToken -cartData"
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", AccessToken, options)
        .cookie("refreshToken", RefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken: AccessToken,
                    refreshToken: RefreshToken
                },
                "User logged in successfully"
            )
        )
});

const logoutUser = asyncHandler(async (req, res) => {
    // 1. Clear the refresh token in database
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: "" }
        },
        { new: true }
    );

    // 2. Define cookie options
    const options = {
        httpOnly: true,
        secure: true, // Use secure cookies in production
    };

    // 3. Clear cookies and return response
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User logged out successfully"
            )
        );
});

const forgetPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!validator.isEmail(email)) {
        throw new ApiError(400, "Please enter a valid email address");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();
    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });

    await sendEmail({
        email: user.email,
        subject: "Reset your Password",
        mailgenContent: forgotPasswordMailgenContent(
            user.name,
            `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`
        )
    });

    return res
        .status(200)
        .json({
            message: "Password reset mail sent successfully",
            success: true
        });
});

const resetForgotPassword = asyncHandler(async (req, res) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(489, "Token is invalid or expired");
    }

    user.password = newPassword;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    await user.save();

    return res
        .status(200)
        .json({
            message: "Password reset successfully",
            success: true
        });
});

export {
    registerUser,
    loginUser,
    logoutUser,
    forgetPassword,
    resetForgotPassword
};
