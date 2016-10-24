import 'reflect-metadata';

const propertiesToCheck = Symbol('propertiesToCheck');
const paramsToCheck = Symbol('paramsToCheck');

export interface PropertyCheckParams {
    type?: any;
    arrayType?: any;
    required?: boolean;
    nullable?: boolean;
}

class ValidationError extends Error {
    public fields: string[] = [];
}

export function TypesCheck(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): any {
    const originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]): any {
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
        const type = params.type ? params.type : Reflect.getMetadata("design:type", target, key);

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

        params.type = type;
        params.required = (typeof params.required === 'boolean') ? params.required : true;
        params.nullable = (typeof params.nullable === 'boolean') ? params.nullable : false;

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

        target[propertiesToCheck][key] = params;
    };
}

export function validate(input: any, expectedType: any, arrayType: any = null): void {
    try {
        validateInput(input, expectedType, arrayType);
    } catch (e) {
        const fields = (<ValidationError> e).fields;
        if (fields.length > 0) {
            throw new Error(`${fields.join(' -> ')}: ${e.message}`);
        }
        throw new Error(e.message);
    }
}

function validateInput(input: any, expectedType: any, arrayType: any = null): void {
    // Try to instantiate the expected type to see if it's valid 
    try {
        expectedType = new expectedType();
    } catch (e) {
        return;
    }

    // If type has propertiesToCheck, it's a complex type with fields to validate
    if (expectedType[propertiesToCheck]) {
        Object.keys(expectedType[propertiesToCheck]).forEach(key => {
            const checkParams: PropertyCheckParams = expectedType[propertiesToCheck][key];
            // Validate required
            if (input && input.hasOwnProperty(key)) {
                if (!checkParams.nullable && input[key] == null) {
                    const error = new ValidationError('Field can\'t be null');
                    error.fields.push(key);
                    throw error;
                }
            } else if (checkParams.required) {
                const error = new ValidationError('Field is required');
                error.fields.push(key);
                throw error;
            }

            // Validate properties recursively
            if (input[key]) {
                try {
                    validateInput(input[key], checkParams.type, checkParams.arrayType);
                } catch (e) {
                    (<ValidationError> e).fields.unshift(key);
                    throw e;
                }
            }
        });
    } else { // Else it's a basic type or a complex type with no validation
        const constructorName = expectedType.constructor.name;
        if (constructorName !== 'Object') {
            const providedType = typeof input;
            if (constructorName === 'Array') {
                if (!Array.isArray(input)) {
                    throw new ValidationError(`Expecting array, received ${providedType} ${JSON.stringify(input)}`);
                }
                if (arrayType) {
                    input.forEach(item => {
                        validateInput(item, arrayType);
                    });
                }
            } else {
                expectedType = typeof expectedType.valueOf();
                if (providedType !== expectedType) {
                    throw new ValidationError(`Expecting ${expectedType}, received ${providedType} ${JSON.stringify(input)}`);
                }
            }
        }            
    }
}
