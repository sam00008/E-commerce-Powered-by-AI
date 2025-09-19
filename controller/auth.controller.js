import { ApiResponse } from "../utils/api_Response.js";
import { ApiError } from "../utils/api_Error.js";
import { asyncHandler } from "../utils/async-handler.js";
import validator from "validator";
import bcrypt from "bcryptjs";
import User from "../model/userModel.js"; // ✅ Correct import

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

export { registerUser };
