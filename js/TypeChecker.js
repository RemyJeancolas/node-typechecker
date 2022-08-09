"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.PropertyCheck = exports.TypeCheck = exports.TypesCheck = exports.ValidationErrorType = exports.ValidationError = void 0;
require("reflect-metadata");
const propertiesToCheck = Symbol('propertiesToCheck');
const paramsToCheck = Symbol('paramsToCheck');
class ValidationError extends Error {
    constructor(message, errorType, fields) {
        if (Array.isArray(fields) && fields.length > 0) {
            super(`${fields.join('.')}: ${message}`);
            this.field = fields[fields.length - 1];
        }
        else {
            super(message);
        }
        this.errorType = errorType;
    }
}
exports.ValidationError = ValidationError;
var ValidationErrorType;
(function (ValidationErrorType) {
    ValidationErrorType["NullValue"] = "null";
    ValidationErrorType["MissingField"] = "missing";
    ValidationErrorType["InvalidType"] = "invalid";
    ValidationErrorType["Custom"] = "custom";
})(ValidationErrorType = exports.ValidationErrorType || (exports.ValidationErrorType = {}));
class InternalError extends Error {
    constructor(message, errorType) {
        super(message);
        this.fields = [];
        this.errorType = errorType;
    }
}
function TypesCheck(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        if (target[paramsToCheck] &&
            Object.prototype.hasOwnProperty.call(target[paramsToCheck], propertyKey)) {
            for (let i = 0; i < args.length; i += 1) {
                if (typeof target[paramsToCheck][propertyKey][i] !== 'undefined') {
                    args[i] = validate(args[i], target[paramsToCheck][propertyKey][i]);
                }
            }
        }
        return originalMethod.apply(this, args);
    };
}
exports.TypesCheck = TypesCheck;
function TypeCheck(type) {
    return (target, propertyKey, parameterIndex) => {
        if (!target[paramsToCheck]) {
            target[paramsToCheck] = {};
        }
        if (!Object.prototype.hasOwnProperty.call(target[paramsToCheck], propertyKey)) {
            target[paramsToCheck][propertyKey] = [];
        }
        target[paramsToCheck][propertyKey][parameterIndex] = type;
    };
}
exports.TypeCheck = TypeCheck;
function PropertyCheck(params = {}) {
    return (target, key) => {
        const type = params.type ? params.type : Reflect.getMetadata('design:type', target, key);
        let expectedType;
        try {
            expectedType = new type();
        }
        catch (e) {
            return;
        }
        if (!target[propertiesToCheck]) {
            target[propertiesToCheck] = {};
        }
        if (!target[propertiesToCheck][target.constructor.name]) {
            target[propertiesToCheck][target.constructor.name] = {};
        }
        const internalParams = {
            type,
            required: typeof params.required === 'boolean' ? params.required : true,
            nullable: typeof params.nullable === 'boolean' ? params.nullable : false,
        };
        if (typeof params.customValidator === 'function') {
            internalParams.customValidator = params.customValidator;
        }
        if (params.onFailure && ['ignore', 'setNull'].includes(params.onFailure)) {
            internalParams.onFailure = params.onFailure;
        }
        if (expectedType.constructor.name === 'Array' && params.arrayType) {
            try {
                new params.arrayType();
                internalParams.arrayType = params.arrayType;
            }
            catch (e) {
            }
        }
        target[propertiesToCheck][target.constructor.name][key] = internalParams;
    };
}
exports.PropertyCheck = PropertyCheck;
function getParent(type) {
    if (type && type.prototype) {
        const parentPrototype = Object.getPrototypeOf(type.prototype);
        if (parentPrototype &&
            parentPrototype.constructor &&
            parentPrototype.constructor.name !== 'Object') {
            return parentPrototype.constructor;
        }
    }
    return null;
}
function throwInternalErrorInvalidType(expectedType, providedType) {
    throw new InternalError(`Expecting ${expectedType}, received ${providedType}`, ValidationErrorType.InvalidType);
}
function getExtraParams(params) {
    return {
        customValidator: params.customValidator,
    };
}
function performExtraValidation(input, params) {
    if (params.customValidator) {
        try {
            const valid = params.customValidator(input);
            if (valid !== true) {
                throw new InternalError('Invalid value received', ValidationErrorType.Custom);
            }
        }
        catch (err) {
            if (err instanceof InternalError) {
                throw err;
            }
            const message = 'An error occurred while performing custom validation';
            console.warn(message, err);
            throw new InternalError(message, ValidationErrorType.Custom);
        }
    }
    return input;
}
function validateInput(input, expectedType, arrayType, extra) {
    const parent = getParent(expectedType);
    if (parent) {
        input = validateInput(input, parent, arrayType, extra);
    }
    try {
        expectedType = new expectedType();
    }
    catch (e) {
        return input;
    }
    const constructorName = expectedType.constructor.name;
    if (expectedType[propertiesToCheck] && expectedType[propertiesToCheck][constructorName]) {
        const keysToValidate = Object.keys(expectedType[propertiesToCheck][constructorName]);
        for (const key of keysToValidate) {
            const checkParams = expectedType[propertiesToCheck][constructorName][key];
            if (input && Object.prototype.hasOwnProperty.call(input, key)) {
                if (!checkParams.nullable && input[key] == null) {
                    if (checkParams.onFailure === 'setNull') {
                        expectedType[key] = null;
                    }
                    else if (checkParams.onFailure !== 'ignore') {
                        const error = new InternalError("Field can't be null", ValidationErrorType.NullValue);
                        error.fields.push(key);
                        throw error;
                    }
                }
            }
            else if (checkParams.required) {
                if (checkParams.onFailure === 'setNull') {
                    expectedType[key] = null;
                }
                else if (checkParams.onFailure !== 'ignore') {
                    const error = new InternalError('Field is required', ValidationErrorType.MissingField);
                    error.fields.push(key);
                    throw error;
                }
            }
            if (input && input[key] != null) {
                try {
                    expectedType[key] = validateInput(input[key], checkParams.type, checkParams.arrayType, getExtraParams(checkParams));
                }
                catch (e) {
                    if (checkParams.onFailure === 'setNull') {
                        expectedType[key] = null;
                    }
                    else if (checkParams.onFailure !== 'ignore') {
                        const propertyName = !isNaN(e.index)
                            ? `${key}[${e.index}]`
                            : key;
                        e.fields.unshift(propertyName);
                        throw e;
                    }
                }
            }
        }
        if (input && typeof input === 'object') {
            for (const uncheckedKey of Object.keys(input).filter((i) => keysToValidate.indexOf(i) < 0)) {
                expectedType[uncheckedKey] = input[uncheckedKey];
            }
        }
        else {
            throwInternalErrorInvalidType(`an instance of ${constructorName}`, JSON.stringify(input));
        }
        return expectedType;
    }
    else {
        if (constructorName !== 'Object') {
            const providedType = typeof input;
            if (constructorName === 'Array') {
                if (!Array.isArray(input)) {
                    throwInternalErrorInvalidType('array', `${providedType} ${JSON.stringify(input)}`);
                }
                for (const [index, item] of input.entries()) {
                    try {
                        expectedType.push(arrayType ? validateInput(item, arrayType, undefined, {}) : item);
                    }
                    catch (e) {
                        e.index = index;
                        throw e;
                    }
                }
                return performExtraValidation(expectedType, extra);
            }
            else if (constructorName === 'Date') {
                if (input instanceof Date !== true ||
                    typeof input.getTime !== 'function' ||
                    isNaN(input.getTime())) {
                    throwInternalErrorInvalidType('date', `${providedType} ${JSON.stringify(input)}`);
                }
            }
            else {
                expectedType = typeof expectedType.valueOf();
                if (providedType !== expectedType) {
                    throwInternalErrorInvalidType(expectedType, `${providedType} ${JSON.stringify(input)}`);
                }
            }
        }
        return performExtraValidation(input, extra);
    }
}
function validate(input, expectedType, arrayType = null) {
    try {
        return validateInput(input, expectedType, arrayType, {});
    }
    catch (err) {
        const e = err;
        throw new ValidationError(e.message, e.errorType, e.fields);
    }
}
exports.validate = validate;
//# sourceMappingURL=TypeChecker.js.map