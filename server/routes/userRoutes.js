import express from 'express'
import {
    addUserRating,
    getUserCourseProgress,
    getUserData,
    purchaseCourse,
    updateUserCourseProgress,
    userEnrolledCourses
} from '../controllers/userController.js';

import { protectUser } from '../middlewares/authMiddleware.js';

const userRouter = express.Router()

// Get user Data
userRouter.get('/data', protectUser, getUserData);
userRouter.post('/purchase', protectUser, purchaseCourse);
userRouter.get('/enrolled-courses', protectUser, userEnrolledCourses);
userRouter.post('/update-course-progress', protectUser, updateUserCourseProgress);
userRouter.post('/get-course-progress', protectUser, getUserCourseProgress);
userRouter.post('/add-rating', protectUser, addUserRating);

export default userRouter;