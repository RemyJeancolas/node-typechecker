"use strict";
require('reflect-metadata');
const propertiesToCheck = Symbol('propertiesToCheck');
const paramsToCheck = Symbol('paramsToCheck');
class ValidationError extends Error {
}
exports.ValidationError = ValidationError;
class InternalError extends Error {
    constructor() {
        super(...arguments);
        this.fields = [];
    }
}
function TypesCheck(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        if (Array.isArray(target[paramsToCheck]) && target[paramsToCheck].hasOwnProperty(propertyKey)) {
            for (let i = 0; i < args.length; i += 1) {
                if (typeof target[paramsToCheck][propertyKey][i] !== 'undefined') {
                    validate(args[i], target[paramsToCheck][propertyKey][i]);
                }
            }
        }
        return originalMethod.apply(this, args);
    };
}
exports.TypesCheck = TypesCheck;
// tslint:disable-next-line:no-reserved-keywords
function TypeCheck(type) {
    return (target, propertyKey, parameterIndex) => {
        if (!Array.isArray(target[paramsToCheck])) {
            target[paramsToCheck] = [];
        }
        if (!target[paramsToCheck].hasOwnProperty(propertyKey)) {
            target[paramsToCheck][propertyKey] = [];
        }
        target[paramsToCheck][propertyKey][parameterIndex] = type;
    };
}
exports.TypeCheck = TypeCheck;
function PropertyCheck(params = {}) {
    return (target, key) => {
        // Define property type
        // tslint:disable-next-line:no-reserved-keywords
        const type = params.type ? params.type : Reflect.getMetadata('design:type', target, key);
        // Check if type is valid
        let expectedType;
        try {
            expectedType = new type();
        }
        catch (e) {
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
        // If type is array, check array type if provided
        if (expectedType.constructor.name === 'Array' && params.arrayType) {
            try {
                expectedType = new params.arrayType();
            }
            catch (e) {
                delete params.arrayType;
            }
        }
        else {
            delete params.arrayType;
        }
        target[propertiesToCheck][target.constructor.name][key] = params;
    };
}
exports.PropertyCheck = PropertyCheck;
// tslint:disable-next-line:no-reserved-keywords
function getParent(type) {
    if (type && type.prototype) {
        const parentPrototype = Object.getPrototypeOf(type.prototype);
        if (parentPrototype && parentPrototype.constructor && parentPrototype.constructor.name !== 'Object') {
            return parentPrototype.constructor;
        }
    }
    return null;
}
function validateInput(input, expectedType, arrayType = null) {
    // Try to validate properties from parent class if existing
    const parent = getParent(expectedType);
    if (parent) {
        validateInput(input, parent, arrayType);
    }
    // Try to instantiate the expected type to see if it's valid 
    try {
        expectedType = new expectedType();
    }
    catch (e) {
        return;
    }
    // If type has propertiesToCheck, it's a complex type with fields to validate
    const constructorName = expectedType.constructor.name;
    if (expectedType[propertiesToCheck] && expectedType[propertiesToCheck][constructorName]) {
        Object.keys(expectedType[propertiesToCheck][constructorName]).forEach(key => {
            const checkParams = expectedType[propertiesToCheck][constructorName][key];
            // Validate required
            if (input && input.hasOwnProperty(key)) {
                if (!checkParams.nullable && input[key] == null) {
                    const error = new InternalError('Field can\'t be null');
                    error.fields.push(key);
                    throw error;
                }
            }
            else if (checkParams.required) {
                const error = new InternalError('Field is required');
                error.fields.push(key);
                throw error;
            }
            // Validate properties recursively
            if (input[key]) {
                try {
                    validateInput(input[key], checkParams.type, checkParams.arrayType);
                }
                catch (e) {
                    const propertyName = !isNaN(e.index) ? `${key}[${e.index}]` : key;
                    e.fields.unshift(propertyName);
                    throw e;
                }
            }
        });
    }
    else {
        if (constructorName !== 'Object') {
            const providedType = typeof input;
            if (constructorName === 'Array') {
                if (!Array.isArray(input)) {
                    throw new InternalError(`Expecting array, received ${providedType} ${JSON.stringify(input)}`);
                }
                if (arrayType) {
                    input.forEach((item, index) => {
                        try {
                            validateInput(item, arrayType);
                        }
                        catch (e) {
                            e.index = index;
                            throw e;
                        }
                    });
                }
            }
            else {
                expectedType = typeof expectedType.valueOf();
                if (providedType !== expectedType) {
                    throw new InternalError(`Expecting ${expectedType}, received ${providedType} ${JSON.stringify(input)}`);
                }
            }
        }
    }
}
function validate(input, expectedType, arrayType = null) {
    try {
        validateInput(input, expectedType, arrayType);
    }
    catch (e) {
        const fields = e.fields;
        if (fields.length > 0) {
            throw new ValidationError(`${fields.join('.')}: ${e.message}`);
        }
        throw new ValidationError(e.message);
    }
}
exports.validate = validate;
//# sourceMappingURL=TypeChecker.js.map