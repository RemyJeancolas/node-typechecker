export interface PropertyCheckParams {
    type?: any;
    arrayType?: any;
    required?: boolean;
    nullable?: boolean;
}

export class ValidationError extends Error {}

export function TypesCheck(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): any;
export function TypeCheck(type: any): any;
export function PropertyCheck(params?: PropertyCheckParams): any;
export function validate<T>(input: any, expectedType: (new () => T)): T;
export function validate<T extends ArrayConstructor, U>(input: any, expectedType: T, arrayType: (new () => U)): U[];
