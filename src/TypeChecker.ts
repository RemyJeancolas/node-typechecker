import 'reflect-metadata';

const propertiesToCheck = Symbol('propertiesToCheck');
const paramsToCheck = Symbol('paramsToCheck');

type onFailure = 'ignore'|'setNull';

export interface PropertyCheckParams {
    type?: any; // tslint:disable-line:no-reserved-keywords
    arrayType?: any;
    required?: boolean;
    nullable?: boolean;
    onFailure?: onFailure;
}

export class ValidationError extends Error {
    public readonly field: string | undefined;
    public readonly errorType: ValidationErrorType | undefined;

    constructor(message: string);
    constructor(message: string, errorType: ValidationErrorType, fields: string[]);
    constructor(message: string, errorType?: ValidationErrorType, fields?: string[]) {
        if (Array.isArray(fields) && fields.length > 0) {
            super(`${fields.join('.')}: ${message}`);
            this.field = fields[fields.length - 1];
        } else {
            super(message);
        }

        if (errorType) {
            this.errorType = errorType;
        }
    }
}

export enum ValidationErrorType {
    NullValue = 'null',
    MissingField = 'missing',
    InvalidType = 'invalid'
}

class InternalError extends Error {
    public fields: string[] = [];
    public errorType: ValidationErrorType;
    public index?: number;

    constructor(message: string, errorType: ValidationErrorType) {
        super(message);
        this.errorType = errorType;
    }
}

export function TypesCheck(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): any {
    const originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]): any {
        if (Array.isArray(target[paramsToCheck]) && target[paramsToCheck].hasOwnProperty(propertyKey)) {
            for (let i = 0; i < args.length; i += 1) {
                if (typeof target[paramsToCheck][propertyKey][i] !== 'undefined') {
                    args[i] = validate(args[i], target[paramsToCheck][propertyKey][i]);
                }
            }
        }

        return originalMethod.apply(this, args);
    };
}

// tslint:disable-next-line:no-reserved-keywords
export function TypeCheck(type: any): any {
    return (target: any, propertyKey: string | symbol, parameterIndex: number): any => {
        if (!Array.isArray(target[paramsToCheck])) {
            target[paramsToCheck] = [];
        }
        if (!target[paramsToCheck].hasOwnProperty(propertyKey)) {
            target[paramsToCheck][propertyKey] = [];
        }
        target[paramsToCheck][propertyKey][parameterIndex] = type;
    };
}

export function PropertyCheck(params: PropertyCheckParams = {}): any {
    return (target: any, key: string | symbol): any => {
        // Define property type
        // tslint:disable-next-line:no-reserved-keywords
        const type = params.type ? params.type : Reflect.getMetadata('design:type', target, key);

        // Check if type is valid
        let expectedType: any;
        try {
            expectedType = new type();
        } catch (e) {
            // Type is invalid, stop here
            return;
        }

        // Add type
        if (!Array.isArray(target[propertiesToCheck])) {
            target[propertiesToCheck] = [];
        }

        // Create an array specific to current class to store properties to check, ignoring parent class decorators
        if (!Array.isArray(target[propertiesToCheck][target.constructor.name])) {
            target[propertiesToCheck][target.constructor.name] = [];
        }

        params.type = type;
        params.required = (typeof params.required === 'boolean') ? params.required : true;
        params.nullable = (typeof params.nullable === 'boolean') ? params.nullable : false;
        if (params.onFailure && ['ignore', 'setNull'].indexOf(params.onFailure) < 0) {
            delete params.onFailure;
        }

        // If type is array, check array type if provided
        if (expectedType.constructor.name === 'Array' && params.arrayType) {
            try {
                expectedType = new params.arrayType();
            } catch (e) {
                delete params.arrayType;
            }
        } else {
            delete params.arrayType;
        }

        target[propertiesToCheck][target.constructor.name][key] = params;
    };
}

// tslint:disable-next-line:no-reserved-keywords
function getParent(type: any): any {
    if (type && type.prototype) {
        const parentPrototype = Object.getPrototypeOf(type.prototype);
        if (parentPrototype && parentPrototype.constructor && parentPrototype.constructor.name !== 'Object') {
            return parentPrototype.constructor;
        }
    }
    return null;
}

