export class CastError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "CastError";
        this.statusCode = 404;
        Object.setPrototypeOf(this, CastError.prototype);
    }
}

export class ValidationError extends Error {
    statusCode: number;
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
        this.statusCode = 400;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export class UnauthorizedError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "UnauthorizedError";
        this.statusCode = 401;
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}

export class SyntaxError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "SyntaxError";
        this.statusCode = 400;
        Object.setPrototypeOf(this, SyntaxError.prototype);
    }
}

export class JsonWebTokenError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "JsonWebTokenError";
        this.statusCode = 401;
        Object.setPrototypeOf(this, JsonWebTokenError.prototype);
    }
}

export class TokenExpiredError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "TokenExpiredError";
        this.statusCode = 401;
        Object.setPrototypeOf(this, TokenExpiredError.prototype);
    }
}

export class MongoError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "MongoError";
        this.statusCode = 500;
        Object.setPrototypeOf(this, MongoError.prototype);
    }
}

export class TypeError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "TypeError";
        this.statusCode = 400;
        Object.setPrototypeOf(this, TypeError.prototype);
    }
}

export class ReferenceError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "ReferenceError";
        this.statusCode = 400;
        Object.setPrototypeOf(this, ReferenceError.prototype);
    }
}

export class RangeError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "RangeError";
        this.statusCode = 400;
        Object.setPrototypeOf(this, RangeError.prototype);
    }
}

export class URIError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "URIError";
        this.statusCode = 400;
        Object.setPrototypeOf(this, URIError.prototype);
    }
}

export class NotFoundError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
        this.statusCode = 404;
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class ForbiddenError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "ForbiddenError";
        this.statusCode = 403;
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}

export class ConflictError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "ConflictError";
        this.statusCode = 409;
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

export class TooManyRequestsError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "TooManyRequestsError";
        this.statusCode = 429;
        Object.setPrototypeOf(this, TooManyRequestsError.prototype);
    }
}

export class InternalServerError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "InternalServerError";
        this.statusCode = 500;
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}

export class ServiceUnavailableError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "ServiceUnavailableError";
        this.statusCode = 503;
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}

export class RequestTimeoutError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "RequestTimeoutError";
        this.statusCode = 408;
        Object.setPrototypeOf(this, RequestTimeoutError.prototype);
    }
}

export class BadRequestError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "BadRequestError";
        this.statusCode = 400;
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}

export class NotImplementedError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "NotImplementedError";
        this.statusCode = 501;
        Object.setPrototypeOf(this, NotImplementedError.prototype);
    }
}

export class GatewayTimeoutError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "GatewayTimeoutError";
        this.statusCode = 504;
        Object.setPrototypeOf(this, GatewayTimeoutError.prototype);
    }
}

export class DeprecationError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "DeprecationError";
        this.statusCode = 410;
        Object.setPrototypeOf(this, DeprecationError.prototype);
    }
}

export class InvalidInputError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "InvalidInputError";
        this.statusCode = 422;
        Object.setPrototypeOf(this, InvalidInputError.prototype);
    }
}

export class PaymentRequiredError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = "PaymentRequiredError";
        this.statusCode = 402;
        Object.setPrototypeOf(this, PaymentRequiredError.prototype);
    }
}
