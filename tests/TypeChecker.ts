import {expect} from 'chai';
import {validate, PropertyCheck, TypesCheck, TypeCheck} from '../lib/TypeChecker';

class Bar {
    @PropertyCheck()
    public description: string;
    @PropertyCheck({type: {}}) // Invalid type, validation will be skipped for this property
    public description2: string;
    @PropertyCheck({arrayType: {}}) // Invalid array type, items type validation will be disabled
    public description3: string[];
}

class Foo {
    @PropertyCheck()
    public name: string;
    @PropertyCheck({required: false})
    public age: Number;
    @PropertyCheck({type: Array, arrayType: String, nullable: true})
    public hobbies: string[];
    @PropertyCheck()
    public bar: Bar;
    @PropertyCheck({required: false, arrayType: Bar})
    public bars: Bar[];
    @PropertyCheck({required: false})
    public date?: Date;
}

class Test {
    @TypesCheck
    public static test(input: number): number {
        return input;
    }
    @TypesCheck
    public static test2(input: number, @TypeCheck(Foo) foo: Foo, @TypeCheck(String) whatever: string): number {
        return input;
    }
}

class Parent {
    @PropertyCheck()
    public property1: string;
}

class A extends Parent {
    @PropertyCheck()
    public property2: string;
}

class B extends Parent {
    @PropertyCheck()
    public property3: string;
}

class Y {
    @PropertyCheck({required: false})
    public readonly name?: string;
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
            validate('foo', <any> {});
        });

        it('should validate arrays', () => {
            // Failed validation: number !== array
            expect(() => validate(3, Array)).to.throw('Expecting array, received number 3');

            // Validation ok
            validate(['foo'], Array);

            // Failed validation: array items (string) don't match expected type (number)
            expect(() => validate(['foo'], Array, Number)).to.throw('Expecting number, received string "foo"');
        });

        it('should validate dates', () => {
            // Failed validation: number !== date
            expect(() => validate(3, Date)).to.throw('Expecting date, received number 3');

            // Validation ok
            validate(new Date(), Date);

            // Failed validation: invalid date
            expect(() => validate(new Date('foo'), Date)).to.throw('Expecting date, received object null');
        });

        it('should validate nested objects', () => {
            expect(() => validate(null, Y)).to.throw('Expecting an instance of Y, received null');

            // Failed validation: missing required field
            const foo = new Foo();
            expect(() => validate(foo, Foo)).to.throw('name: Field is required');

            // Failed validation: Invalid array items (number) while expecting string
            foo.name = 'Name';
            foo.hobbies = <any> [3, 4];
            expect(() => validate(foo, Foo)).to.throw('hobbies[0]: Expecting string, received number 3');

            // Failed validation: Non nullable property
            foo.hobbies = null;
            foo.bar = null;
            expect(() => validate(foo, Foo)).to.throw('bar: Field can\'t be null');

            // Failed validation: missing required field on nested object
            const bar = new Bar();
            bar.description = 'Description';
            bar.description2 = <any> 3;
            foo.bar = bar;
            expect(() => validate(foo, Foo)).to.throw('bar.description3: Field is required'); // Description2 validation is ignored

            // Validation ok: description3 array type is ignored
            bar.description3 = <any> [3, 4];
            validate(foo, Foo);

            foo.bars = <any> [bar, {description: 4}];
            expect(() => validate(foo, Foo)).to.throw('bars[1].description: Expecting string, received number 4');
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
    });

    describe('TypesCheck()', () => {
        it('should perform automatic validation', () => {
            // No validation called
            Test.test(5);

            // Validation called automatically thanks to decorators
            expect (() => Test.test2(5, null, 'foo')).to.throw('name: Field is required');
        });
    });
});
