import { expect } from 'chai';
import { stub } from 'sinon';
import { validate, PropertyCheck, TypesCheck, TypeCheck } from '../src/TypeChecker';
import { ValidationError, ValidationErrorType } from '..';

class Bar {
  @PropertyCheck()
  public description!: string;
  @PropertyCheck({ type: {} }) // Invalid type, validation will be skipped for this property
  public description2!: string;
  @PropertyCheck({ arrayType: {} }) // Invalid array type, items type validation will be disabled
  public description3!: string[];
}

class Foo {
  @PropertyCheck()
  public name!: string;
  @PropertyCheck({ required: false })
  public age!: number;
  @PropertyCheck({ type: Array, arrayType: String, nullable: true })
  public hobbies!: string[];
  @PropertyCheck()
  public bar!: Bar;
  @PropertyCheck({ required: false, arrayType: Bar })
  public bars!: Bar[];
  @PropertyCheck({ required: false })
  public date?: Date;
}

class Test {
  @TypesCheck
  public static test(input: number): number {
    return input;
  }
  @TypesCheck
  public static test2(
    input: number,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    @TypeCheck(Foo) _foo: Foo,
    @TypeCheck(String) _whatever: string
    /* eslint-enable @typescript-eslint/no-unused-vars */
  ): number {
    return input;
  }
}

class Parent {
  @PropertyCheck()
  public property1!: string;
}

class A extends Parent {
  @PropertyCheck()
  public property2!: string;
}

class B {
  @PropertyCheck({ customValidator: (input) => input.trim().length > 2 })
  public property1!: string;

  @PropertyCheck({
    required: false,
    onFailure: 'setNull',
    customValidator: (input) => input.trim().length > 2,
  })
  public property2?: string;

  @PropertyCheck({ required: false, customValidator: (input) => input.length.trim() > 2 })
  public property3?: string;
}

class X {
  @PropertyCheck({ onFailure: 'foo' as any })
  public readonly invalidOnFailure?: string;
}

class Y {
  @PropertyCheck({ required: false })
  public readonly name?: string;
  @PropertyCheck({ required: false })
  public readonly test?: boolean;
  @PropertyCheck({ required: false })
  public readonly test2?: number;
}

class Z {
  @PropertyCheck({ onFailure: 'ignore' })
  public readonly requiredIgnore?: string;
  @PropertyCheck({ onFailure: 'setNull' })
  public readonly requiredSetNull?: string;
  @PropertyCheck({ onFailure: 'ignore' })
  public readonly notRequiredIgnore?: string;
  @PropertyCheck({ onFailure: 'setNull' })
  public readonly notRequiredSetNull?: string;
  @PropertyCheck({ onFailure: 'ignore' })
  public readonly invalidIgnore?: string;
  @PropertyCheck({ onFailure: 'setNull' })
  public readonly invalidSetNull?: string;
}

