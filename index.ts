import {TypesCheck, TypeCheck, PropertyCheck, validate} from './TypeChecker';

interface FooBar {
    description: string;
}

class Bar {
    @PropertyCheck({required: true, arrayType: String})
    public description: string[];
    @PropertyCheck()
    public count: Number;
    @PropertyCheck({nullable: false})
    public baz: Function;
}

class Foo {
    @PropertyCheck({required: true, nullable: true})
    public name: string;
    @PropertyCheck({arrayType: Bar})
    public bar: Bar[];
}

const foo = new Foo();
foo.name = null;
const a: any = {description: ['5'], count: 3, baz: () => { console.log('foo');}};
foo.bar = [a];//new Bar();
// foo.bar.count = 'aaa';

class aaa {
    @TypesCheck
    public aaa(a: number, @TypeCheck(Foo) foo: Foo): void {
        console.log(a);
    }
}
let b = new aaa();
b.aaa(Math.round(Math.random() * 100), foo);
// validate(foo, Foo);