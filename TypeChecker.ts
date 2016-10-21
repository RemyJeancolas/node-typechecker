import 'reflect-metadata';

const propertiesToCheck = Symbol('propertiesToCheck');

export function TypeCheckProperty(params: PropertyCheckParams = {}): any {
    return (target: any, key: string | symbol): any => {
        // Define property type
        const type = params.type ? params.type : Reflect.getMetadata("design:type", target, key);

        // Check if type is valid
        try {
            new type();
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
        target[propertiesToCheck][key] = params;
    };
}



export interface PropertyCheckParams {
    type?: any;
    required?: boolean;
    nullable?: boolean;
}

export function validate(input: any, expectedType: any): void {
    if (expectedType) {
        const a = expectedType;
        // Try to instantiate the exepcted type to see if it's valid 
        try {
            expectedType = new expectedType();
        } catch (e) {
            return;
        }

        // If type has propertiesToCheck, it's a complex type
        if (expectedType[propertiesToCheck]) {
            console.log(expectedType.constructor.name, expectedType[propertiesToCheck], JSON.stringify(arguments[0]));
            Object.keys(expectedType[propertiesToCheck]).forEach(key => {
                const checkParams: PropertyCheckParams = expectedType[propertiesToCheck][key];
                // Validate required
                if (checkParams.required && !input.hasOwnProperty(key)) {
                    throw new Error(`[${expectedType.constructor.name}] Missing required field: ${key}`);
                }

                // Validate properties recursively
                if (input[key]) {
                    validate(input[key], checkParams.type);
                }
            });
        } else { // Else it's a basic type
            console.log(expectedType.constructor.name);
        }
    }
}
