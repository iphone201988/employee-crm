import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {UserModel} from '../models/User';
import path from 'path';
import os from 'os';
import fs from 'fs';
import otpGenerator from 'otp-generator';
import crypto, { randomBytes } from 'crypto';
import mongoose from 'mongoose';



export const hashPassword = async (password: string) => await bcrypt.hash(password, 10);
export const comparePassword = async (password: string, hash: string) => await bcrypt.compare(password, hash);
export const signToken = (payload: any, expiresIn:any = '1y') => jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: expiresIn });

export const verifyToken = (token: string) => jwt.verify(token, process.env.JWT_SECRET as string);



export const findUserBySocialId = async (id: string, provider: number) => await UserModel.findOne({
    socialLinkedAccounts: {
        $elemMatch: { id, provider }
    }
});
export const findUserByReferral = async (referralCode: string) => await UserModel.findOne({ referralCode });
export const findUserByEmail = async (email: string) => await UserModel.findOne({ email });
export const findUserById = async (id: any) => await UserModel.findById(id);
export const publicViewData = (user: any) => {
    return {
        _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl

    }
};



export const generateOtp = (number: number = 4, upperCaseAlphabets: boolean = false, specialChars: boolean = false) => otpGenerator.generate(number, { upperCaseAlphabets: upperCaseAlphabets, specialChars: specialChars, lowerCaseAlphabets: upperCaseAlphabets });
export const otpExpiry = (time: number = 10) => new Date(Date.now() + time * 60 * 1000);

export const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const shuffleArray = <T>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5);


export const parseJsonIfString = (field: any) => {
    if (typeof field === 'string') {
        try {
            return JSON.parse(field);
        } catch {
            return null;
        }
    }
    return field;
};




export const deleteImageFile = (imagePath: string): void => {
    if (!imagePath) return;

    try {
        const resolvedPath = imagePath.includes('uploads')
            ? path.join(__dirname, '..', '..', imagePath)
            : path.join(__dirname, '..', '..', 'uploads', path.basename(imagePath));

        fs.unlink(resolvedPath, (err) => {
            if (err) {
                console.error('Failed to delete image:', err.message);
            } else {
                console.log('Image deleted successfully:', resolvedPath);
            }
        });
    } catch (err) {
        console.error('Error while deleting image file:', err);
    }
};
export const ObjectId =(id:any) => new mongoose.Types.ObjectId(id);



