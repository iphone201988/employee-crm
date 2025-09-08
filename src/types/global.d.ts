import { ObjectId } from "mongoose";
import { IUser } from "./database/type";

declare module "express-serve-static-core" {
  interface Request {
    user?: IUser;
    userId?: ObjectId;
  }
}


export {};
