import { NextFunction, Request, Response } from "express";
import { SUCCESS, ERROR } from "../utils/response";
import { NotesModel } from "../models/Notes";
import { BadRequestError } from "../utils/errors";

const addNote = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { note, timesheetId, clientId } = req.body;
        
        // Validate that at least one of timesheetId or clientId is provided
        if (!timesheetId && !clientId) {
            throw new BadRequestError("Either timesheetId or clientId must be provided");
        }

        // Add createdBy from authenticated user
        const noteData = {
            note,
            timesheetId: timesheetId || undefined,
            clientId: clientId || undefined,
            createdBy: req.userId
        };

        const createdNote = await NotesModel.create(noteData);
        
        // Populate createdBy to get user details
        await createdNote.populate('createdBy', 'name avatarUrl');
        
        SUCCESS(res, 200, "Note created successfully", { data: createdNote });
    } catch (error) {
        console.log("error in addNote", error);
        next(error);
    }
};

const updateNote = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { noteId } = req.params;
        const { note } = req.body;
        
        const updatedNote = await NotesModel.findByIdAndUpdate(
            noteId,
            { note },
            { new: true }
        ).populate('createdBy', 'name avatarUrl');
        
        if (!updatedNote) {
            throw new BadRequestError("Note not found");
        }
        
        SUCCESS(res, 200, "Note updated successfully", { data: updatedNote });
    } catch (error) {
        console.log("error in updateNote", error);
        next(error);
    }
};

const deleteNote = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { noteId } = req.params;
        
        const deletedNote = await NotesModel.findByIdAndDelete(noteId);
        
        if (!deletedNote) {
            throw new BadRequestError("Note not found");
        }
        
        SUCCESS(res, 200, "Note deleted successfully", { data: {} });
    } catch (error) {
        console.log("error in deleteNote", error);
        next(error);
    }
};

const getNotes = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { timesheetId, clientId } = req.query;
        
        // Build query
        const query: any = {};
        if (timesheetId) {
            query.timesheetId = timesheetId;
        }
        if (clientId) {
            query.clientId = clientId;
        }
        
        // If neither is provided, return error
        if (!timesheetId && !clientId) {
            throw new BadRequestError("Either timesheetId or clientId must be provided");
        }
        
        const notes = await NotesModel.find(query)
            .populate('createdBy', 'name avatarUrl')
            .sort({ createdAt: -1 })
            .lean();
        
        SUCCESS(res, 200, "Notes fetched successfully", { data: notes });
    } catch (error) {
        console.log("error in getNotes", error);
        next(error);
    }
};

export default {
    addNote,
    updateNote,
    deleteNote,
    getNotes
};

