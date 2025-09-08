export interface CustomError extends Omit<Error, 'name'> {
    name?: string; 
    statusCode?: number; 
}