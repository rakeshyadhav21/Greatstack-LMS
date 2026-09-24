import { clerkClient } from "@clerk/express";

// Protect authenticated user routes
export const protectUser = async (req, res, next) => {
    try {
        if (!req.auth?.userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login."
            });
        }

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};


// Protect Educator Routes
export const protectEducator = async (req, res, next) => {
    try {
        if (!req.auth?.userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login."
            });
        }

        const userId = req.auth.userId;

        const response = await clerkClient.users.getUser(userId);

        if (response.publicMetadata.role !== "educator") {
            return res.status(403).json({
                success: false,
                message: "Unauthorized Access"
            });
        }

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};