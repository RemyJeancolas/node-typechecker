export interface PropertyCheckParams {
    type?: any;
    arrayType?: any;
    required?: boolean;
    nullable?: boolean;
}

export function TypesCheck(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): any;
export function TypeCheck(type: any): any;
export function PropertyCheck(params: PropertyCheckParams): any;
export function validate(input: any, expectedType: any, arrayType?: any): void;