function throwInternalErrorInvalidType(expectedType: string, providedType: string): never {
    throw new InternalError(
        `Expecting ${expectedType}, received ${providedType}`, ValidationErrorType.InvalidType
    );
}

function validateInput(input: any, expectedType: any, arrayType: any = null): any {
    // Try to validate properties from parent class if existing
    const parent = getParent(expectedType);
    if (parent) {
        input = validateInput(input, parent, arrayType);
    }

    // Try to instantiate the expected type to see if it's valid
    try {
        expectedType = new expectedType();
    } catch (e) {
        return input;
    }

    // If type has propertiesToCheck, it's a complex type with fields to validate
    const constructorName = expectedType.constructor.name;
    if (expectedType[propertiesToCheck] && expectedType[propertiesToCheck][constructorName]) {
        const keysToValidate = Object.keys(expectedType[propertiesToCheck][constructorName]);
        for (const key of keysToValidate) {
            const checkParams: PropertyCheckParams = expectedType[propertiesToCheck][constructorName][key];
            // Validate nullable
            if (input && input.hasOwnProperty(key)) {
                if (!checkParams.nullable && input[key] == null) {
                    if (checkParams.onFailure === 'setNull') {
                        expectedType[key] = null;
                    } else if (checkParams.onFailure !== 'ignore') {
                        const error = new InternalError('Field can\'t be null', ValidationErrorType.NullValue);
                        error.fields.push(key);
                        throw error;
                    }
                }
            } else if (checkParams.required) { // Validate required
                if (checkParams.onFailure === 'setNull') {
                    expectedType[key] = null;
                } else if (checkParams.onFailure !== 'ignore') {
                    const error = new InternalError('Field is required', ValidationErrorType.MissingField);
                    error.fields.push(key);
                    throw error;
                }
            }

            // Validate properties recursively
            if (input && input[key] != null) {
                try {
                    expectedType[key] = validateInput(input[key], checkParams.type, checkParams.arrayType);
                } catch (e) {
                    if (checkParams.onFailure === 'setNull') {
                        expectedType[key] = null;
                    } else if (checkParams.onFailure !== 'ignore') {
                        const propertyName = !isNaN(e.index) ? `${key}[${e.index}]` : key;
                        (<InternalError> e).fields.unshift(propertyName);
                        throw e;
                    }
                }
            }
        }

        if (input && typeof input === 'object') {
            for (const uncheckedKey of Object.keys(input).filter(i => keysToValidate.indexOf(i) < 0)) {
                expectedType[uncheckedKey] = input[uncheckedKey];
            }
        } else {
            throwInternalErrorInvalidType(`an instance of ${constructorName}`, JSON.stringify(input));
        }
        return expectedType;
    } else { // Else it's a basic type or a complex type with no validation
        if (constructorName !== 'Object') {
            const providedType = typeof input;
            if (constructorName === 'Array') {
                if (!Array.isArray(input)) {
                    throwInternalErrorInvalidType('array', `${providedType} ${JSON.stringify(input)}`);
                }

                for (const [index, item] of input.entries()) {
                    try {
                        expectedType.push(arrayType ? validateInput(item, arrayType) : item);
                    } catch (e) {
                        (<InternalError> e).index = index;
                        throw e;
                    }
                }

                return expectedType;
            } else if (constructorName === 'Date') {
                if (input instanceof Date !== true || typeof input.getTime !== 'function' || isNaN(input.getTime())) {
                    throwInternalErrorInvalidType('date', `${providedType} ${JSON.stringify(input)}`);
                }
            } else {
                expectedType = typeof expectedType.valueOf();
                if (providedType !== expectedType) {
                    throwInternalErrorInvalidType(expectedType, `${providedType} ${JSON.stringify(input)}`);
                }
            }
        }
        return input;
    }
}

export function validate<T>(input: any, expectedType: (new () => T)): T;
export function validate<T extends ArrayConstructor, U>(input: any, expectedType: T, arrayType: (new () => U)): U[];
export function validate(input: any, expectedType: any, arrayType: any = null): any {
    try {
        return validateInput(input, expectedType, arrayType);
    } catch (e) {
        if (e instanceof InternalError) {
            throw new ValidationError(e.message, e.errorType, e.fields);
        }

        throw new ValidationError(e.message);
    }
}
