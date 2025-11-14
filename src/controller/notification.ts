import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { NotificationModel } from "../models/Notification";
import { UserModel } from "../models/User";
import { BadRequestError } from "../utils/errors";

// Get all notifications for the current user
const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const userId = req.userId;
        const companyId = req.user.companyId;

        // Mark user's newNotification as false when they fetch notifications
        await UserModel.findByIdAndUpdate(userId, { newNotification: false }, { new: true });

        const notifications = await NotificationModel.find({
            userId: userId,
            companyId: companyId,
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('timesheetId', 'weekStart weekEnd status')
            .lean();

        SUCCESS(res, 200, "Notifications fetched successfully", { data: { notifications } });
    } catch (error) {
        console.log("error in getNotifications", error);
        next(error);
    }
};

// Mark notification as read
const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { notificationId } = req.params;
        const userId = req.userId;

        const notification = await NotificationModel.findOne({
            _id: notificationId,
            userId: userId,
        });

        if (!notification) {
            throw new BadRequestError("Notification not found");
        }

        notification.isRead = true;
        await notification.save();

        SUCCESS(res, 200, "Notification marked as read", { data: {} });
    } catch (error) {
        console.log("error in markNotificationAsRead", error);
        next(error);
    }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const userId = req.userId;
        const companyId = req.user.companyId;

        await NotificationModel.updateMany(
            {
                userId: userId,
                companyId: companyId,
                isRead: false,
            },
            {
                isRead: true,
            }
        );

        SUCCESS(res, 200, "All notifications marked as read", { data: {} });
    } catch (error) {
        console.log("error in markAllNotificationsAsRead", error);
        next(error);
    }
};

export default { getNotifications, markNotificationAsRead, markAllNotificationsAsRead };

