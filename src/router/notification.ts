import notificationController from "../controller/notification";
import express from "express";
import { authenticate } from "../middleware/auth";

const notificationRouter = express.Router();

notificationRouter.get("/", authenticate, notificationController.getNotifications);
notificationRouter.put("/:notificationId/read", authenticate, notificationController.markNotificationAsRead);
notificationRouter.put("/read-all", authenticate, notificationController.markAllNotificationsAsRead);
notificationRouter.delete("/:notificationId", authenticate, notificationController.deleteNotification);

export default notificationRouter;