describe('TypeChecker', () => {
  describe('validate()', () => {
    it('should validate basic types', () => {
      // Validation ok
      validate('foo', String);

      // Failed validation: string !== number
      expect(() => validate('foo', Number)).to.throw('Expecting number, received string "foo"');

      // Validation ok: anything matches object
      validate('foo', Object);

      // Validation skipped with no error: invalid expected type
      validate('foo', {} as any);
    });

    it('should validate arrays', () => {
      // Failed validation: number !== array
      expect(() => validate(3, Array)).to.throw('Expecting array, received number 3');

      // Validation ok
      validate(['foo'], Array);

      // Failed validation: array items (string) don't match expected type (number)
      expect(() => validate(['foo'], Array, Number)).to.throw(
        'Expecting number, received string "foo"'
      );
    });

    it('should validate dates', () => {
      // Failed validation: number !== date
      expect(() => validate(3, Date)).to.throw('Expecting date, received number 3');

      // Validation ok
      validate(new Date(), Date);

      // Failed validation: invalid date
      expect(() => validate(new Date('foo'), Date)).to.throw(
        'Expecting date, received object null'
      );
    });

    it('should validate nested objects', () => {
      expect(validate({ test: false, test2: 0 }, Y)).to.deep.equal(
        { test: false, test2: 0 },
        'Result should be as expected'
      );
      expect(() => validate(null, Y)).to.throw('Expecting an instance of Y, received null');

      // Failed validation: missing required field
      const foo = new Foo();
      expect(() => validate(foo, Foo)).to.throw('name: Field is required');

      // Failed validation: Invalid array items (number) while expecting string
      foo.name = 'Name';
      foo.hobbies = [3, 4] as any;
      expect(() => validate(foo, Foo)).to.throw('hobbies[0]: Expecting string, received number 3');

      // Failed validation: Non nullable property
      foo.hobbies = null as unknown as string[];
      foo.bar = null as unknown as Bar;
      expect(() => validate(foo, Foo)).to.throw("bar: Field can't be null");

      // Failed validation: missing required field on nested object
      const bar = new Bar();
      bar.description = 'Description';
      bar.description2 = 3 as any;
      foo.bar = bar;
      expect(() => validate(foo, Foo)).to.throw('bar.description3: Field is required'); // Description2 validation is ignored

      // Validation ok: description3 array type is ignored
      bar.description3 = [3, 4] as any;
      validate(foo, Foo);

      foo.bars = [bar, { description: 4 }] as any;
      expect(() => validate(foo, Foo)).to.throw(
        'bars[1].description: Expecting string, received number 4'
      );
    });

    it('should validate class inheritance', () => {
      const a = new A();
      expect(() => validate(a, A)).to.throw('property1: Field is required');

      a.property1 = 'foo';
      expect(() => validate(a, A)).to.throw('property2: Field is required');

      a.property2 = 'bar';
      validate(a, A);
    });

    it('should return object instances after validation', () => {
      expect(validate({}, Y)).to.be.instanceof(Y);
      expect(validate([{}], Array, Y)[0]).to.be.instanceof(Y);
    });

    it('should ignore invalid "onFailure" values', () => {
      expect(() => validate({}, X)).to.throw('invalidOnFailure: Field is required');
    });

    it('should ignore validation failures and return a valid object is "onFailure" is defined', () => {
      const result = validate(
        {
          notRequiredIgnore: null,
          notRequiredSetNull: null,
          invalidIgnore: 2,
          invalidSetNull: 2,
        },
        Z
      );
      expect(result).to.deep.equal(
        {
          requiredSetNull: null,
          notRequiredSetNull: null,
          invalidSetNull: null,
        },
        'Result should be as expected'
      );
      expect(result).to.be.instanceof(Z);
    });

    it('should return the validation error type in the thrown error for basic types', () => {
      let error: ValidationError | undefined;
      try {
        validate(new Date('foo'), Date);
      } catch (err) {
        error = err as ValidationError;
      }
      expect(error?.errorType).to.equal(ValidationErrorType.InvalidType);
    });

    it('should return the validation error type and field name in the thrown error for complex objects', () => {
      let error: ValidationError | undefined;
      try {
        validate(new Foo(), Foo);
      } catch (err) {
        error = err as ValidationError;
      }
      expect(error?.errorType).to.equal(ValidationErrorType.MissingField);
      expect(error?.field).to.equal('name');
    });

    it('should perform custom validation if defined', () => {
      const b = new B();
      expect(() => validate(b, B)).to.throw('property1: Field is required');

      b.property1 = '  b  ';
      expect(() => validate(b, B)).to.throw('property1: Invalid value received');

      b.property1 = 'bbb';
      expect(() => validate(b, B)).not.to.throw();

      b.property2 = '  b  ';
      const validated = validate(b, B);
      expect(validated.property2).to.equal(null);
    });

    it('should throw a specific error and log a message if a technical error occurs during custom validation', () => {
      const warn = stub(console, 'warn');
      const b = new B();
      b.property1 = 'bbb';
      b.property3 = '';

      expect(() => validate(b, B)).to.throw(
        'property3: An error occurred while performing custom validation'
      );
      expect(warn.calledOnceWith('An error occurred while performing custom validation')).to.equal(
        true
      );
    });
  });

  describe('TypesCheck()', () => {
    it('should perform automatic validation', () => {
      // No validation called
      Test.test(5);

      // Validation called automatically thanks to decorators
      expect(() => Test.test2(5, null as unknown as Foo, 'foo')).to.throw(
        'name: Field is required'
      );
    });
  });
});
