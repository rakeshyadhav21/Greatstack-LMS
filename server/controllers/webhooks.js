import { Webhook } from "svix";
import User from "../models/User.js";
import stripe from "stripe";
import { Purchase } from "../models/Purchase.js";
import Course from "../models/Course.js";



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


            case "user.deleted": {

                await User.findByIdAndDelete(data.id);

                return res.json({
                    success: true,
                    message: "User deleted"
                });
            }


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



// Stripe Gateway Initialize
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);



// Stripe Webhooks to Manage Payments Action
export const stripeWebhooks = async (request, response) => {

    const sig = request.headers["stripe-signature"];

    let event;

    // Verify Stripe webhook signature
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

        // Handle Stripe events
        switch (event.type) {

            // =====================================================
            // PAYMENT SUCCESS
            // =====================================================
            case "payment_intent.succeeded": {

                const paymentIntent = event.data.object;
                const paymentIntentId = paymentIntent.id;

                // Find the Checkout Session using Payment Intent ID
                const sessions = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntentId,
                    limit: 1
                });

                // Make sure a Checkout Session exists
                if (!sessions.data.length) {

                    console.error(
                        "Checkout session not found for payment:",
                        paymentIntentId
                    );

                    return response.status(400).json({
                        success: false,
                        message: "Checkout session not found"
                    });
                }

                // Get purchase ID from Checkout Session metadata
                const purchaseId = sessions.data[0].metadata?.purchaseId;

                if (!purchaseId) {

                    console.error(
                        "Purchase ID missing from checkout session"
                    );

                    return response.status(400).json({
                        success: false,
                        message: "Purchase ID missing from checkout session"
                    });
                }


                // Find Purchase
                const purchaseData = await Purchase.findById(purchaseId);

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


                // If already completed, don't process again
                if (purchaseData.status === "completed") {

                    return response.json({
                        received: true,
                        message: "Purchase already completed"
                    });
                }


                // Find User
                const userData = await User.findById(
                    purchaseData.userId
                );

                // Find Course
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
                        id => id.toString() === courseData._id.toString()
                    )
                ) {

                    userData.enrolledCourses.push(
                        courseData._id
                    );

                    await userData.save();
                }


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


                // Mark purchase as completed
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
                const sessions = await stripeInstance.checkout.sessions.list({
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


                // Get purchase ID
                const purchaseId = sessions.data[0].metadata?.purchaseId;

                if (!purchaseId) {

                    console.error(
                        "Purchase ID missing from failed checkout session"
                    );

                    return response.status(400).json({
                        success: false,
                        message: "Purchase ID missing from checkout session"
                    });
                }


                // Find purchase
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


        // Acknowledge Stripe webhook
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
