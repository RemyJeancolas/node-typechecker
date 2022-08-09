import 'reflect-metadata';

const propertiesToCheck = Symbol('propertiesToCheck');
const paramsToCheck = Symbol('paramsToCheck');

type onFailure = 'ignore' | 'setNull';

export interface PropertyCheckParams {
  type?: any;
  arrayType?: any;
  required?: boolean;
  nullable?: boolean;
  onFailure?: onFailure;
  customValidator?: (input: any) => boolean;
}

type InternalParams = Required<Pick<PropertyCheckParams, 'type' | 'required' | 'nullable'>> &
  Pick<PropertyCheckParams, 'arrayType' | 'onFailure' | 'customValidator'>;

export class ValidationError extends Error {
  public readonly field: string | undefined;
  public readonly errorType: ValidationErrorType;

  constructor(message: string, errorType: ValidationErrorType, fields?: string[]) {
    if (Array.isArray(fields) && fields.length > 0) {
      super(`${fields.join('.')}: ${message}`);
      this.field = fields[fields.length - 1];
    } else {
      super(message);
    }

    this.errorType = errorType;
  }
}

export enum ValidationErrorType {
  NullValue = 'null',
  MissingField = 'missing',
  InvalidType = 'invalid',
  Custom = 'custom',
}

type ExtraParams = Pick<PropertyCheckParams, 'customValidator'>;

class InternalError extends Error {
  public fields: string[] = [];
  public errorType: ValidationErrorType;
  public index?: number;

  constructor(message: string, errorType: ValidationErrorType) {
    super(message);

    this.errorType = errorType;
  }
}

export function TypesCheck(
  target: any,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<any>
): any {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]): any {
    if (
      target[paramsToCheck] &&
      Object.prototype.hasOwnProperty.call(target[paramsToCheck], propertyKey)
    ) {
      for (let i = 0; i < args.length; i += 1) {
        if (typeof target[paramsToCheck][propertyKey][i] !== 'undefined') {
          args[i] = validate(args[i], target[paramsToCheck][propertyKey][i]);
        }
      }
    }

    return originalMethod.apply(this, args);
  };
}

export function TypeCheck(type: any): any {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): any => {
    if (!target[paramsToCheck]) {
      target[paramsToCheck] = {};
    }
    if (!Object.prototype.hasOwnProperty.call(target[paramsToCheck], propertyKey)) {
      target[paramsToCheck][propertyKey] = [];
    }
    target[paramsToCheck][propertyKey][parameterIndex] = type;
  };
}

export function PropertyCheck(params: PropertyCheckParams = {}): any {
  return (target: any, key: string | symbol): void => {
    // Define property type
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
    if (!target[propertiesToCheck]) {
      target[propertiesToCheck] = {};
    }

    // Create an array specific to current class to store properties to check, ignoring parent class decorators
    if (!target[propertiesToCheck][target.constructor.name]) {
      target[propertiesToCheck][target.constructor.name] = {};
    }

    const internalParams: InternalParams = {
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
      } catch (e) {
        // Ignore invalid array type
      }
    }

    target[propertiesToCheck][target.constructor.name][key] = internalParams;
  };
}

function getParent(type: any): any {
  if (type && type.prototype) {
    const parentPrototype = Object.getPrototypeOf(type.prototype);
    if (
      parentPrototype &&
      parentPrototype.constructor &&
      parentPrototype.constructor.name !== 'Object'
    ) {
      return parentPrototype.constructor;
    }
  }
  return null;
}

function throwInternalErrorInvalidType(expectedType: string, providedType: string): never {
  throw new InternalError(
    `Expecting ${expectedType}, received ${providedType}`,
    ValidationErrorType.InvalidType
  );
}

function getExtraParams(params: InternalParams): ExtraParams {
  return {
    customValidator: params.customValidator,
  };
}

function performExtraValidation<T>(input: T, params: ExtraParams): T {
  if (params.customValidator) {
    try {
      const valid = params.customValidator(input);
      if (valid !== true) {
        throw new InternalError('Invalid value received', ValidationErrorType.Custom);
      }
    } catch (err) {
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

function validateInput(input: any, expectedType: any, arrayType: any, extra: ExtraParams): any {
  // Try to validate properties from parent class if existing
  const parent = getParent(expectedType);
  if (parent) {
    input = validateInput(input, parent, arrayType, extra);
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
      const checkParams: InternalParams = expectedType[propertiesToCheck][constructorName][key];
      // Validate nullable
      if (input && Object.prototype.hasOwnProperty.call(input, key)) {
        if (!checkParams.nullable && input[key] == null) {
          if (checkParams.onFailure === 'setNull') {
            expectedType[key] = null;
          } else if (checkParams.onFailure !== 'ignore') {
            const error = new InternalError("Field can't be null", ValidationErrorType.NullValue);
            error.fields.push(key);
            throw error;
          }
        }
      } else if (checkParams.required) {
        // Validate required
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
          expectedType[key] = validateInput(
            input[key],
            checkParams.type,
            checkParams.arrayType,
            getExtraParams(checkParams)
          );
        } catch (e) {
          if (checkParams.onFailure === 'setNull') {
            expectedType[key] = null;
          } else if (checkParams.onFailure !== 'ignore') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const propertyName = !isNaN((e as InternalError).index!)
              ? `${key}[${(e as InternalError).index}]`
              : key;
            (e as InternalError).fields.unshift(propertyName);
            throw e;
          }
        }
      }
    }

    if (input && typeof input === 'object') {
      for (const uncheckedKey of Object.keys(input).filter((i) => keysToValidate.indexOf(i) < 0)) {
        expectedType[uncheckedKey] = input[uncheckedKey];
      }
    } else {
      throwInternalErrorInvalidType(`an instance of ${constructorName}`, JSON.stringify(input));
    }
    return expectedType;
  } else {
    // Else it's a basic type or a complex type with no validation
    if (constructorName !== 'Object') {
      const providedType = typeof input;
      if (constructorName === 'Array') {
        if (!Array.isArray(input)) {
          throwInternalErrorInvalidType('array', `${providedType} ${JSON.stringify(input)}`);
        }

        for (const [index, item] of input.entries()) {
          try {
            expectedType.push(arrayType ? validateInput(item, arrayType, undefined, {}) : item);
          } catch (e) {
            (e as InternalError).index = index;
            throw e;
          }
        }

        return performExtraValidation(expectedType, extra);
      } else if (constructorName === 'Date') {
        if (
          input instanceof Date !== true ||
          typeof input.getTime !== 'function' ||
          isNaN(input.getTime())
        ) {
          throwInternalErrorInvalidType('date', `${providedType} ${JSON.stringify(input)}`);
        }
      } else {
        expectedType = typeof expectedType.valueOf();
        if (providedType !== expectedType) {
          throwInternalErrorInvalidType(expectedType, `${providedType} ${JSON.stringify(input)}`);
        }
      }
    }

    return performExtraValidation(input, extra);
  }
}

export function validate<T>(input: any, expectedType: new () => T): T;
export function validate<T extends ArrayConstructor, U>(
  input: any,
  expectedType: T,
  arrayType: new () => U
): U[];
export function validate(input: any, expectedType: any, arrayType: any = null): any {
  try {
    return validateInput(input, expectedType, arrayType, {});
  } catch (err) {
    const e = err as InternalError;
    throw new ValidationError(e.message, e.errorType, e.fields);
  }
}
