import { Webhook } from "svix";
import User from "../models/User.js";
import stripe from "stripe";
import { Purchase } from "../models/Purchase.js";
import Course from "../models/Course.js";



// =====================================================
// CLERK WEBHOOK
// =====================================================

// API Controller Function to Manage Clerk User with database
export const clerkWebhooks = async (req, res) => {
    try {

        // Create a Svix instance with Clerk webhook secret
        const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

        // Verify Clerk webhook headers
        await whook.verify(JSON.stringify(req.body), {
            "svix-id": req.headers["svix-id"],
            "svix-timestamp": req.headers["svix-timestamp"],
            "svix-signature": req.headers["svix-signature"]
        });

        // Get data from request body
        const { data, type } = req.body;

        // Handle different Clerk events
        switch (type) {

            // =====================================================
            // USER CREATED
            // =====================================================

            case "user.created": {

                const userData = {
                    _id: data.id,
                    email: data.email_addresses[0].email_address,
                    name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
                    imageUrl: data.image_url,
                    resume: ""
                };

                await User.create(userData);

                return res.json({
                    success: true,
                    message: "User created"
                });
            }


            // =====================================================
            // USER UPDATED
            // =====================================================

            case "user.updated": {

                const userData = {
                    email: data.email_addresses[0].email_address,
                    name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
                    imageUrl: data.image_url
                };

                await User.findByIdAndUpdate(data.id, userData);

                return res.json({
                    success: true,
                    message: "User updated"
                });
            }


            // =====================================================
            // USER DELETED
            // =====================================================

            case "user.deleted": {

                await User.findByIdAndDelete(data.id);

                return res.json({
                    success: true,
                    message: "User deleted"
                });
            }


            // =====================================================
            // OTHER CLERK EVENTS
            // =====================================================

            default:
                return res.json({
                    success: true,
                    message: "Unhandled Clerk event"
                });
        }

    } catch (error) {

        console.error("Clerk Webhook Error:", error);

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};



// =====================================================
// STRIPE INITIALIZATION
// =====================================================

// Stripe Gateway Initialize
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);



// =====================================================
// STRIPE WEBHOOK
// =====================================================

// Stripe Webhooks to Manage Payments Action
export const stripeWebhooks = async (request, response) => {

    const sig = request.headers["stripe-signature"];

    let event;

    // =====================================================
    // VERIFY STRIPE WEBHOOK SIGNATURE
    // =====================================================

    try {

        event = stripeInstance.webhooks.constructEvent(
            request.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

    } catch (err) {

        console.error("Stripe Webhook Error:", err.message);

        return response
            .status(400)
            .send(`Webhook Error: ${err.message}`);
    }


    try {

        // =====================================================
        // HANDLE STRIPE EVENTS
        // =====================================================

        switch (event.type) {


            // =====================================================
            // CHECKOUT SESSION COMPLETED
            // =====================================================

            case "checkout.session.completed": {

                const session = event.data.object;

                // Get Purchase ID directly from Checkout Session metadata
                const purchaseId = session.metadata?.purchaseId;

                if (!purchaseId) {

                    console.error(
                        "Purchase ID missing from checkout session"
                    );

                    return response.status(400).json({
                        success: false,
                        message: "Purchase ID missing from checkout session"
                    });
                }


                // =================================================
                // FIND PURCHASE
                // =================================================

                const purchaseData = await Purchase.findById(
                    purchaseId
                );

                if (!purchaseData) {

                    console.error(
                        "Purchase not found:",
                        purchaseId
                    );

                    return response.status(404).json({
                        success: false,
                        message: "Purchase not found"
                    });
                }


                // =================================================
                // IDEMPOTENCY CHECK
                // =================================================

                // Prevent duplicate processing
                if (purchaseData.status === "completed") {

                    return response.json({
                        received: true,
                        message: "Purchase already completed"
                    });
                }


                // =================================================
                // FIND USER AND COURSE
                // =================================================

                const userData = await User.findById(
                    purchaseData.userId
                );

                const courseData = await Course.findById(
                    purchaseData.courseId
                );


                if (!userData || !courseData) {

                    console.error(
                        "User or Course not found"
                    );

                    return response.status(404).json({
                        success: false,
                        message: "User or Course not found"
                    });
                }


                // =================================================
                // ENROLL USER IN COURSE
                // =================================================

                // Add course to user's enrolled courses
                // only if not already enrolled

                if (
                    !userData.enrolledCourses.some(
                        id =>
                            id.toString() ===
                            courseData._id.toString()
                    )
                ) {

                    userData.enrolledCourses.push(
                        courseData._id
                    );

                    await userData.save();
                }


                // =================================================
                // ADD USER TO COURSE STUDENTS
                // =================================================

                // Add user to course's enrolled students
                // only if not already enrolled

                if (
                    !courseData.enrolledStudents.includes(
                        userData._id
                    )
                ) {

                    courseData.enrolledStudents.push(
                        userData._id
                    );

                    await courseData.save();
                }


                // =================================================
                // MARK PURCHASE AS COMPLETED
                // =================================================

                purchaseData.status = "completed";

                await purchaseData.save();


                console.log(
                    `Purchase ${purchaseId} completed successfully`
                );

                break;
            }


            // =====================================================
            // PAYMENT FAILED
            // =====================================================

            case "payment_intent.payment_failed": {

                const paymentIntent = event.data.object;

                const paymentIntentId = paymentIntent.id;


                // Find Checkout Session
                const sessions =
                    await stripeInstance.checkout.sessions.list({
                        payment_intent: paymentIntentId,
                        limit: 1
                    });


                // No session found
                if (!sessions.data.length) {

                    console.error(
                        "Checkout session not found for failed payment:",
                        paymentIntentId
                    );

                    return response.status(400).json({
                        success: false,
                        message: "Checkout session not found"
                    });
                }


                // Get Purchase ID
                const purchaseId =
                    sessions.data[0].metadata?.purchaseId;


                if (!purchaseId) {

                    console.error(
                        "Purchase ID missing from failed checkout session"
                    );

                    return response.status(400).json({
                        success: false,
                        message: "Purchase ID missing from checkout session"
                    });
                }


                // Find Purchase
                const purchaseData =
                    await Purchase.findById(purchaseId);


                if (!purchaseData) {

                    console.error(
                        "Purchase not found:",
                        purchaseId
                    );

                    return response.status(404).json({
                        success: false,
                        message: "Purchase not found"
                    });
                }


                // Mark purchase as failed
                purchaseData.status = "failed";

                await purchaseData.save();


                console.log(
                    `Purchase ${purchaseId} marked as failed`
                );

                break;
            }


            // =====================================================
            // OTHER EVENTS
            // =====================================================

            default:

                console.log(
                    `Unhandled event type: ${event.type}`
                );

                break;
        }


        // =====================================================
        // ACKNOWLEDGE STRIPE WEBHOOK
        // =====================================================

        return response.json({
            received: true
        });


    } catch (error) {

        console.error(
            "Stripe Webhook Processing Error:",
            error
        );

        return response.status(500).json({
            success: false,
            message: error.message
        });
    }
};